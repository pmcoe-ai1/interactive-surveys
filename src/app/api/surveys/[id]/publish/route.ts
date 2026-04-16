import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { publishSurvey } from '@/services/survey.service';

interface Params {
  params: { id: string };
}

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const survey = await publishSurvey(params.id, session.user.id);
    return NextResponse.json(survey);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to publish survey';
    const status = message === 'Survey not found' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
