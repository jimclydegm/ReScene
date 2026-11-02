import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { judgeMode, assertJudgeRequest } from "@/lib/judge/config";
import { getAuth } from "@/lib/auth/server";

export default function proxy(request: NextRequest) {
  if (judgeMode()) {
    try {
      assertJudgeRequest(request);
      if (judgeMode() === "samples")
        return NextResponse.redirect(new URL("/demo", request.url));
      return NextResponse.next();
    } catch {
      return new NextResponse("Local request required", { status: 403 });
    }
  }
  return getAuth().middleware({ loginUrl: "/auth/sign-in" })(request);
}

export const config = { matcher: ["/dashboard/:path*", "/scenes/:path*"] };
