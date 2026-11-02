import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // Reviewer playback can run beside the authoring server without sharing locks
  // or letting a production build remove its development cache.
  distDir: ["samples", "live"].includes(process.env.RESCENE_JUDGE_MODE ?? "") ? ".judge/next" : ".next",
  poweredByHeader: false,
  outputFileTracingIncludes: { "/*": ["./public/samples/**/*.webp"] },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" }
      ]
    }, {source:"/s/:path*",headers:[{key:"Cache-Control",value:"private, no-store, max-age=0"},{key:"Referrer-Policy",value:"no-referrer"},{key:"X-Robots-Tag",value:"noindex, nofollow"}]}, {source:"/api/shared/:path*",headers:[{key:"Referrer-Policy",value:"no-referrer"},{key:"X-Robots-Tag",value:"noindex, nofollow"}]}];
  }
};

export default withWorkflow(nextConfig);
