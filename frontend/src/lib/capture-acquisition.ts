import { NextResponse, type NextRequest } from "next/server";
import {
  ACQ_COOKIE,
  ACQ_MAX_AGE_SECONDS,
  cleanUtm,
  externalReferrer,
  serializeAcquisition,
  type Acquisition,
} from "@/lib/acquisition";

const SKIP_EXACT = new Set(["/robots.txt", "/sitemap.xml", "/llms.txt"]);

function shouldCapture(request: NextRequest): boolean {
  if (request.method !== "GET") return false;

  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/")) return false;
  if (SKIP_EXACT.has(path)) return false;
  if (path.startsWith("/opengraph-image") || path.startsWith("/twitter-image")) return false;

  if (request.headers.get("next-router-prefetch") === "1") return false;
  const purpose = `${request.headers.get("purpose") ?? ""} ${request.headers.get("sec-purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch")) return false;

  const dest = request.headers.get("sec-fetch-dest");
  if (dest && dest !== "document") return false;
  if (dest !== "document") {
    const accept = request.headers.get("accept") ?? "";
    if (!accept.includes("text/html")) return false;
  }
  return true;
}

function buildAcquisition(request: NextRequest): Acquisition {
  const params = request.nextUrl.searchParams;
  const landing = `${request.nextUrl.pathname}${request.nextUrl.search}`.slice(0, 300);
  return {
    referrer: externalReferrer(
      request.headers.get("referer"),
      request.headers.get("host") ?? request.nextUrl.host
    ),
    landing,
    utm_source: cleanUtm(params.get("utm_source")),
    utm_medium: cleanUtm(params.get("utm_medium")),
    utm_campaign: cleanUtm(params.get("utm_campaign")),
    utm_term: cleanUtm(params.get("utm_term")),
    utm_content: cleanUtm(params.get("utm_content")),
    first_seen_at: new Date().toISOString(),
  };
}

/** Set the first-touch cookie once. Later visits leave the existing cookie alone. */
export function attachAcquisition(request: NextRequest, response: NextResponse): NextResponse {
  if (request.cookies.get(ACQ_COOKIE)) return response;
  if (!shouldCapture(request)) return response;

  response.cookies.set(ACQ_COOKIE, serializeAcquisition(buildAcquisition(request)), {
    path: "/",
    maxAge: ACQ_MAX_AGE_SECONDS,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    httpOnly: false,
  });
  return response;
}
