import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addQuestion, getQuestions, reorderQuestions } from '@/services/question.service';
import { QuestionType } from '@prisma/client';

interface Params {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const questions = await getQuestions(params.id, session.user.id);
    return NextResponse.json(questions);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch questions';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  if (!body.type) {
    return NextResponse.json({ error: 'Question type is required' }, { status: 400 });
  }

  const validTypes = Object.values(QuestionType);
  if (!validTypes.includes(body.type)) {
    return NextResponse.json({ error: `Invalid question type: ${body.type}` }, { status: 400 });
  }

  try {
    const result = await addQuestion(params.id, session.user.id, {
      type: body.type,
      title: body.title || 'Untitled question',
      description: body.description,
      required: body.required,
      placeholder: body.placeholder,
      validation: body.validation,
      charLimit: body.charLimit,
      minSelections: body.minSelections,
      maxSelections: body.maxSelections,
      ratingMax: body.ratingMax,
      allowOther: body.allowOther,
      buttonLabel: body.buttonLabel,
      ctaUrl: body.ctaUrl,
      options: body.options,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add question';
    const status = message === 'Survey not found' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  // Reorder questions
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  if (!Array.isArray(body.orderedIds)) {
    return NextResponse.json({ error: 'orderedIds array is required' }, { status: 400 });
  }

  try {
    await reorderQuestions(params.id, session.user.id, body.orderedIds);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reorder questions';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
