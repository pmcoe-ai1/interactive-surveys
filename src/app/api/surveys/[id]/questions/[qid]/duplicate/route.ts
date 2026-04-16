import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { duplicateQuestion } from '@/services/question.service';

interface Params {
  params: { id: string; qid: string };
}

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const question = await duplicateQuestion(params.id, params.qid, session.user.id);
    return NextResponse.json(question, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to duplicate question';
    const status = message === 'Survey not found' || message === 'Question not found' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
