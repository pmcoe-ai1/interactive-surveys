import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createResponse } from '@/services/response.service';

interface Params {
  params: { slug: string };
}

export async function POST(req: NextRequest, { params }: Params) {
  const survey = await prisma.survey.findUnique({ where: { slug: params.slug } });
  if (!survey) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
  }

  if (survey.status !== 'live' && survey.status !== 'draft') {
    return NextResponse.json({ error: 'Survey is closed' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const fingerprint = req.headers.get('x-browser-fingerprint') ?? body.fingerprint ?? null;

  // S5.3: capture the authenticated user if present (anonymous → null)
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  // D2.5: wrap in try/catch to return 500 on server errors instead of crashing
  try {
    const response = await createResponse(survey.id, fingerprint ?? undefined, userId);
    return NextResponse.json(response, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
