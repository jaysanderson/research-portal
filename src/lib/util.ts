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

// Deterministic gradient from a seed string — a pleasant placeholder/hero background
// when a resource has no thumbnail. Shared by the Library cards and the Answer Journey.
const GRADIENT_PALETTE: [string, string][] = [
  ['#2F31D8', '#4E56F5'], ['#0EA5E9', '#06B6D4'], ['#6366F1', '#8B5CF6'],
  ['#7C3AED', '#A855F7'], ['#171A54', '#2F31D8'], ['#EF6A4D', '#F0A81E'],
];
export function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const [a, b] = GRADIENT_PALETTE[h % GRADIENT_PALETTE.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

/** Escape HTML but keep Nuclia's <mark> highlight tags — for safe snippet rendering. */
export function sanitizeHighlight(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/&lt;mark&gt;/g, '<mark>').replace(/&lt;\/mark&gt;/g, '</mark>');
}

// Date helpers for "date added" display.
export function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 45) return 'just now';
  const m = s / 60; if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60; if (h < 24) return `${Math.floor(h)}h ago`;
  const days = h / 24; if (days < 30) return `${Math.floor(days)}d ago`;
  return formatDate(iso);
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
