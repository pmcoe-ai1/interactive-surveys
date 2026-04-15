import { NextRequest, NextResponse } from 'next/server';
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

  const response = await createResponse(survey.id, fingerprint ?? undefined);
  return NextResponse.json(response, { status: 201 });
}
