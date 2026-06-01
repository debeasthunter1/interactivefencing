export type WhiteboardTool =
  | "select"
  | "pan"
  | "pencil"
  | "marker"
  | "crayon"
  | "paint-brush"
  | "chalk"
  | "highlighter"
  | "eraser"
  | "fill"
  | "arrow"
  | "rectangle"
  | "rounded-rectangle"
  | "circle"
  | "triangle"
  | "star"
  | "heart"
  | "cloud"
  | "speech-bubble";

export type ExportFormat = "image/png" | "image/jpeg";

export type GridMode = "none" | "grid" | "dots";

export type DrawingTool =
  | "pencil"
  | "marker"
  | "crayon"
  | "paint-brush"
  | "chalk"
  | "highlighter"
  | "eraser";

export type ShapeKind =
  | "arrow"
  | "rectangle"
  | "rounded-rectangle"
  | "circle"
  | "triangle"
  | "star"
  | "heart"
  | "cloud"
  | "speech-bubble";

export type ViewportState = {
  x: number;
  y: number;
  zoom: number;
};

export type Point = {
  x: number;
  y: number;
};

type WhiteboardElementBase = {
  height: number;
  id: string;
  rotation: number;
  width: number;
  x: number;
  y: number;
};

export type ShapeElementData = WhiteboardElementBase & {
  borderColor: string;
  borderWidth: number;
  fillColor: string;
  kind: ShapeKind;
  type: "shape";
};

export type WhiteboardElement = ShapeElementData;

export type BoardSnapshot = {
  canvasDataUrl: string;
  elements: WhiteboardElement[];
};
