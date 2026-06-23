import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// Dependency-free sanitizer (runs in the browser): marked passes raw HTML through,
// and extracted text comes from arbitrary crawled pages, so we strip dangerous
// elements/attributes before inserting via dangerouslySetInnerHTML.
const DANGEROUS_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'LINK', 'META', 'BASE', 'SVG', 'MATH']);
function sanitizeHtml(html: string): string {
  if (typeof document === 'undefined') return ''; // never emit unsanitized HTML off-DOM
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_ELEMENT);
  const remove: Element[] = [];
  let node = walker.nextNode() as Element | null;
  while (node) {
    if (DANGEROUS_TAGS.has(node.tagName)) {
      remove.push(node);
    } else {
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase();
        const val = attr.value.replace(/\s+/g, '').toLowerCase();
        if (name.startsWith('on')) node.removeAttribute(attr.name);
        else if (name === 'href' && (val.startsWith('javascript:') || val.startsWith('data:'))) node.removeAttribute(attr.name);
        else if ((name === 'src' || name === 'xlink:href') && val.startsWith('javascript:')) node.removeAttribute(attr.name);
        else if ((name === 'src' || name === 'xlink:href') && val.startsWith('data:') && !val.startsWith('data:image/')) node.removeAttribute(attr.name);
      }
      // make external links safe to open
      if (node.tagName === 'A' && node.getAttribute('href')) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer nofollow'); }
    }
    node = walker.nextNode() as Element | null;
  }
  remove.forEach((n) => n.remove());
  return tpl.innerHTML;
}

export function renderMarkdown(src: string): string {
  try { return sanitizeHtml(marked.parse(src) as string); } catch { return escapeHtml(src || ''); }
}

// Strip Markdown/structure to clean prose for previews & snippets, so raw
// ###, **, and broken table pipes never leak into the UI.
export function toPlainText(src: string): string {
  if (!src) return '';
  return src
    // drop fenced code
    .replace(/```[\s\S]*?```/g, ' ')
    // table rows / separators -> spaces
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/\|/g, ' ')
    // headings, blockquotes, list markers
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // emphasis / inline code
    .replace(/(\*\*|__|\*|_|`)/g, '')
    // links/images -> keep text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    // separators
    .replace(/^\s*[-=]{3,}\s*$/gm, ' ')
    // collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
