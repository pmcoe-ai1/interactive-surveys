import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSurvey, getUserSurveys } from '@/services/survey.service';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const surveys = await getUserSurveys(session.user.id);
  return NextResponse.json(surveys);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  try {
    const survey = await createSurvey({
      title: body.title,
      description: body.description,
      userId: session.user.id,
    });
    return NextResponse.json(survey, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create survey';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
