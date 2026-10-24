/** First-touch visit stored in a first-party cookie, then copied onto the profile at signup. */

export const ACQ_COOKIE = "bb_acq";
export const ACQ_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

const MAX_REFERRER = 300;
const MAX_LANDING = 300;
const MAX_UTM = 80;

export type Acquisition = {
  referrer: string | null;
  landing: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  first_seen_at: string;
};

export function cleanUtm(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, MAX_UTM);
  return trimmed || null;
}

function splitHost(host: string): { name: string; port: string } {
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    const name = end === -1 ? host : host.slice(1, end);
    const rest = end === -1 ? "" : host.slice(end + 1);
    return { name, port: rest.startsWith(":") ? rest.slice(1) : "" };
  }
  const idx = host.lastIndexOf(":");
  if (idx > -1 && /^\d+$/.test(host.slice(idx + 1))) {
    return { name: host.slice(0, idx), port: host.slice(idx + 1) };
  }
  return { name: host, port: "" };
}

function sameSite(a: string, b: string): boolean {
  const left = splitHost(a.toLowerCase());
  const right = splitHost(b.toLowerCase());
  if (left.port !== right.port) return false;
  const norm = (name: string) => {
    if (name === "localhost" || name === "127.0.0.1" || name === "::1") return "loopback";
    return name.startsWith("www.") ? name.slice(4) : name;
  };
  return norm(left.name) === norm(right.name);
}

/** External http(s) referrer without query or hash. Same-site navigations return null. */
export function externalReferrer(referrer: string | null, host: string): string | null {
  if (!referrer) return null;
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (sameSite(url.host, host)) return null;
  const stored = url.pathname === "/" ? url.origin : `${url.origin}${url.pathname}`;
  return stored.slice(0, MAX_REFERRER);
}

export function serializeAcquisition(acq: Acquisition): string {
  return JSON.stringify(acq);
}

export function parseAcquisition(raw: string): Acquisition | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    try {
      data = JSON.parse(decodeURIComponent(raw));
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const landing = typeof row.landing === "string" ? row.landing.slice(0, MAX_LANDING) : "";
  if (!landing.startsWith("/")) return null;
  const first = typeof row.first_seen_at === "string" ? row.first_seen_at.slice(0, 40) : "";
  if (!/^\d{4}-\d{2}-\d{2}T/.test(first)) return null;

  const referrer =
    typeof row.referrer === "string" ? externalReferrer(row.referrer, "invalid.local") : null;

  return {
    referrer,
    landing,
    utm_source: cleanUtm(typeof row.utm_source === "string" ? row.utm_source : null),
    utm_medium: cleanUtm(typeof row.utm_medium === "string" ? row.utm_medium : null),
    utm_campaign: cleanUtm(typeof row.utm_campaign === "string" ? row.utm_campaign : null),
    utm_term: cleanUtm(typeof row.utm_term === "string" ? row.utm_term : null),
    utm_content: cleanUtm(typeof row.utm_content === "string" ? row.utm_content : null),
    first_seen_at: first,
  };
}

export function acquisitionMetadata(acq: Acquisition | null): Record<string, string> {
  if (!acq) return {};
  const fields: Record<string, string | null> = {
    acq_referrer: acq.referrer,
    acq_landing: acq.landing,
    acq_utm_source: acq.utm_source,
    acq_utm_medium: acq.utm_medium,
    acq_utm_campaign: acq.utm_campaign,
    acq_utm_term: acq.utm_term,
    acq_utm_content: acq.utm_content,
    acq_first_seen_at: acq.first_seen_at,
  };
  return Object.fromEntries(
    Object.entries(fields).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

function readCookieValue(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
  }
  return null;
}

export function readAcquisitionCookie(): Acquisition | null {
  if (typeof document === "undefined") return null;
  const raw = readCookieValue(document.cookie, ACQ_COOKIE);
  if (!raw) return null;
  return parseAcquisition(raw);
}
