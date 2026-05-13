import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con el servidor" }, { status: 503 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  const data = await res.json() as Record<string, unknown>;
  const token = data.token;
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "Respuesta inválida del servidor" }, { status: 502 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("pae_admin_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
