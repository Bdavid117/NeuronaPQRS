import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("pae_admin_token")?.value ?? "";

  if (!token) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo conectar con el servidor" },
      { status: 503 }
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: "Error obteniendo estadísticas" },
      { status: res.status }
    );
  }

  const data = await res.json() as Record<string, unknown>;
  return NextResponse.json(data);
}
