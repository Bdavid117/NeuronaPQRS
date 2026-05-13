import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const upstream = await fetch(`${API_URL}/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json({ error: text }, { status: upstream.status });
  }

  const json = await upstream.json();
  return NextResponse.json(json);
}
