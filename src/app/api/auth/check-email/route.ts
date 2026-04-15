import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ exists: false });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, authProvider: true },
  });

  if (!user) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({ exists: true, provider: user.authProvider });
}
