import { Prisma } from '../../generated/prisma/client';

/**
 * Service-layer cascading deletes.
 *
 * The schema deliberately has **no** `onDelete: Cascade` — deleting a person
 * is rare, irreversible and touches nine tables, so the order is spelled out
 * here rather than delegated to Postgres. Every function takes a transaction
 * client and must be called inside `prisma.$transaction`: a half-finished
 * cascade would strand a login with no profile, or attendance with no student.
 *
 * Nothing here re-checks authorization. Callers are already behind
 * `@Roles('COORDINATOR')` and have looked the target up by id.
 */
type Tx = Prisma.TransactionClient;

/**
 * Removes a user's messaging footprint, then any conversation their departure
 * leaves with nobody in it.
 *
 * A 1:1 conversation whose *other* member is still around is kept — that
 * member can still read the history they took part in. `getConversations`
 * already returns `otherParticipant: null` for that case.
 */
async function deleteMessagingFootprint(tx: Tx, userId: string): Promise<void> {
  // Captured before the participant rows go; afterwards there is nothing left
  // to join back to.
  const memberships = await tx.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true },
  });

  await tx.message.deleteMany({ where: { senderId: userId } });
  await tx.conversationParticipant.deleteMany({ where: { userId } });

  if (memberships.length === 0) return;

  const emptied = await tx.conversation.findMany({
    where: {
      id: { in: memberships.map((m) => m.conversationId) },
      participants: { none: {} },
    },
    select: { id: true },
  });
  if (emptied.length === 0) return;

  const emptyIds = emptied.map((c) => c.id);
  // Belt and braces: every sender of these messages should already have been
  // deleted (that is what emptied the conversation), but `Message` has a hard
  // FK to `Conversation`, so a single leftover row would abort the whole
  // transaction on the delete below.
  await tx.message.deleteMany({ where: { conversationId: { in: emptyIds } } });
  await tx.conversation.deleteMany({ where: { id: { in: emptyIds } } });
}

/**
 * Deletes a student, everything that references them, and their login.
 *
 * Returns the storage object paths the deleted rows pointed at. Storage is not
 * transactional, so the caller deletes those files *after* the commit — see
 * `CoordinatorService.removeStudent`.
 */
export async function deleteStudentCascade(
  tx: Tx,
  studentId: string,
  userId: string,
): Promise<string[]> {
  // Sequential, not `Promise.all`: an interactive transaction is one
  // connection, and concurrent queries on it are unsupported. Racing these two
  // reads made one of them come back empty, which silently dropped that file
  // from the cleanup list and orphaned the object in storage.
  const documents = await tx.document.findMany({
    where: { studentId },
    select: { fileUrl: true },
  });
  const credentials = await tx.credential.findMany({
    where: { studentId },
    select: { fileUrl: true },
  });

  await tx.attendance.deleteMany({ where: { studentId } });
  await tx.document.deleteMany({ where: { studentId } });
  await tx.credential.deleteMany({ where: { studentId } });
  await tx.evaluation.deleteMany({ where: { studentId } });

  await deleteMessagingFootprint(tx, userId);

  // Student and User are separate rows; removing only the profile would
  // strand a login with no profile.
  await tx.student.delete({ where: { id: studentId } });
  await tx.user.delete({ where: { id: userId } });

  return [...documents, ...credentials].map((row) => row.fileUrl);
}

/**
 * Deletes a supervisor, their evaluations, and their login.
 *
 * Attendance they actioned is **kept** and merely loses its approver: a
 * student's approved hours are their own record and must survive their
 * supervisor leaving the establishment. `Attendance.approvedById` is nullable
 * precisely so this is possible.
 */
export async function deleteSupervisorCascade(
  tx: Tx,
  supervisorId: string,
  userId: string,
): Promise<void> {
  await tx.evaluation.deleteMany({ where: { supervisorId } });
  await tx.attendance.updateMany({
    where: { approvedById: supervisorId },
    data: { approvedById: null },
  });

  await deleteMessagingFootprint(tx, userId);

  await tx.supervisor.delete({ where: { id: supervisorId } });
  await tx.user.delete({ where: { id: userId } });
}

/**
 * Interactive-transaction budget for a cascade.
 *
 * Prisma's 5s default is too tight: every statement is a round trip to a
 * pooled Supabase instance, and deleting an establishment runs the full
 * supervisor sequence once per supervisor.
 */
export const CASCADE_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
};
