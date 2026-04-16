/**
 * Self-contained Express application used in Sprint 2 integration tests.
 *
 * All business logic mirrors the Next.js API routes and service files
 * exactly (src/services/*, src/app/api/**) so tests validate real behaviour
 * without importing from src/ (which uses @/ path aliases incompatible with
 * the plain-Node Jest runtime).
 *
 * Auth is replaced by a simple `x-user-id` header so tests stay stateless.
 */

import express, { Express, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

// ─── helpers ────────────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-') +
    '-' +
    Math.random().toString(36).slice(2, 8)
  );
}

async function getNextOrder(prisma: PrismaClient, surveyId: string): Promise<number> {
  const last = await prisma.question.findFirst({
    where: { surveyId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

function getUserId(req: Request): string | null {
  return (req.headers['x-user-id'] as string) ?? null;
}

function requireAuth(req: Request, res: Response): string | null {
  const uid = getUserId(req);
  if (!uid) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return uid;
}

// ─── app factory ────────────────────────────────────────────────────────────

export function buildApp(prisma: PrismaClient): Express {
  const app = express();
  app.use(express.json());

  // ── surveys ──────────────────────────────────────────────────────────────

  /** POST /api/surveys — create survey */
  app.post('/api/surveys', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { title, description } = req.body as { title: string; description?: string };
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const survey = await prisma.survey.create({
      data: {
        title: title.trim(),
        description: description ?? null,
        slug: generateSlug(title),
        userId,
      },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
      },
    });

    return res.status(201).json(survey);
  });

  /** GET /api/surveys/:id — get one survey (owner only) */
  app.get('/api/surveys/:id', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const survey = await prisma.survey.findFirst({
      where: { id: req.params.id, userId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
      },
    });

    if (!survey) return res.status(404).json({ error: 'Survey not found' });
    return res.json(survey);
  });

  /** POST /api/surveys/:id/publish — make survey live */
  app.post('/api/surveys/:id/publish', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const survey = await prisma.survey.findFirst({
      where: { id: req.params.id, userId },
      include: { _count: { select: { questions: true } } },
    });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    if (survey._count.questions === 0) {
      return res
        .status(400)
        .json({ error: 'Add at least one question before publishing' });
    }

    const updated = await prisma.survey.update({
      where: { id: req.params.id },
      data: { status: 'live' },
    });

    return res.json(updated);
  });

  // ── questions ────────────────────────────────────────────────────────────

  type OptionInput = { text: string; order: number };

  /** GET /api/surveys/:id/questions — list questions */
  app.get('/api/surveys/:id/questions', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const survey = await prisma.survey.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    const questions = await prisma.question.findMany({
      where: { surveyId: req.params.id },
      orderBy: { order: 'asc' },
      include: { options: { orderBy: { order: 'asc' } } },
    });

    return res.json(questions);
  });

  /** POST /api/surveys/:id/questions — add question */
  app.post('/api/surveys/:id/questions', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const survey = await prisma.survey.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    const body = req.body;
    if (!body.type) {
      return res.status(400).json({ error: 'Question type is required' });
    }

    const order = await getNextOrder(prisma, req.params.id);
    const totalBefore = await prisma.question.count({
      where: { surveyId: req.params.id },
    });

    const question = await prisma.question.create({
      data: {
        surveyId: req.params.id,
        type: body.type,
        title: body.title ?? 'Untitled question',
        description: body.description ?? null,
        required: body.required ?? false,
        order,
        placeholder: body.placeholder ?? null,
        validation: body.validation ?? 'none',
        charLimit: body.charLimit ?? null,
        minSelections: body.minSelections ?? null,
        maxSelections: body.maxSelections ?? null,
        ratingStyle: body.ratingStyle ?? null,
        ratingMax: body.ratingMax ?? 5,
        searchable: body.searchable ?? false,
        allowOther: body.allowOther ?? false,
        buttonLabel: body.buttonLabel ?? null,
        ctaUrl: body.ctaUrl ?? null,
        options:
          Array.isArray(body.options) && body.options.length > 0
            ? {
                create: (body.options as OptionInput[]).map((o) => ({
                  text: o.text,
                  order: o.order,
                })),
              }
            : undefined,
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });

    await prisma.survey.update({ where: { id: req.params.id }, data: {} });

    const HIGH = 12;
    return res.status(201).json({
      question,
      warning:
        totalBefore >= HIGH
          ? `Surveys with more than ${HIGH} questions have lower completion rates`
          : null,
    });
  });

  /** PATCH /api/surveys/:id/questions/:qid — update question */
  app.patch('/api/surveys/:id/questions/:qid', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const survey = await prisma.survey.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    const { options, ...rest } = req.body as { options?: OptionInput[] } & Record<string, unknown>;

    try {
      const question = await prisma.question.update({
        where: { id: req.params.qid },
        data: {
          ...rest,
          ...(options !== undefined
            ? {
                options: {
                  deleteMany: {},
                  create: options.map((o) => ({ text: o.text, order: o.order })),
                },
              }
            : {}),
        },
        include: { options: { orderBy: { order: 'asc' } } },
      });

      await prisma.survey.update({ where: { id: req.params.id }, data: {} });
      return res.json(question);
    } catch {
      return res.status(400).json({ error: 'Failed to update question' });
    }
  });

  /** DELETE /api/surveys/:id/questions/:qid — delete question */
  app.delete('/api/surveys/:id/questions/:qid', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const survey = await prisma.survey.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    await prisma.question.delete({ where: { id: req.params.qid } });

    // Re-index remaining questions (mirrors deleteQuestion service)
    const remaining = await prisma.question.findMany({
      where: { surveyId: req.params.id },
      orderBy: { order: 'asc' },
    });
    await Promise.all(
      remaining.map((q, idx) =>
        prisma.question.update({ where: { id: q.id }, data: { order: idx } })
      )
    );

    await prisma.survey.update({ where: { id: req.params.id }, data: {} });
    return res.json({ success: true });
  });

  /** POST /api/surveys/:id/questions/:qid/duplicate — duplicate question (no logic rules) */
  app.post('/api/surveys/:id/questions/:qid/duplicate', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const survey = await prisma.survey.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    const source = await prisma.question.findFirst({
      where: { id: req.params.qid, surveyId: req.params.id },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    if (!source) return res.status(404).json({ error: 'Question not found' });

    const nextOrder = await getNextOrder(prisma, req.params.id);

    const copy = await prisma.question.create({
      data: {
        surveyId: req.params.id,
        type: source.type,
        title: `${source.title} (copy)`,
        description: source.description,
        required: source.required,
        order: nextOrder,
        placeholder: source.placeholder,
        validation: source.validation,
        charLimit: source.charLimit,
        minSelections: source.minSelections,
        maxSelections: source.maxSelections,
        ratingStyle: source.ratingStyle,
        ratingMax: source.ratingMax,
        searchable: source.searchable,
        allowOther: source.allowOther,
        buttonLabel: source.buttonLabel,
        ctaUrl: source.ctaUrl,
        options:
          source.options.length > 0
            ? { create: source.options.map((o) => ({ text: o.text, order: o.order })) }
            : undefined,
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });

    await prisma.survey.update({ where: { id: req.params.id }, data: {} });
    return res.status(201).json(copy);
  });

  /** PUT /api/surveys/:id/questions — reorder questions */
  app.put('/api/surveys/:id/questions', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const survey = await prisma.survey.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    const { orderedIds } = req.body as { orderedIds: string[] };
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds array is required' });
    }

    await Promise.all(
      orderedIds.map((id, idx) =>
        prisma.question.update({ where: { id }, data: { order: idx } })
      )
    );

    await prisma.survey.update({ where: { id: req.params.id }, data: {} });
    return res.json({ success: true });
  });

  // ── public survey (respondent) ────────────────────────────────────────────

  /** GET /api/s/:slug — fetch survey by slug (public) */
  app.get('/api/s/:slug', async (req, res) => {
    const survey = await prisma.survey.findUnique({
      where: { slug: req.params.slug },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
      },
    });

    if (!survey) return res.status(404).json({ error: 'Survey not found' });
    return res.json(survey);
  });

  /** POST /api/s/:slug/responses — start a response session */
  app.post('/api/s/:slug/responses', async (req, res) => {
    const survey = await prisma.survey.findUnique({
      where: { slug: req.params.slug },
    });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    if (survey.status !== 'live' && survey.status !== 'draft') {
      return res.status(403).json({ error: 'Survey is closed' });
    }

    const fingerprint =
      (req.headers['x-browser-fingerprint'] as string) ??
      (req.body as { fingerprint?: string })?.fingerprint ??
      null;

    const response = await prisma.response.create({
      data: {
        surveyId: survey.id,
        browserFingerprint: fingerprint,
        startedAt: new Date(),
      },
    });

    return res.status(201).json(response);
  });

  /** POST /api/s/:slug/responses/:rid/answers — save one answer */
  app.post('/api/s/:slug/responses/:rid/answers', async (req, res) => {
    const body = req.body as {
      questionId?: string;
      value?: unknown;
      selectedOptions?: unknown;
      numericValue?: unknown;
      dateValue?: unknown;
    };

    if (!body.questionId) {
      return res.status(400).json({ error: 'questionId is required' });
    }

    try {
      const answer = await prisma.answer.create({
        data: {
          responseId: req.params.rid,
          questionId: body.questionId,
          value: typeof body.value === 'string' ? body.value : null,
          selectedOptions: Array.isArray(body.selectedOptions)
            ? (body.selectedOptions as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          numericValue: typeof body.numericValue === 'number' ? body.numericValue : null,
          dateValue: typeof body.dateValue === 'string' ? new Date(body.dateValue) : null,
        },
      });

      return res.status(201).json(answer);
    } catch {
      return res.status(400).json({ error: 'Failed to save answer' });
    }
  });

  /** POST /api/s/:slug/responses/:rid/complete — mark response complete */
  app.post('/api/s/:slug/responses/:rid/complete', async (req, res) => {
    try {
      const response = await prisma.response.findUnique({
        where: { id: req.params.rid },
        select: { startedAt: true, surveyId: true },
      });

      if (!response) {
        return res.status(400).json({ error: 'Response not found' });
      }

      const completionTimeSeconds = Math.round(
        (Date.now() - response.startedAt.getTime()) / 1000
      );

      await prisma.response.update({
        where: { id: req.params.rid },
        data: {
          status: 'complete',
          completedAt: new Date(),
          completionTimeSeconds,
        },
      });

      await prisma.survey.update({
        where: { id: response.surveyId },
        data: { responseCount: { increment: 1 } },
      });

      return res.json({ success: true });
    } catch {
      return res.status(400).json({ error: 'Failed to complete response' });
    }
  });

  return app;
}
