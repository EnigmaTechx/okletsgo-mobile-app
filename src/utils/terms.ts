export interface TermsSection {
  heading: string;
  body: string;
}

/**
 * Split a markdown document into sections at each "## " heading, the way
 * the Ionic Terms page did, so each section can be a collapsible row.
 * Text before the first heading is dropped (the page shows the effective
 * date itself). Returns [] when the document has no level-2 headings, in
 * which case the caller renders the whole document in one piece.
 */
export function parseMarkdownSections(markdown: string): TermsSection[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: TermsSection[] = [];
  let current: TermsSection | null = null;
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (current) sections.push(current);
      current = { heading: m[1], body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current) sections.push(current);
  return sections.map((s) => ({ ...s, body: s.body.trim() }));
}
