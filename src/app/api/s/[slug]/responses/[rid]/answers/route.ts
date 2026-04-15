import { NextRequest, NextResponse } from 'next/server';
import { saveAnswer } from '@/services/response.service';

interface Params {
  params: { slug: string; rid: string };
}

export async function POST(req: NextRequest, { params }: Params) {
  const body = await req.json();

  if (!body.questionId) {
    return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
  }

  try {
    const answer = await saveAnswer(params.rid, body.questionId, {
      value: typeof body.value === 'string' ? body.value : null,
      selectedOptions: Array.isArray(body.selectedOptions) ? body.selectedOptions : null,
      numericValue: typeof body.numericValue === 'number' ? body.numericValue : null,
      dateValue: body.dateValue ? new Date(body.dateValue) : null,
    });

    return NextResponse.json(answer, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save answer';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
