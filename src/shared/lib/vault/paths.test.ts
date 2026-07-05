import { describe, expect, it } from "vitest";
import {
  archivedPath,
  areaIndexPath,
  dailyPath,
  databaseIndexPath,
  inboxPath,
  pagePath,
  projectPath,
  questPath,
  slugify,
  taskPath,
  weeklyPath,
} from "./paths";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Buy 2% Milk!")).toBe("buy-2-milk");
  });

  it("trims leading/trailing separators", () => {
    expect(slugify("  --Hello, World--  ")).toBe("hello-world");
  });
});

describe("path builders", () => {
  it("builds flat leaf paths", () => {
    expect(taskPath("buy-milk")).toBe("tasks/buy-milk.md");
    expect(pagePath("ideas")).toBe("pages/ideas.md");
    expect(inboxPath("2026-06-14-12-00-00-link")).toBe("inbox/2026-06-14-12-00-00-link.md");
  });

  it("builds folder-form container paths", () => {
    expect(projectPath("wifi")).toBe("projects/wifi/wifi.md");
    expect(questPath("code")).toBe("quests/code/code.md");
    expect(areaIndexPath("health")).toBe("areas/health/_index.md");
    expect(databaseIndexPath("library")).toBe("databases/library/_index.md");
  });

  it("builds system note paths", () => {
    expect(dailyPath("2026-06-14")).toBe("system/daily/2026-06-14.md");
    expect(weeklyPath("2026-W24")).toBe("system/weekly/2026-W24.md");
  });

  it("prefixes the soft-delete archive path", () => {
    expect(archivedPath("tasks/buy-milk.md")).toBe("archive/deleted/tasks/buy-milk.md");
  });
});
