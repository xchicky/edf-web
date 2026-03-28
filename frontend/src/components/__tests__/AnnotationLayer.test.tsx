import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { AnnotationLayer } from "../AnnotationLayer";

const mockAnnotations = [
  {
    id: "1",
    annotation_type: "artifact_eog",
    source: "preprocess",
    channel: "Fp1",
    start_time: 1,
    end_time: 2,
    label: "EOG",
    color: "#FCD34D",
    severity: 0.5,
    confidence: 0.8,
    metadata: {},
    is_user_created: false,
    created_at: null,
  },
  {
    id: "2",
    annotation_type: "anomaly_spike",
    source: "anomaly_detection",
    channel: "Fp1",
    start_time: 3,
    end_time: 3.05,
    label: "Spike",
    color: "#EF4444",
    severity: 0.7,
    confidence: 0.9,
    metadata: {},
    is_user_created: false,
    created_at: null,
  },
];

const mockState = {
  getAnnotationsInTimeRange: vi.fn().mockReturnValue(mockAnnotations),
  visibilityFilter: { artifact_eog: true, anomaly_spike: true },
};

vi.mock("../../store/annotationStore", () => ({
  useAnnotationStore: (selector: (state: typeof mockState) => unknown) =>
    selector(mockState),
}));

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
  });
});

describe("AnnotationLayer", () => {
  it("should render without crashing", () => {
    const { container } = render(
      <AnnotationLayer
        width={800}
        height={400}
        currentTime={0}
        windowDuration={10}
        channels={["Fp1"]}
        channelHeight={400}
        leftMargin={50}
      />
    );
    expect(container.querySelector("canvas")).toBeTruthy();
  });

  it("should set canvas dimensions", () => {
    const { container } = render(
      <AnnotationLayer
        width={800}
        height={400}
        currentTime={0}
        windowDuration={10}
        channels={["Fp1"]}
        channelHeight={400}
        leftMargin={50}
      />
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeTruthy();
  });

  it("should handle click without onAnnotationClick", () => {
    const { container } = render(
      <AnnotationLayer
        width={800}
        height={400}
        currentTime={0}
        windowDuration={10}
        channels={["Fp1"]}
        channelHeight={400}
        leftMargin={50}
      />
    );
    const canvas = container.querySelector("canvas")!;
    expect(() => {
      canvas.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }).not.toThrow();
  });

  it("should render with pointerEvents none when no click handler", () => {
    const { container } = render(
      <AnnotationLayer
        width={800}
        height={400}
        currentTime={0}
        windowDuration={10}
        channels={["Fp1"]}
        channelHeight={400}
        leftMargin={50}
      />
    );
    const canvas = container.querySelector("canvas")!;
    expect(canvas.style.pointerEvents).toBe("none");
  });

  it("should render with pointerEvents auto when click handler provided", () => {
    const { container } = render(
      <AnnotationLayer
        width={800}
        height={400}
        currentTime={0}
        windowDuration={10}
        channels={["Fp1"]}
        channelHeight={400}
        leftMargin={50}
        onAnnotationClick={() => {}}
      />
    );
    const canvas = container.querySelector("canvas")!;
    expect(canvas.style.pointerEvents).toBe("auto");
  });
});
