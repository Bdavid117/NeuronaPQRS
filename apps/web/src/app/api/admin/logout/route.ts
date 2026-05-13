import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const url = new URL("/admin/login", request.url);
  const response = NextResponse.redirect(url);
  response.cookies.set("pae_admin_token", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return response;
}
