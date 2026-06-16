import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

export function renderMarkdown(src: string): string {
  try { return marked.parse(src) as string; } catch { return src; }
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
