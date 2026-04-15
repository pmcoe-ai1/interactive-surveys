import { NextRequest, NextResponse } from 'next/server';
import { completeResponse } from '@/services/response.service';

interface Params {
  params: { slug: string; rid: string };
}

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    await completeResponse(params.rid);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to complete response';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
