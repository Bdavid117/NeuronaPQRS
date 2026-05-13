import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(`${API_URL}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  const { token } = await res.json();

  const response = NextResponse.json({ ok: true });
  response.cookies.set("pae_admin_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 horas
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
