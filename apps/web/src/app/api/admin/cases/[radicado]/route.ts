import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ radicado: string }> }
) {
  const { radicado } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("pae_admin_token")?.value ?? "";

  let res: Response;
  try {
    res = await fetch(`${API_URL}/admin/cases/${radicado}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con el servidor" }, { status: 503 });
  }

  const data = await res.json().catch(() => ({ error: "Respuesta inválida" }));
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ radicado: string }> }
) {
  const { radicado } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("pae_admin_token")?.value ?? "";
  const body = await request.json();

  let res: Response;
  try {
    res = await fetch(`${API_URL}/admin/cases/${radicado}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con el servidor" }, { status: 503 });
  }

  const data = await res.json().catch(() => ({ error: "Respuesta inválida del servidor" }));
  return NextResponse.json(data, { status: res.status });
}
