import type { ComparisonOut, BriefingOut } from './schemas';
import type { Citation } from './nuclia';

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function copyText(text: string): Promise<void> {
  return navigator.clipboard?.writeText(text) ?? Promise.reject();
}

const csvCell = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;

export function matrixToCsv(out: ComparisonOut): string {
  const head = ['Option', ...out.dimensions].map(csvCell).join(',');
  const rows = out.vendors.map((v) => [v.name, ...out.dimensions.map((d) => v.ratings.find((r) => r.dimension.toLowerCase() === d.toLowerCase())?.assessment || '')].map(csvCell).join(','));
  return [head, ...rows].join('\n');
}

export function matrixToMarkdown(out: ComparisonOut): string {
  const head = `| Option | ${out.dimensions.join(' | ')} |`;
  const sep = `| --- | ${out.dimensions.map(() => '---').join(' | ')} |`;
  const rows = out.vendors.map((v) => `| ${v.name} | ${out.dimensions.map((d) => (v.ratings.find((r) => r.dimension.toLowerCase() === d.toLowerCase())?.assessment || '—').replace(/\|/g, '\\|')).join(' | ')} |`);
  return [head, sep, ...rows].join('\n');
}

export function briefingToMarkdown(out: BriefingOut, cites: Citation[] = []): string {
  const parts = [`# ${out.title}`, '', `> ${out.executive_summary}`, ''];
  for (const s of out.sections) parts.push(`## ${s.heading}`, '', s.content, '');
  if (out.key_takeaways?.length) { parts.push('## Key takeaways', ''); for (const k of out.key_takeaways) parts.push(`- ${k}`); parts.push(''); }
  if (cites.length) { parts.push('## Sources', ''); cites.forEach((c, i) => parts.push(`${i + 1}. ${c.title}${c.url ? ` — ${c.url}` : ''}`)); }
  return parts.join('\n');
}

export function downloadCsv(name: string, csv: string) { download(name, csv, 'text/csv;charset=utf-8'); }
export function downloadMarkdown(name: string, md: string) { download(name, md, 'text/markdown;charset=utf-8'); }

/** Open a clean print window (user picks "Save as PDF"). */
export function printDocument(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'width=820,height=1000');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    body{font:14px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a1f30;max-width:720px;margin:40px auto;padding:0 24px}
    h1{font-size:26px;letter-spacing:-.02em} h2{font-size:18px;margin-top:1.6em} h3{font-size:15px}
    table{border-collapse:collapse;width:100%;font-size:12.5px;margin:12px 0} th,td{border:1px solid #d9deea;padding:7px 10px;text-align:left;vertical-align:top} th{background:#f2f4fb}
    blockquote{background:#eef1ff;border-radius:8px;padding:12px 16px;margin:12px 0;color:#333} .src{color:#666;font-size:12px}
  </style></head><body>${bodyHtml}</body></html>`);
  w.document.close(); w.focus();
  setTimeout(() => w.print(), 300);
}
