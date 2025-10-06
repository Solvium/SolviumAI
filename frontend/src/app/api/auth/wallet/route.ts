import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  return NextResponse.json(
    {
      error: "Wallet authentication is not currently enabled",
      message: "This feature is disabled in the current version",
    },
    { status: 501 }
  );
}
