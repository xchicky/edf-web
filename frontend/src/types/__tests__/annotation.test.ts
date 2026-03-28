import { describe, it, expect } from "vitest";
import {
  ANNOTATION_RENDER_CONFIG,
  ALL_ANNOTATION_TYPES,
  ANNOTATION_TYPES_BY_SOURCE,
} from "../annotation";

describe("annotation types", () => {
  it("should have 12 annotation types", () => {
    expect(ALL_ANNOTATION_TYPES).toHaveLength(12);
  });

  it("every type should have render config", () => {
    ALL_ANNOTATION_TYPES.forEach((type) => {
      expect(ANNOTATION_RENDER_CONFIG[type]).toBeDefined();
      expect(ANNOTATION_RENDER_CONFIG[type].mode).toMatch(
        /^(highlight|marker|label)$/
      );
    });
  });

  it("all types covered by source groups", () => {
    const grouped = Object.values(ANNOTATION_TYPES_BY_SOURCE).flat();
    expect(grouped.sort()).toEqual([...ALL_ANNOTATION_TYPES].sort());
  });

  it("highlight types should have valid opacity", () => {
    Object.entries(ANNOTATION_RENDER_CONFIG).forEach(([, config]) => {
      if (config.mode === "highlight") {
        expect(config.opacity).toBeGreaterThan(0);
        expect(config.opacity).toBeLessThanOrEqual(1);
      }
    });
  });
});
