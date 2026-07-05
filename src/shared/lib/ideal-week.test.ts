import { describe, expect, it } from "vitest";
import {
  formatTimeLabel,
  minutesToTime,
  snapMinutes,
  timeOptions,
  timeToMinutes,
} from "./ideal-week";

describe("ideal-week time math", () => {
  it("round-trips HH:MM ↔ minutes", () => {
    expect(timeToMinutes("06:00")).toBe(360);
    expect(timeToMinutes("23:45")).toBe(1425);
    expect(minutesToTime(360)).toBe("06:00");
    expect(minutesToTime(1425)).toBe("23:45");
  });

  it("zero-pads and clamps to the day", () => {
    expect(minutesToTime(5)).toBe("00:05");
    expect(minutesToTime(-30)).toBe("00:00");
    expect(minutesToTime(24 * 60 + 90)).toBe("24:00");
  });

  it("snaps to the nearest 15-min step", () => {
    expect(snapMinutes(367)).toBe(360); // 06:07 → 06:00
    expect(snapMinutes(368)).toBe(375); // 06:08 → 06:15
    expect(snapMinutes(100, 30)).toBe(90);
  });

  it("formats a 12-hour display label from HH:MM", () => {
    expect(formatTimeLabel("09:00")).toBe("9:00 AM");
    expect(formatTimeLabel("00:00")).toBe("12:00 AM");
    expect(formatTimeLabel("12:00")).toBe("12:00 PM");
    expect(formatTimeLabel("13:30")).toBe("1:30 PM");
    expect(formatTimeLabel("23:45")).toBe("11:45 PM");
  });
});

describe("ideal-week time options", () => {
  it("lists 15-min increments inclusive of both ends", () => {
    const opts = timeOptions("08:00", "09:00");
    expect(opts).toEqual([
      { value: "08:00", label: "8:00 AM" },
      { value: "08:15", label: "8:15 AM" },
      { value: "08:30", label: "8:30 AM" },
      { value: "08:45", label: "8:45 AM" },
      { value: "09:00", label: "9:00 AM" },
    ]);
  });

  it("snaps the window bounds before generating", () => {
    // 08:07 → 08:00 (start), 08:38 → 08:45 (end, nearest-15 rounds up).
    const opts = timeOptions("08:07", "08:38");
    expect(opts.map((o) => o.value)).toEqual(["08:00", "08:15", "08:30", "08:45"]);
  });

  it("honors a custom step", () => {
    const opts = timeOptions("08:00", "10:00", 60);
    expect(opts.map((o) => o.value)).toEqual(["08:00", "09:00", "10:00"]);
  });
});
