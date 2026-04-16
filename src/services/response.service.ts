import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function createResponse(
  surveyId: string,
  browserFingerprint?: string,
  userId?: string | null
) {
  return prisma.response.create({
    data: {
      surveyId,
      browserFingerprint: browserFingerprint ?? null,
      startedAt: new Date(),
      userId: userId ?? null,
    },
  });
}

export async function saveAnswer(
  responseId: string,
  questionId: string,
  data: {
    value?: string | null;
    selectedOptions?: Prisma.InputJsonValue | null;
    numericValue?: number | null;
    dateValue?: Date | null;
  }
) {
  // D2.4: verify response exists so we can return 404 vs 400
  const response = await prisma.response.findUnique({ where: { id: responseId } });
  if (!response) throw new Error('Response not found');

  return prisma.answer.create({
    data: {
      responseId,
      questionId,
      value: data.value ?? null,
      selectedOptions: data.selectedOptions ?? Prisma.JsonNull,
      numericValue: data.numericValue ?? null,
      dateValue: data.dateValue ?? null,
    },
  });
}

export async function completeResponse(responseId: string) {
  const response = await prisma.response.findUnique({
    where: { id: responseId },
    select: { startedAt: true, surveyId: true },
  });

  if (!response) throw new Error('Response not found');

  const completionTimeSeconds = Math.round(
    (Date.now() - response.startedAt.getTime()) / 1000
  );

  await prisma.response.update({
    where: { id: responseId },
    data: {
      status: 'complete',
      completedAt: new Date(),
      completionTimeSeconds,
    },
  });

  // Increment survey response count
  await prisma.survey.update({
    where: { id: response.surveyId },
    data: { responseCount: { increment: 1 } },
  });
}
