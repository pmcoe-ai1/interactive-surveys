import { prisma } from '@/lib/prisma';
import { QuestionType, ValidationRule, RatingStyle } from '@prisma/client';

export interface CreateQuestionInput {
  type: QuestionType;
  title: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  validation?: ValidationRule;
  charLimit?: number;
  minSelections?: number;
  maxSelections?: number;
  ratingStyle?: RatingStyle;
  ratingMax?: number;
  searchable?: boolean;
  allowOther?: boolean;
  buttonLabel?: string;
  ctaUrl?: string;
  options?: Array<{ text: string; order: number }>;
}

export interface UpdateQuestionInput extends Partial<CreateQuestionInput> {
  order?: number;
}

export const HIGH_QUESTION_WARNING_THRESHOLD = 12;

async function getNextOrder(surveyId: string): Promise<number> {
  const last = await prisma.question.findFirst({
    where: { surveyId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

export async function addQuestion(surveyId: string, userId: string, input: CreateQuestionInput) {
  // Verify survey ownership
  const survey = await prisma.survey.findFirst({ where: { id: surveyId, userId } });
  if (!survey) throw new Error('Survey not found');

  const order = await getNextOrder(surveyId);
  const totalQuestions = await prisma.question.count({ where: { surveyId } });

  const question = await prisma.question.create({
    data: {
      surveyId,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      required: input.required ?? false,
      order,
      placeholder: input.placeholder ?? null,
      validation: input.validation ?? 'none',
      charLimit: input.charLimit ?? null,
      minSelections: input.minSelections ?? null,
      maxSelections: input.maxSelections ?? null,
      ratingStyle: input.ratingStyle ?? null,
      ratingMax: input.ratingMax ?? 5,
      searchable: input.searchable ?? false,
      allowOther: input.allowOther ?? false,
      buttonLabel: input.buttonLabel ?? null,
      ctaUrl: input.ctaUrl ?? null,
      options: input.options
        ? {
            create: input.options.map((opt) => ({
              text: opt.text,
              order: opt.order,
            })),
          }
        : undefined,
    },
    include: { options: { orderBy: { order: 'asc' } } },
  });

  // Touch survey updatedAt
  await prisma.survey.update({ where: { id: surveyId }, data: {} });

  return {
    question,
    warning:
      totalQuestions >= HIGH_QUESTION_WARNING_THRESHOLD
        ? `Surveys with more than ${HIGH_QUESTION_WARNING_THRESHOLD} questions have lower completion rates`
        : null,
  };
}

export async function getQuestions(surveyId: string, userId: string) {
  const survey = await prisma.survey.findFirst({ where: { id: surveyId, userId } });
  if (!survey) throw new Error('Survey not found');

  return prisma.question.findMany({
    where: { surveyId },
    orderBy: { order: 'asc' },
    include: { options: { orderBy: { order: 'asc' } } },
  });
}

export async function updateQuestion(
  surveyId: string,
  questionId: string,
  userId: string,
  input: UpdateQuestionInput
) {
  // Verify survey ownership AND that the question belongs to this survey (D2.1.1, D2.1.3)
  const survey = await prisma.survey.findFirst({ where: { id: surveyId, userId } });
  if (!survey) throw new Error('Survey not found');

  const existing = await prisma.question.findFirst({ where: { id: questionId, surveyId } });
  if (!existing) throw new Error('Survey not found');

  const { options, ...rest } = input;

  const question = await prisma.question.update({
    where: { id: questionId },
    data: {
      ...rest,
      ...(options !== undefined
        ? {
            options: {
              deleteMany: {},
              create: options.map((opt) => ({ text: opt.text, order: opt.order })),
            },
          }
        : {}),
    },
    include: { options: { orderBy: { order: 'asc' } } },
  });

  await prisma.survey.update({ where: { id: surveyId }, data: {} });
  return question;
}

export async function deleteQuestion(surveyId: string, questionId: string, userId: string) {
  // Verify survey ownership AND that the question belongs to this survey (D2.1.1, D2.1.2)
  const survey = await prisma.survey.findFirst({ where: { id: surveyId, userId } });
  if (!survey) throw new Error('Survey not found');

  const existing = await prisma.question.findFirst({ where: { id: questionId, surveyId } });
  if (!existing) throw new Error('Survey not found');

  await prisma.question.delete({ where: { id: questionId } });

  // Re-order remaining questions
  const remaining = await prisma.question.findMany({
    where: { surveyId },
    orderBy: { order: 'asc' },
  });

  await Promise.all(
    remaining.map((q, idx) =>
      prisma.question.update({ where: { id: q.id }, data: { order: idx } })
    )
  );

  await prisma.survey.update({ where: { id: surveyId }, data: {} });
}

export async function duplicateQuestion(surveyId: string, questionId: string, userId: string) {
  const survey = await prisma.survey.findFirst({ where: { id: surveyId, userId } });
  if (!survey) throw new Error('Survey not found');

  const source = await prisma.question.findFirst({
    where: { id: questionId, surveyId },
    include: { options: { orderBy: { order: 'asc' } } },
  });
  if (!source) throw new Error('Question not found');

  const nextOrder = await getNextOrder(surveyId);

  const copy = await prisma.question.create({
    data: {
      surveyId,
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
      options: source.options.length > 0
        ? { create: source.options.map((o) => ({ text: o.text, order: o.order })) }
        : undefined,
    },
    include: { options: { orderBy: { order: 'asc' } } },
  });

  await prisma.survey.update({ where: { id: surveyId }, data: {} });
  return copy;
}

export async function reorderQuestions(
  surveyId: string,
  userId: string,
  orderedIds: string[]
) {
  const survey = await prisma.survey.findFirst({ where: { id: surveyId, userId } });
  if (!survey) throw new Error('Survey not found');

  await Promise.all(
    orderedIds.map((id, idx) =>
      prisma.question.update({ where: { id }, data: { order: idx } })
    )
  );

  await prisma.survey.update({ where: { id: surveyId }, data: {} });
}
