import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateQuestion, deleteQuestion } from '@/services/question.service';

interface Params {
  params: { id: string; qid: string };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  try {
    const question = await updateQuestion(params.id, params.qid, session.user.id, body);
    return NextResponse.json(question);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update question';
    const status = message === 'Survey not found' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await deleteQuestion(params.id, params.qid, session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete question';
    const status = message === 'Survey not found' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
