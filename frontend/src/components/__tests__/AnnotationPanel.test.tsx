import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

const mockToggleVisibility = vi.fn();
const mockAddUser = vi.fn().mockResolvedValue(undefined);
const mockDeleteUser = vi.fn().mockResolvedValue(undefined);

const mockAnnotations = [
  {
    id: "1",
    annotation_type: "artifact_eog",
    source: "preprocess" as const,
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
    source: "anomaly_detection" as const,
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
  {
    id: "3",
    annotation_type: "user_note",
    source: "user" as const,
    channel: "Fp1",
    start_time: 4,
    end_time: 4.5,
    label: "Note",
    color: "#10B981",
    severity: 0,
    confidence: 1,
    metadata: {},
    is_user_created: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

let mockStoreState: Record<string, unknown>;

const createDefaultState = () => ({
  annotationSet: {
    file_id: "test-file",
    annotations: mockAnnotations,
    summary: { artifact_eog: 1, anomaly_spike: 1, user_note: 1 },
    generated_at: "2026-01-01T00:00:00Z",
  },
  isLoading: false,
  visibilityFilter: {
    artifact_eog: true,
    anomaly_spike: true,
    user_note: true,
  },
  toggleTypeVisibility: mockToggleVisibility,
  addUserAnnotation: mockAddUser,
  deleteUserAnnotation: mockDeleteUser,
  getVisibleAnnotations: vi.fn().mockReturnValue(mockAnnotations),
});

vi.mock("../../store/annotationStore", () => ({
  useAnnotationStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockStoreState),
}));

vi.mock("../../types/annotation", () => ({
  ANNOTATION_TYPES_BY_SOURCE: {
    preprocess: [
      "artifact_eog",
      "artifact_emg",
      "artifact_flat",
      "artifact_drift",
      "artifact_jump",
    ],
    band_analysis: ["band_dominant"],
    anomaly_detection: [
      "anomaly_spike",
      "anomaly_sharp_wave",
      "anomaly_spike_and_slow",
      "anomaly_slow_wave",
      "anomaly_rhythmic",
    ],
    user: ["user_note"],
  },
  ANNOTATION_RENDER_CONFIG: {
    artifact_eog: { mode: "highlight", opacity: 0.2 },
    artifact_emg: { mode: "highlight", opacity: 0.2 },
    artifact_flat: { mode: "highlight", opacity: 0.15 },
    artifact_drift: { mode: "highlight", opacity: 0.15 },
    artifact_jump: { mode: "highlight", opacity: 0.15 },
    band_dominant: { mode: "label", opacity: 0.9 },
    anomaly_spike: { mode: "marker", opacity: 0.9, icon: "▲" },
    anomaly_sharp_wave: { mode: "marker", opacity: 0.9, icon: "◆" },
    anomaly_spike_and_slow: { mode: "highlight", opacity: 0.25 },
    anomaly_slow_wave: { mode: "highlight", opacity: 0.2 },
    anomaly_rhythmic: { mode: "highlight", opacity: 0.2 },
    user_note: { mode: "marker", opacity: 1.0, icon: "📌" },
  },
}));

const defaultProps = {
  fileId: "test-file",
  channels: ["Fp1", "Fp2", "F3"],
  onJumpToTime: vi.fn(),
};

describe("AnnotationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = createDefaultState();
  });

  it("renders panel title", async () => {
    const { AnnotationPanel } = await import("../AnnotationPanel");
    render(<AnnotationPanel {...defaultProps} />);
    expect(screen.getByText("标注分析")).toBeInTheDocument();
  });

  it("displays annotation count", async () => {
    const { AnnotationPanel } = await import("../AnnotationPanel");
    render(<AnnotationPanel {...defaultProps} />);
    expect(screen.getByText("共 3 条标注")).toBeInTheDocument();
  });

  it("renders source groups", async () => {
    const { AnnotationPanel } = await import("../AnnotationPanel");
    render(<AnnotationPanel {...defaultProps} />);
    const sourceLabels = screen.getAllByText("伪迹检测");
    expect(sourceLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("频段分析")).toBeInTheDocument();
    expect(screen.getByText("异常检测")).toBeInTheDocument();
    const userLabels = screen.getAllByText("用户标注");
    expect(userLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("calls toggleTypeVisibility when type toggle is clicked", async () => {
    const { AnnotationPanel } = await import("../AnnotationPanel");
    render(<AnnotationPanel {...defaultProps} />);
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    expect(mockToggleVisibility).toHaveBeenCalled();
  });

  it("calls onJumpToTime when annotation item is clicked", async () => {
    const { AnnotationPanel } = await import("../AnnotationPanel");
    render(<AnnotationPanel {...defaultProps} />);
    const items = screen.getAllByText("Fp1");
    const annotationItem = items[0].closest("[role='button']");
    if (annotationItem) {
      fireEvent.click(annotationItem);
      expect(defaultProps.onJumpToTime).toHaveBeenCalled();
    }
  });

  it("shows add form and submits user annotation", async () => {
    const { AnnotationPanel } = await import("../AnnotationPanel");
    render(<AnnotationPanel {...defaultProps} />);
    const addButton = screen.getByText("+ 添加用户标注");
    fireEvent.click(addButton);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "Fp1" } });

    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "1.0" } });
    fireEvent.change(inputs[1], { target: { value: "2.0" } });

    const textInput = screen.getByPlaceholderText("标签");
    fireEvent.change(textInput, { target: { value: "Test Note" } });

    const submitButton = screen.getByText("提交");
    fireEvent.click(submitButton);

    expect(mockAddUser).toHaveBeenCalledWith("test-file", {
      annotation_type: "user_note",
      channel: "Fp1",
      start_time: 1,
      end_time: 2,
      label: "Test Note",
      note: "",
    });
  });

  it("calls deleteUserAnnotation when delete button is clicked", async () => {
    const { AnnotationPanel } = await import("../AnnotationPanel");
    render(<AnnotationPanel {...defaultProps} />);
    const deleteButtons = screen.getAllByText("✕");
    fireEvent.click(deleteButtons[0]);
    expect(mockDeleteUser).toHaveBeenCalledWith("test-file", "3");
  });

  it("toggles group collapse on header click", async () => {
    const { AnnotationPanel } = await import("../AnnotationPanel");
    render(<AnnotationPanel {...defaultProps} />);
    const headers = screen.getAllByText("伪迹检测");
    fireEvent.click(headers[0]);
    expect(screen.getByText("▶")).toBeInTheDocument();
  });

  it("shows empty state when annotationSet is null", async () => {
    mockStoreState = {
      ...createDefaultState(),
      annotationSet: null,
      isLoading: false,
    };
    const { AnnotationPanel } = await import("../AnnotationPanel");
    render(
      <AnnotationPanel
        fileId={null}
        channels={[]}
        onJumpToTime={defaultProps.onJumpToTime}
      />
    );
    expect(
      screen.getByText("暂无标注数据，请先加载 EDF 文件")
    ).toBeInTheDocument();
  });

  it("shows loading indicator when isLoading is true", async () => {
    mockStoreState = {
      ...createDefaultState(),
      annotationSet: null,
      isLoading: true,
    };
    const { AnnotationPanel } = await import("../AnnotationPanel");
    render(
      <AnnotationPanel
        fileId={null}
        channels={[]}
        onJumpToTime={defaultProps.onJumpToTime}
      />
    );
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });
});
