import { prisma } from '@/lib/prisma';
import { SurveyStatus } from '@prisma/client';

export interface CreateSurveyInput {
  title: string;
  description?: string;
  userId: string;
}

export interface UpdateSurveyInput {
  title?: string;
  description?: string;
  status?: SurveyStatus;
  thankYouMessage?: string;
  redirectUrl?: string;
}

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

export async function createSurvey(input: CreateSurveyInput) {
  if (!input.title || !input.title.trim()) {
    throw new Error('Title is required');
  }

  const slug = generateSlug(input.title);

  return prisma.survey.create({
    data: {
      title: input.title.trim(),
      description: input.description ?? null,
      slug,
      userId: input.userId,
    },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: { options: { orderBy: { order: 'asc' } } },
      },
    },
  });
}

export async function getSurveyById(surveyId: string, userId: string) {
  return prisma.survey.findFirst({
    where: { id: surveyId, userId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: { options: { orderBy: { order: 'asc' } } },
      },
    },
  });
}

export async function getSurveyBySlug(slug: string) {
  return prisma.survey.findUnique({
    where: { slug },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: { options: { orderBy: { order: 'asc' } } },
      },
    },
  });
}

export async function getUserSurveys(userId: string) {
  return prisma.survey.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { responses: true } },
    },
  });
}

export async function updateSurvey(
  surveyId: string,
  userId: string,
  input: UpdateSurveyInput
) {
  const survey = await prisma.survey.findFirst({ where: { id: surveyId, userId } });
  if (!survey) throw new Error('Survey not found');

  return prisma.survey.update({
    where: { id: surveyId },
    data: input,
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: { options: { orderBy: { order: 'asc' } } },
      },
    },
  });
}

export async function deleteSurvey(surveyId: string, userId: string) {
  const survey = await prisma.survey.findFirst({ where: { id: surveyId, userId } });
  if (!survey) throw new Error('Survey not found');

  return prisma.survey.delete({ where: { id: surveyId } });
}
