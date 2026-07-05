import { describe, expect, it } from "vitest";
import { parseDocument, serializeDocument, toWikilink, wikiTarget } from "./frontmatter";

describe("parseDocument", () => {
  it("splits frontmatter and body", () => {
    const raw = "---\ntype: task\ntitle: Buy milk\n---\n\nGet 2%.";
    const { frontmatter, body } = parseDocument(raw);
    expect(frontmatter).toEqual({ type: "task", title: "Buy milk" });
    expect(body).toBe("Get 2%.");
  });

  it("returns empty frontmatter when there is no fence", () => {
    const { frontmatter, body } = parseDocument("just a note");
    expect(frontmatter).toEqual({});
    expect(body).toBe("just a note");
  });

  it("normalizes CRLF line endings", () => {
    const raw = "---\r\ntype: page\r\n---\r\n\r\nHello";
    const { frontmatter, body } = parseDocument(raw);
    expect(frontmatter).toEqual({ type: "page" });
    expect(body).toBe("Hello");
  });

  it("ignores a non-object frontmatter block", () => {
    const { frontmatter } = parseDocument("---\n- a\n- b\n---\nbody");
    expect(frontmatter).toEqual({});
  });
});

describe("serializeDocument", () => {
  it("round-trips through parseDocument", () => {
    const fm = { type: "task", title: "Test", status: "open", notify: false };
    const out = serializeDocument(fm, "Body text.");
    const parsed = parseDocument(out);
    expect(parsed.frontmatter).toEqual(fm);
    expect(parsed.body).toBe("Body text.");
  });

  it("emits a fenced block followed by a blank line", () => {
    const out = serializeDocument({ type: "page" }, "Hi");
    expect(out.startsWith("---\n")).toBe(true);
    expect(out).toContain("---\n\nHi");
  });
});

describe("wikilink helpers", () => {
  it("extracts a bare stem", () => {
    expect(wikiTarget("[[health]]")).toBe("health");
  });

  it("strips an alias", () => {
    expect(wikiTarget("[[health|Health]]")).toBe("health");
  });

  it("accepts an unfenced stem", () => {
    expect(wikiTarget("health")).toBe("health");
  });

  it("wraps a stem", () => {
    expect(toWikilink("buy-milk")).toBe("[[buy-milk]]");
  });
});
