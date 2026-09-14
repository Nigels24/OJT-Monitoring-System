import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CASCADE_TRANSACTION_OPTIONS } from '../common/cascade-delete';
import {
  MAX_SCORE,
  MIN_SCORE,
  SheetTemplate,
  sheetDefinition,
  templateItemKeys,
} from '../common/evaluation-scoring';

/** Limits on the sheet the coordinator may draw up. */
export const MAX_SECTIONS = 12;
export const MAX_ITEMS_PER_SECTION = 20;
const MIN_LABEL = 3;
const MAX_SECTION_LABEL = 120;
const MAX_ITEM_LABEL = 200;
const MIN_TITLE = 3;
const MAX_TITLE = 200;

/** A template with its sections and items already in printed order. */
const TEMPLATE_SELECT = {
  id: true,
  version: true,
  status: true,
  title: true,
  createdAt: true,
  publishedAt: true,
  sections: {
    orderBy: { order: 'asc' },
    select: {
      id: true,
      key: true,
      label: true,
      order: true,
      items: {
        orderBy: { order: 'asc' },
        select: { id: true, key: true, label: true, order: true },
      },
    },
  },
} as const;

/** What `PUT /coordinator/evaluation-template/draft` accepts. */
export interface DraftInput {
  title: string;
  sections: {
    key?: string;
    label: string;
    items: { key?: string; label: string }[];
  }[];
}

/** The same, with every key resolved — generated for anything new. */
interface ResolvedDraft {
  title: string;
  sections: {
    key: string;
    label: string;
    items: { key: string; label: string }[];
  }[];
}

/**
 * The school's evaluation sheet, as versioned data.
 *
 * The coordinator owns it; supervisors consume whichever version is PUBLISHED.
 * Two invariants hold at all times and every method here is written to keep
 * them:
 *
 * 1. **At most one PUBLISHED and at most one DRAFT.** Publishing archives the
 *    outgoing version in the same transaction that promotes the draft.
 * 2. **PUBLISHED and ARCHIVED templates are immutable.** Every write below
 *    targets `status: 'DRAFT'` and nothing else; an attempt to change a
 *    published sheet is a 409, not a silent edit. A signed evaluation renders
 *    against its own version forever, so rewriting one would rewrite history.
 */
@Injectable()
export class EvaluationTemplateService {
  constructor(private prisma: PrismaService) {}

  /* ---------------------------------------------------------------------
   * Reads
   * ------------------------------------------------------------------ */

  /** Both sides of the coordinator's editor: what is live, and what is next. */
  async getOverview() {
    const published = await this.findByStatus('PUBLISHED');
    const draft = await this.findByStatus('DRAFT');
    return {
      published: published ? this.toSheet(published) : null,
      draft: draft ? this.toSheet(draft) : null,
    };
  }

  /**
   * The version new evaluations are written on.
   *
   * 409 rather than an empty sheet: a supervisor with no published form has
   * nothing to fill in, and saying so is more useful than serving zero
   * sections.
   */
  async getPublishedTemplate() {
    const published = await this.findByStatus('PUBLISHED');
    if (!published) {
      throw new ConflictException(
        'The school has not published an evaluation sheet yet. Ask the OJT coordinator to publish one before writing evaluations.',
      );
    }
    return published;
  }

  /**
   * The version a given evaluation was signed on — never the current one.
   * Editing an old sheet validates and renders against this.
   */
  async getTemplateById(templateId: string) {
    const template = await this.prisma.client.evaluationTemplate.findUnique({
      where: { id: templateId },
      select: TEMPLATE_SELECT,
    });
    if (!template) {
      throw new NotFoundException(
        'The evaluation sheet this evaluation was written on no longer exists.',
      );
    }
    return template;
  }

  /** The blank sheet as the client renders it: numerals, letters, maximums. */
  toSheet(
    template: SheetTemplate & { status: string; publishedAt: Date | null },
  ) {
    return {
      ...sheetDefinition(template),
      status: template.status,
      publishedAt: template.publishedAt,
    };
  }

  /* ---------------------------------------------------------------------
   * Scores, validated against one template version
   * ------------------------------------------------------------------ */

  /**
   * Narrows a submitted `scores` object to this template's items.
   *
   * The DTO cannot do this: it does not know the keys, and
   * `forbidNonWhitelisted` would reject every dynamic one. Every item of the
   * template must be present, each an integer MIN_SCORE..MAX_SCORE, and a key
   * the template does not have is a 400 rather than a silently ignored field.
   */
  validateScores(
    template: SheetTemplate,
    scores: Record<string, unknown>,
  ): { itemKey: string; score: number }[] {
    const keys = templateItemKeys(template);
    const known = new Set(keys);

    const unknown = Object.keys(scores).filter((key) => !known.has(key));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Evaluation sheet version ${template.version} has no item "${unknown[0]}". Submit the sheet this evaluation belongs to.`,
      );
    }

    const missing = keys.filter((key) => scores[key] === undefined);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Score every item before submitting — ${missing.length} still blank (${missing.join(', ')}).`,
      );
    }

    return keys.map((key) => {
      const score = Number(scores[key]);
      if (!Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) {
        throw new BadRequestException(
          `Evaluation item "${key}" must be an integer from ${MIN_SCORE} to ${MAX_SCORE}, received ${String(scores[key])}.`,
        );
      }
      return { itemKey: key, score };
    });
  }

  /* ---------------------------------------------------------------------
   * Writes — the draft, and only the draft
   * ------------------------------------------------------------------ */

  /**
   * Replaces the whole draft in one call — the repo's "whole sheet, not a
   * partial" convention, the same as `PATCH /supervisor/evaluations/:id`.
   *
   * Array order *is* the printed order. A section or item carrying a `key`
   * keeps it, so wording can be fixed without breaking the association a
   * future score has with it; anything without one is new and gets a generated
   * key. A key that is not already on the draft (or, when starting a draft from
   * the published sheet, on that) is a 400: silently accepting an invented key
   * would mint an item that looks like an old one.
   *
   * Creates the draft if there is none.
   */
  async replaceDraft(input: DraftInput) {
    const draft = await this.findByStatus('DRAFT');
    // Starting a fresh draft from the published sheet is the normal path, so
    // the published version's keys are legal input in that case.
    const keySource = draft ?? (await this.findByStatus('PUBLISHED'));

    const resolved = this.resolveDraft(input, keySource);

    await this.prisma.client.$transaction(async (tx) => {
      // Sequential, never Promise.all: an interactive transaction is one
      // connection and concurrent queries on it come back wrong.
      let templateId: string;
      if (draft) {
        this.assertMutable(draft);
        await tx.evaluationTemplate.update({
          where: { id: draft.id },
          data: { title: resolved.title },
        });
        templateId = draft.id;
      } else {
        const max = await tx.evaluationTemplate.aggregate({
          _max: { version: true },
        });
        const created = await tx.evaluationTemplate.create({
          data: {
            // Reserved now, recomputed at publish time — `version` is unique,
            // so the draft has to hold one from the moment it exists.
            version: (max._max.version ?? 0) + 1,
            status: 'DRAFT',
            title: resolved.title,
          },
          select: { id: true },
        });
        templateId = created.id;
      }

      // The draft's rows are referenced by nothing — an evaluation always
      // points at a published or archived version, and a score keys off
      // `itemKey`, not a row id — so replacing them wholesale is safe and
      // keeps this method one readable pass instead of a diff.
      await tx.evaluationTemplateItem.deleteMany({
        where: { section: { templateId } },
      });
      await tx.evaluationTemplateSection.deleteMany({ where: { templateId } });

      for (const [index, section] of resolved.sections.entries()) {
        const createdSection = await tx.evaluationTemplateSection.create({
          data: {
            templateId,
            key: section.key,
            label: section.label,
            order: index + 1,
          },
          select: { id: true },
        });
        await tx.evaluationTemplateItem.createMany({
          data: section.items.map((item, itemIndex) => ({
            sectionId: createdSection.id,
            key: item.key,
            label: item.label,
            order: itemIndex + 1,
          })),
        });
      }
    }, CASCADE_TRANSACTION_OPTIONS);

    const saved = await this.findByStatus('DRAFT');
    // Unreachable: the transaction above committed a draft.
    if (!saved) throw new NotFoundException('Draft evaluation sheet not found');
    return this.toSheet(saved);
  }

  /**
   * Publishes the draft: it takes the next version number, the outgoing
   * published version is archived, and from that moment both are immutable.
   */
  async publishDraft() {
    const draft = await this.findByStatus('DRAFT');
    if (!draft) {
      const published = await this.findByStatus('PUBLISHED');
      throw new ConflictException(
        published
          ? `There is no draft to publish. Version ${published.version} is published and cannot be edited — save a draft first.`
          : 'There is no draft evaluation sheet to publish.',
      );
    }
    this.assertMutable(draft);
    this.assertPublishable(draft);

    await this.prisma.client.$transaction(async (tx) => {
      const current = await tx.evaluationTemplate.findFirst({
        where: { status: 'PUBLISHED' },
        select: { id: true },
      });
      // The draft is already holding a reserved version, so the next number is
      // one past the highest of the *other* templates.
      const max = await tx.evaluationTemplate.aggregate({
        _max: { version: true },
        where: { id: { not: draft.id } },
      });

      if (current) {
        await tx.evaluationTemplate.update({
          where: { id: current.id },
          data: { status: 'ARCHIVED' },
        });
      }
      await tx.evaluationTemplate.update({
        where: { id: draft.id },
        data: {
          status: 'PUBLISHED',
          version: (max._max.version ?? 0) + 1,
          publishedAt: new Date(),
        },
      });
    }, CASCADE_TRANSACTION_OPTIONS);

    return this.toSheet(await this.getPublishedTemplate());
  }

  /** Throws the draft away. The published sheet is untouched. */
  async discardDraft() {
    const draft = await this.findByStatus('DRAFT');
    if (!draft) {
      throw new NotFoundException(
        'There is no draft evaluation sheet to discard.',
      );
    }
    this.assertMutable(draft);

    // A draft can never have evaluations on it — they are only ever written
    // against the published version — but a template that does must never be
    // deletable, so say it here as well as in the schema's onDelete: Restrict.
    const signed = await this.prisma.client.evaluation.count({
      where: { templateId: draft.id },
    });
    if (signed > 0) {
      throw new ConflictException(
        `This evaluation sheet has ${signed} evaluation(s) written on it and cannot be deleted.`,
      );
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.evaluationTemplateItem.deleteMany({
        where: { section: { templateId: draft.id } },
      });
      await tx.evaluationTemplateSection.deleteMany({
        where: { templateId: draft.id },
      });
      await tx.evaluationTemplate.delete({ where: { id: draft.id } });
    }, CASCADE_TRANSACTION_OPTIONS);

    return { id: draft.id, discarded: true };
  }

  /* ---------------------------------------------------------------------
   * Internals
   * ------------------------------------------------------------------ */

  // Not `async`: it hands the caller Prisma's promise directly, and an async
  // wrapper with nothing to await is a lint error.
  private findByStatus(status: 'DRAFT' | 'PUBLISHED') {
    return this.prisma.client.evaluationTemplate.findFirst({
      where: { status },
      select: TEMPLATE_SELECT,
      orderBy: { version: 'desc' },
    });
  }

  /** The immutability invariant, stated once and called before every write. */
  private assertMutable(template: { status: string; version: number }) {
    if (template.status !== 'DRAFT') {
      throw new ConflictException(
        `Evaluation sheet version ${template.version} is ${template.status} and cannot be changed. Evaluations signed on it must keep the wording they were signed with — edit the draft instead.`,
      );
    }
  }

  /** A sheet nobody can fill in is not publishable. */
  private assertPublishable(draft: {
    sections: { label: string; items: unknown[] }[];
  }) {
    if (draft.sections.length === 0) {
      throw new BadRequestException(
        'The draft has no sections. Add at least one section before publishing.',
      );
    }
    const empty = draft.sections.find((section) => section.items.length === 0);
    if (empty) {
      throw new BadRequestException(
        `Section "${empty.label}" has no items. Every section needs at least one before publishing.`,
      );
    }
  }

  /**
   * Validates the submitted sheet and fills in a key for everything new.
   *
   * Item keys are unique across the whole template, not just within a section:
   * `EvaluationScore` is keyed by `(evaluationId, itemKey)`, so two items
   * sharing a key in different sections would collide on a single evaluation.
   */
  private resolveDraft(
    input: DraftInput,
    keySource: { sections: { key: string; items: { key: string }[] }[] } | null,
  ): ResolvedDraft {
    const title = input.title.trim();
    if (title.length < MIN_TITLE || title.length > MAX_TITLE) {
      throw new BadRequestException(
        `The sheet title must be ${MIN_TITLE}-${MAX_TITLE} characters.`,
      );
    }

    if (input.sections.length === 0) {
      throw new BadRequestException('The sheet needs at least one section.');
    }
    if (input.sections.length > MAX_SECTIONS) {
      throw new BadRequestException(
        `A sheet may have at most ${MAX_SECTIONS} sections; this one has ${input.sections.length}.`,
      );
    }

    const knownSectionKeys = new Set(
      (keySource?.sections ?? []).map((section) => section.key),
    );
    const knownItemKeys = new Set(
      (keySource?.sections ?? []).flatMap((section) =>
        section.items.map((item) => item.key),
      ),
    );

    const usedSectionLabels = new Set<string>();
    const usedSectionKeys = new Set<string>();
    const usedItemKeys = new Set<string>();

    const sections = input.sections.map((section) => {
      const label = section.label.trim();
      if (label.length < MIN_LABEL || label.length > MAX_SECTION_LABEL) {
        throw new BadRequestException(
          `Section label "${section.label}" must be ${MIN_LABEL}-${MAX_SECTION_LABEL} characters.`,
        );
      }
      const labelKey = label.toLowerCase();
      if (usedSectionLabels.has(labelKey)) {
        throw new BadRequestException(
          `Two sections are both called "${label}". Section names must be unique.`,
        );
      }
      usedSectionLabels.add(labelKey);

      const key = this.keepOrMint(
        section.key,
        knownSectionKeys,
        usedSectionKeys,
        label,
        'section',
      );

      if (section.items.length === 0) {
        throw new BadRequestException(
          `Section "${label}" needs at least one item.`,
        );
      }
      if (section.items.length > MAX_ITEMS_PER_SECTION) {
        throw new BadRequestException(
          `Section "${label}" may have at most ${MAX_ITEMS_PER_SECTION} items; it has ${section.items.length}.`,
        );
      }

      const usedItemLabels = new Set<string>();
      const items = section.items.map((item) => {
        const itemLabel = item.label.trim();
        if (itemLabel.length < MIN_LABEL || itemLabel.length > MAX_ITEM_LABEL) {
          throw new BadRequestException(
            `Item label "${item.label}" in section "${label}" must be ${MIN_LABEL}-${MAX_ITEM_LABEL} characters.`,
          );
        }
        const itemLabelKey = itemLabel.toLowerCase();
        if (usedItemLabels.has(itemLabelKey)) {
          throw new BadRequestException(
            `Section "${label}" lists "${itemLabel}" twice. Items must be unique within a section.`,
          );
        }
        usedItemLabels.add(itemLabelKey);

        return {
          key: this.keepOrMint(
            item.key,
            knownItemKeys,
            usedItemKeys,
            itemLabel,
            'item',
          ),
          label: itemLabel,
        };
      });

      return { key, label, items };
    });

    return { title, sections };
  }

  /**
   * Keeps a key the client sent, or mints one for something new.
   *
   * A sent key must already exist on the draft (or the published sheet the
   * draft is being started from) and must not have been used twice in the same
   * submission.
   */
  private keepOrMint(
    sent: string | undefined,
    known: ReadonlySet<string>,
    used: Set<string>,
    label: string,
    what: 'section' | 'item',
  ): string {
    if (sent !== undefined) {
      if (!known.has(sent)) {
        throw new BadRequestException(
          `No ${what} with the key "${sent}" exists on the draft. Leave the key out to add a new ${what}.`,
        );
      }
      if (used.has(sent)) {
        throw new BadRequestException(
          `The ${what} key "${sent}" appears twice. Each ${what} may be listed once.`,
        );
      }
      used.add(sent);
      return sent;
    }

    const key = `${slugify(label) || what}_${randomBytes(3).toString('hex')}`;
    if (used.has(key)) {
      throw new BadRequestException(
        `Could not generate a unique key for "${label}". Try again.`,
      );
    }
    used.add(key);
    return key;
  }
}

/** A readable camel-ish key from a label: "Work Knowledge" -> "workKnowledge". */
function slugify(label: string): string {
  const words = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 6);
  if (words.length === 0) return '';
  return words
    .map((word, index) =>
      index === 0 ? word : word[0].toUpperCase() + word.slice(1),
    )
    .join('')
    .slice(0, 40);
}
