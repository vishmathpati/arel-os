import { describe, expect, it } from "vitest";
import {
  type ClipperPayload,
  articleCapture,
  captureFrontmatter,
  detectCapture,
  resourceKindForUrl,
} from "./inbox-data";

describe("detectCapture", () => {
  it("treats plain text as a task", () => {
    expect(detectCapture("call the dentist")).toEqual({
      kind: "task",
      title: "call the dentist",
    });
  });

  it("strips the `task:` prefix (case-insensitive)", () => {
    expect(detectCapture("task: buy milk")).toEqual({ kind: "task", title: "buy milk" });
    expect(detectCapture("TASK:review PR")).toEqual({ kind: "task", title: "review PR" });
  });

  it("falls back to a placeholder when `task:` has no body", () => {
    expect(detectCapture("task:")).toEqual({ kind: "task", title: "Untitled" });
  });

  it("treats a bare URL as a resource with host as title + source", () => {
    expect(detectCapture("https://example.com/post")).toEqual({
      kind: "resource",
      title: "example.com",
      resource_kind: "link",
      url: "https://example.com/post",
      source: "example.com",
    });
  });

  it("detects a www. URL without scheme", () => {
    const d = detectCapture("www.example.com/x");
    expect(d.kind).toBe("resource");
    expect(d.source).toBe("example.com");
  });

  it("does not treat text containing spaces as a URL", () => {
    expect(detectCapture("read https://example.com later").kind).toBe("task");
  });
});

describe("resourceKindForUrl", () => {
  it("maps YouTube to video", () => {
    expect(resourceKindForUrl("https://www.youtube.com/watch?v=abc")).toBe("video");
    expect(resourceKindForUrl("https://youtu.be/abc")).toBe("video");
  });
  it("maps twitter / x to tweet", () => {
    expect(resourceKindForUrl("https://twitter.com/u/status/1")).toBe("tweet");
    expect(resourceKindForUrl("https://x.com/u/status/1")).toBe("tweet");
  });
  it("maps image extensions to image", () => {
    expect(resourceKindForUrl("https://cdn.site.com/a.png")).toBe("image");
    expect(resourceKindForUrl("https://cdn.site.com/a.jpg?w=1")).toBe("image");
  });
  it("defaults to link", () => {
    expect(resourceKindForUrl("https://example.com/article")).toBe("link");
  });
});

describe("captureFrontmatter", () => {
  it("emits only the fields present in the detection", () => {
    expect(captureFrontmatter({ kind: "task", title: "x" })).toEqual({
      type: "inbox",
      kind: "task",
      title: "x",
    });
  });
  it("includes resource fields when detected", () => {
    const fm = captureFrontmatter({
      kind: "resource",
      title: "example.com",
      resource_kind: "link",
      url: "https://example.com",
      source: "example.com",
    });
    expect(fm).toMatchObject({
      type: "inbox",
      kind: "resource",
      resource_kind: "link",
      url: "https://example.com",
    });
  });
});

describe("articleCapture (clipper pre-wire)", () => {
  it("maps an article payload to an inbox resource + body", () => {
    const payload: ClipperPayload = {
      url: "https://theverge.com/a",
      title: "A Great Post",
      source: "The Verge",
      article_text_markdown: "# A Great Post\n\nBody text.",
    };
    const { frontmatter, body } = articleCapture(payload);
    expect(frontmatter).toMatchObject({
      type: "inbox",
      kind: "resource",
      title: "A Great Post",
      resource_kind: "link",
      url: "https://theverge.com/a",
      source: "The Verge",
    });
    expect(body).toContain("Body text.");
  });

  it("honors an explicit type hint and falls back to host for title", () => {
    const { frontmatter } = articleCapture({ url: "https://x.com/u/status/1", type: "tweet" });
    expect(frontmatter.resource_kind).toBe("tweet");
    expect(frontmatter.title).toBe("x.com");
  });

  it("prefers tweet markdown, then selection, for the body", () => {
    expect(articleCapture({ url: "https://x.com/a", tweet_text_markdown: "tw" }).body).toBe("tw");
    expect(articleCapture({ url: "https://e.com", selection: "sel" }).body).toBe("sel");
    expect(articleCapture({ url: "https://e.com" }).body).toBe("");
  });
});
