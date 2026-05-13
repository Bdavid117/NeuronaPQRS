import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ radicado: string }> }
) {
  const { radicado } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("pae_admin_token")?.value ?? "";
  const body = await request.json();

  const res = await fetch(`${API_URL}/admin/cases/${radicado}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
