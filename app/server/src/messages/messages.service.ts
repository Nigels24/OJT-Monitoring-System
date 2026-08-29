import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_MESSAGE_PAGE_SIZE = 50;

export interface Contact {
  id: string;
  name: string;
  role: 'STUDENT' | 'SUPERVISOR' | 'COORDINATOR';
  establishmentName: string | null;
}

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Who the caller may message, derived from their role. Explicit `select`
   * only — never `include: { user: true }` (§8 item 16: that leaked
   * `User.password` once already).
   */
  async getContacts(userId: string, role: string): Promise<Contact[]> {
    if (role === 'STUDENT') {
      const student = await this.prisma.client.student.findUnique({
        where: { userId },
        select: { establishmentId: true },
      });
      if (!student) {
        throw new NotFoundException('Student profile not found');
      }

      // establishmentId can be null — a student not yet assigned to an
      // establishment has no supervisors to contact, only coordinators.
      const [supervisors, coordinators] = await Promise.all([
        student.establishmentId
          ? this.prisma.client.supervisor.findMany({
              where: { establishmentId: student.establishmentId },
              select: {
                user: { select: { id: true, name: true } },
                establishment: { select: { name: true } },
              },
            })
          : Promise.resolve([]),
        this.getAllCoordinators(),
      ]);

      return [
        ...supervisors.map(toSupervisorContact),
        ...coordinators.map(toCoordinatorContact),
      ];
    }

    if (role === 'SUPERVISOR') {
      const supervisor = await this.prisma.client.supervisor.findUnique({
        where: { userId },
        select: { establishmentId: true },
      });
      if (!supervisor) {
        throw new NotFoundException('Supervisor profile not found');
      }

      const [students, coordinators] = await Promise.all([
        this.prisma.client.student.findMany({
          where: { establishmentId: supervisor.establishmentId },
          select: {
            user: { select: { id: true, name: true } },
            establishment: { select: { name: true } },
          },
        }),
        this.getAllCoordinators(),
      ]);

      return [
        ...students.map(toStudentContact),
        ...coordinators.map(toCoordinatorContact),
      ];
    }

    // COORDINATOR: every student and every supervisor, across all
    // establishments — the coordinator's remit is the whole programme, same
    // as their dashboard/attendance-oversight/evaluations reads.
    const [students, supervisors] = await Promise.all([
      this.prisma.client.student.findMany({
        select: {
          user: { select: { id: true, name: true } },
          establishment: { select: { name: true } },
        },
      }),
      this.prisma.client.supervisor.findMany({
        select: {
          user: { select: { id: true, name: true } },
          establishment: { select: { name: true } },
        },
      }),
    ]);

    return [
      ...students.map(toStudentContact),
      ...supervisors.map(toSupervisorContact),
    ];
  }

  private getAllCoordinators() {
    return this.prisma.client.coordinator.findMany({
      select: { user: { select: { id: true, name: true } } },
    });
  }

  /** The caller's conversations, most recent activity first. */
  async getConversations(userId: string) {
    const participants =
      await this.prisma.client.conversationParticipant.findMany({
        where: { userId },
        select: { conversationId: true },
      });

    const summaries = await Promise.all(
      participants.map((p) =>
        this.summarizeConversation(p.conversationId, userId),
      ),
    );

    return summaries.sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
  }

  /**
   * Find-or-create a 1:1 conversation with `targetUserId`.
   *
   * Idempotent: a 1:1 conversation always has exactly two participants, so
   * "some A AND some B" among `isGroup: false` conversations uniquely
   * identifies any existing conversation between this pair — a second call
   * with the same pair returns it rather than creating a duplicate.
   */
  async findOrCreateConversation(
    userId: string,
    role: string,
    targetUserId: string,
  ) {
    const contacts = await this.getContacts(userId, role);
    const target = contacts.find((c) => c.id === targetUserId);
    if (!target) {
      throw new ForbiddenException('This user is not in your allowed contacts');
    }

    const existing = await this.prisma.client.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: targetUserId } } },
        ],
      },
    });

    const conversation =
      existing ??
      (await this.prisma.client.conversation.create({
        data: {
          isGroup: false,
          createdBy: userId,
          participants: { create: [{ userId }, { userId: targetUserId }] },
        },
      }));

    return this.summarizeConversation(conversation.id, userId);
  }

  /**
   * Messages for one conversation, cursor-paginated newest-page-first — the
   * one table that grows without limit (§8 item 4 already flags unbounded
   * `findMany` as debt elsewhere), so this never fetches the whole thread.
   * Marks the caller's `lastReadAt` as now.
   */
  async getMessages(
    userId: string,
    conversationId: string,
    before: string | undefined,
    limit: number | undefined,
  ) {
    await this.requireParticipant(conversationId, userId);

    let cursorDate: Date | undefined;
    if (before) {
      const cursor = await this.prisma.client.message.findUnique({
        where: { id: before },
        select: { conversationId: true, createdAt: true },
      });
      if (!cursor || cursor.conversationId !== conversationId) {
        throw new BadRequestException('Invalid pagination cursor');
      }
      cursorDate = cursor.createdAt;
    }

    const messages = await this.prisma.client.message.findMany({
      where: {
        conversationId,
        ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit ?? DEFAULT_MESSAGE_PAGE_SIZE,
      select: { id: true, senderId: true, content: true, createdAt: true },
    });

    await this.prisma.client.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });

    return messages;
  }

  async sendMessage(userId: string, conversationId: string, content: string) {
    await this.requireParticipant(conversationId, userId);

    return this.prisma.client.message.create({
      data: { conversationId, senderId: userId, content },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
    });
  }

  private async requireParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.client.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const participant =
      await this.prisma.client.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId } },
      });
    if (!participant) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }
    return participant;
  }

  /**
   * The other participant, last message, and unread count for one
   * conversation — each a bounded `findFirst`/`count`, never the whole
   * thread. Shared by `getConversations` (one per conversation) and
   * `findOrCreateConversation` (a single call).
   */
  private async summarizeConversation(conversationId: string, userId: string) {
    const participant =
      await this.prisma.client.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId } },
        select: {
          lastReadAt: true,
          conversation: { select: { createdAt: true } },
        },
      });
    if (!participant) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    const [other, lastMessage, unreadCount] = await Promise.all([
      this.prisma.client.conversationParticipant.findFirst({
        where: { conversationId, userId: { not: userId } },
        select: { user: { select: { id: true, name: true, role: true } } },
      }),
      this.prisma.client.message.findFirst({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, senderId: true, content: true, createdAt: true },
      }),
      this.prisma.client.message.count({
        where: {
          conversationId,
          senderId: { not: userId },
          createdAt: { gt: participant.lastReadAt ?? new Date(0) },
        },
      }),
    ]);

    return {
      id: conversationId,
      otherParticipant: other?.user ?? null,
      lastMessage,
      unreadCount,
      updatedAt: lastMessage?.createdAt ?? participant.conversation.createdAt,
    };
  }
}

function toStudentContact(s: {
  user: { id: string; name: string };
  establishment: { name: string } | null;
}): Contact {
  return {
    id: s.user.id,
    name: s.user.name,
    role: 'STUDENT',
    establishmentName: s.establishment?.name ?? null,
  };
}

function toSupervisorContact(s: {
  user: { id: string; name: string };
  establishment: { name: string };
}): Contact {
  return {
    id: s.user.id,
    name: s.user.name,
    role: 'SUPERVISOR',
    establishmentName: s.establishment.name,
  };
}

function toCoordinatorContact(c: {
  user: { id: string; name: string };
}): Contact {
  return {
    id: c.user.id,
    name: c.user.name,
    role: 'COORDINATOR',
    establishmentName: null,
  };
}
