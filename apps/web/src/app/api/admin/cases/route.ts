import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("pae_admin_token")?.value ?? "";
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${API_URL}/admin/cases${searchParams ? "?" + searchParams : ""}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
