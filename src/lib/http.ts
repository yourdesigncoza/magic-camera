import { NextResponse } from 'next/server';

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function jsonOk(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status });
}
