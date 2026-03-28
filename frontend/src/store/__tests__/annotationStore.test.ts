import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAnnotationStore } from "../annotationStore";

vi.mock("../../api/annotations", () => ({
  generateAnnotations: vi.fn().mockResolvedValue({
    file_id: "test-file",
    annotations: [
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
    ],
    summary: { artifact_eog: 1, anomaly_spike: 1 },
    generated_at: "2026-01-01T00:00:00Z",
  }),
  getAnnotations: vi.fn().mockResolvedValue({
    file_id: "test-file",
    annotations: [],
    summary: {},
    generated_at: "",
  }),
  addUserAnnotation: vi.fn().mockResolvedValue({
    id: "3",
    annotation_type: "user_note",
    source: "user",
    channel: "Fp1",
    start_time: 1,
    end_time: 1,
    label: "Note",
    color: "#10B981",
    severity: 0,
    confidence: 1,
    metadata: {},
    is_user_created: true,
    created_at: "2026-01-01T00:00:00Z",
  }),
  deleteUserAnnotation: vi.fn().mockResolvedValue(undefined),
}));

describe("annotationStore", () => {
  beforeEach(() => {
    useAnnotationStore.getState().clearAnnotations();
    useAnnotationStore.getState().setAllVisibility(true);
  });

  it("should generate annotations", async () => {
    await useAnnotationStore.getState().generateAnnotations("test-file");
    const state = useAnnotationStore.getState();
    expect(state.annotationSet).toBeTruthy();
    expect(state.annotationSet!.annotations).toHaveLength(2);
    expect(state.isLoading).toBe(false);
  });

  it("should filter by visibility", async () => {
    await useAnnotationStore.getState().generateAnnotations("test-file");
    useAnnotationStore.getState().toggleTypeVisibility("artifact_eog");
    const visible = useAnnotationStore.getState().getVisibleAnnotations();
    expect(visible).toHaveLength(1);
    expect(visible[0].annotation_type).toBe("anomaly_spike");
  });

  it("should filter by channel", async () => {
    await useAnnotationStore.getState().generateAnnotations("test-file");
    const chAnnotations =
      useAnnotationStore.getState().getAnnotationsForChannel("Fp1");
    expect(chAnnotations).toHaveLength(2);
  });

  it("should filter by time range", async () => {
    await useAnnotationStore.getState().generateAnnotations("test-file");
    const rangeAnnotations =
      useAnnotationStore.getState().getAnnotationsInTimeRange(2.5, 3.5);
    expect(rangeAnnotations).toHaveLength(1);
    expect(rangeAnnotations[0].annotation_type).toBe("anomaly_spike");
  });

  it("should add user annotation", async () => {
    await useAnnotationStore.getState().generateAnnotations("test-file");
    await useAnnotationStore.getState().addUserAnnotation("test-file", {
      annotation_type: "user_note",
      channel: "Fp1",
      start_time: 1,
      end_time: 1,
      label: "Note",
    });
    expect(
      useAnnotationStore.getState().annotationSet!.annotations
    ).toHaveLength(3);
  });

  it("should delete user annotation", async () => {
    await useAnnotationStore.getState().generateAnnotations("test-file");
    await useAnnotationStore.getState().addUserAnnotation("test-file", {
      annotation_type: "user_note",
      channel: "Fp1",
      start_time: 1,
      end_time: 1,
      label: "Note",
    });
    await useAnnotationStore
      .getState()
      .deleteUserAnnotation("test-file", "3");
    expect(
      useAnnotationStore.getState().annotationSet!.annotations
    ).toHaveLength(2);
  });

  it("should clear annotations", async () => {
    await useAnnotationStore.getState().generateAnnotations("test-file");
    useAnnotationStore.getState().clearAnnotations();
    expect(useAnnotationStore.getState().annotationSet).toBeNull();
  });

  it("should set all visibility off", async () => {
    await useAnnotationStore.getState().generateAnnotations("test-file");
    useAnnotationStore.getState().setAllVisibility(false);
    const visible = useAnnotationStore.getState().getVisibleAnnotations();
    expect(visible).toHaveLength(0);
  });

  it("should return empty when no annotationSet", () => {
    expect(
      useAnnotationStore.getState().getVisibleAnnotations()
    ).toHaveLength(0);
    expect(
      useAnnotationStore.getState().getAnnotationsForChannel("Fp1")
    ).toHaveLength(0);
    expect(
      useAnnotationStore.getState().getAnnotationsInTimeRange(0, 10)
    ).toHaveLength(0);
  });
});
