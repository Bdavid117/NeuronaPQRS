import { NextRequest } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  const form = await request.formData();

  const upstream = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: form,
  });

  const data = await upstream.json();
  return Response.json(data, { status: upstream.status });
}
