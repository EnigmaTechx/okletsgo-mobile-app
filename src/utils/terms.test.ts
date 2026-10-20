import { BUILT_IN_TERMS_MARKDOWN } from "../content/termsOfUse";
import { parseMarkdownSections } from "./terms";

describe("parseMarkdownSections", () => {
  it("splits at level-2 headings and trims bodies", () => {
    const md = "intro\n\n## One\n\nfirst\n\n## Two\n- a\n- b\n";
    expect(parseMarkdownSections(md)).toEqual([
      { heading: "One", body: "first" },
      { heading: "Two", body: "- a\n- b" },
    ]);
  });

  it("returns nothing for a document without level-2 headings", () => {
    expect(parseMarkdownSections("# Title\n\nJust prose.")).toEqual([]);
  });

  it("parses the built-in terms into the seventeen numbered sections", () => {
    const sections = parseMarkdownSections(BUILT_IN_TERMS_MARKDOWN);
    expect(sections).toHaveLength(17);
    expect(sections[0].heading).toBe("1. Acceptance of Terms");
    expect(sections[16].heading).toBe("17. Contact");
    expect(sections.every((s) => s.body.length > 20)).toBe(true);
  });
});
