import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSurveyById, updateSurvey, deleteSurvey } from '@/services/survey.service';

interface Params {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const survey = await getSurveyById(params.id, session.user.id);
  if (!survey) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
  }

  return NextResponse.json(survey);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  try {
    const survey = await updateSurvey(params.id, session.user.id, body);
    return NextResponse.json(survey);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update survey';
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
    await deleteSurvey(params.id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete survey';
    const status = message === 'Survey not found' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
