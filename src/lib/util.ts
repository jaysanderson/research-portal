// User-facing error text — never leak raw status codes, API paths, or stack detail.
export function friendlyError(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  console.error('[research-portal]', e);
  const s = String(e);
  if (/\b(401|403)\b/.test(s)) return 'Access was denied for this Knowledge Box.';
  if (/\b(404)\b/.test(s)) return 'The requested resource was not found.';
  if (/\b(412|422|400)\b/.test(s) && /token|json|max_tokens/i.test(s)) return 'The request was too large to generate. Try a narrower or simpler query.';
  if (/\b(429)\b/.test(s)) return 'Rate limit reached — please wait a moment and retry.';
  if (/\b(5\d\d|502|503|504)\b/.test(s)) return 'The service is temporarily unavailable. Please try again shortly.';
  if (/abort/i.test(s)) return 'Request cancelled.';
  return fallback;
}

// Drop obvious web boilerplate (cookie banners, nav chrome) from displayed
// extracted text. Conservative: only removes short lines that clearly match.
const BOILERPLATE = /(we use cookies|this (website|site) uses cookies|cookie[s]? (policy|settings|preferences|notice|consent|notification)|manage (cookies|preferences|consent)|your privacy|privacy (policy|preferences|center)|terms of (use|service)|accept (all|cookies)|only necessary|reject all|allow all|got it|skip to (main )?content|skip to navigation|toggle (navigation|menu)|main (navigation|menu)|subscribe (to|now)|newsletter|sign in|sign up|log ?in|register|©|copyright|all rights reserved|back to top|share this|follow us|enable javascript|change your preferences|do not sell)/i;
export function stripBoilerplate(text?: string): string {
  if (!text) return '';
  return text
    .split('\n')
    .filter((line) => { const t = line.trim(); return !(t.length < 120 && BOILERPLATE.test(t)); })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Some resources arrive with a raw URL as their title (e.g. a storage link).
// Render a readable name instead — and avoid exposing storage bucket paths.
export function cleanTitle(title?: string, fallback = 'Untitled'): string {
  const t = (title || '').trim();
  if (!t) return fallback;
  if (!/^https?:\/\//i.test(t)) return t;
  try {
    const u = new URL(t);
    const seg = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
    const name = seg.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    return name || u.hostname.replace(/^www\./, '');
  } catch { return fallback; }
}
