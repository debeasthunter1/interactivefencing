"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import type { CSSProperties, PointerEvent, WheelEvent } from "react";
import type {
  DrawingTool,
  ExportFormat,
  GridMode,
  Point,
  ShapeElementData,
  ShapeKind,
  ViewportState,
  WhiteboardElement,
  WhiteboardTool,
} from "@/app/types/whiteboard";
import { CreativeShape } from "./CreativeShape";

export const BOARD_WIDTH = 3200;
export const BOARD_HEIGHT = 2200;

const DRAWING_CHUNK_SIZE = 1024;
const EXPORT_PADDING = 160;
const MAX_EXPORT_SIDE = 4096;
const MAX_FILL_PIXELS = 12_000_000;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.2;
const FLOOD_FILL_BOUNDARY_ALPHA = 8;
const FLOOD_FILL_SAFETY_RATIO = 0.35;
const FLOOD_FILL_MIN_PIXELS = 16;
const DRAWING_TOOLS = new Set<WhiteboardTool>([
  "pencil",
  "marker",
  "crayon",
  "paint-brush",
  "chalk",
  "highlighter",
  "eraser",
]);
const SHAPE_TOOLS = new Set<WhiteboardTool>([
  "arrow",
  "rectangle",
  "rounded-rectangle",
  "circle",
  "triangle",
  "star",
  "heart",
  "cloud",
  "speech-bubble",
]);

type DrawingMode = "draw" | "move-shape" | "shape" | "pan" | "idle";

type ShapeDraft = {
  baseElements: WhiteboardElement[];
  id: string;
  next: ShapeElementData;
};

type ShapeMoveDraft = {
  baseElements: WhiteboardElement[];
  hasMoved: boolean;
  id: string;
  next: ShapeElementData;
  original: ShapeElementData;
  start: Point;
};

type PanStart = {
  clientX: number;
  clientY: number;
  viewport: ViewportState;
};

type StrokeSegment = {
  from: Point;
  to: Point;
  tool: DrawingTool;
};

type DrawingChunk = {
  canvas: HTMLCanvasElement;
  key: string;
  x: number;
  y: number;
};

type DrawingChunkMap = Map<string, DrawingChunk>;

type DrawingStoreSnapshot = {
  chunks: Array<{
    dataUrl: string;
    key: string;
    x: number;
    y: number;
  }>;
  version: 2;
};

type WorldBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type WhiteboardCanvasHandle = {
  clear: () => string | null;
  exportImage: (format?: ExportFormat) => string | null;
  getCanvasDataUrl: () => string | null;
  replaceWithImage: (imageUrl: string) => Promise<string | null>;
  restoreCanvas: (snapshot: string) => void;
};

type WhiteboardCanvasProps = {
  borderColor: string;
  borderWidth: number;
  elements: WhiteboardElement[];
  fillColor: string;
  gridMode: GridMode;
  selectedElementId: string | null;
  strokeColor: string;
  strokeOpacity: number;
  strokeWidth: number;
  textureIntensity: number;
  tool: WhiteboardTool;
  viewport: ViewportState;
  onCanvasCommit: (snapshot: string) => void;
  onCanvasReady: (snapshot: string) => void;
  onElementCommit: (elements: WhiteboardElement[]) => void;
  onElementsChange: (elements: WhiteboardElement[]) => void;
  onFillMiss: (message: string) => void;
  onSelectElement: (id: string | null) => void;
  onViewportChange: (viewport: ViewportState) => void;
};

export const WhiteboardCanvas = forwardRef<
  WhiteboardCanvasHandle,
  WhiteboardCanvasProps
>(function WhiteboardCanvas(
  {
    borderColor,
    borderWidth,
    elements,
    fillColor,
    gridMode,
    selectedElementId,
    strokeColor,
    strokeOpacity,
    strokeWidth,
    textureIntensity,
    tool,
    viewport,
    onCanvasCommit,
    onCanvasReady,
    onElementCommit,
    onElementsChange,
    onFillMiss,
    onSelectElement,
    onViewportChange,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingModeRef = useRef<DrawingMode>("idle");
  const drawingChunksRef = useRef<DrawingChunkMap>(new Map());
  const elementsRef = useRef(elements);
  const lastPointRef = useRef<Point | null>(null);
  const onCanvasReadyRef = useRef(onCanvasReady);
  const panStartRef = useRef<PanStart | null>(null);
  const pendingStrokeRef = useRef<StrokeSegment[]>([]);
  const rafRef = useRef<number | null>(null);
  const shapeDraftRef = useRef<ShapeDraft | null>(null);
  const shapeMoveRef = useRef<ShapeMoveDraft | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const startPointRef = useRef<Point | null>(null);
  const toolRef = useRef(tool);
  const viewportRef = useRef(viewport);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    onCanvasReadyRef.current = onCanvasReady;
  }, [onCanvasReady]);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const boardStyle = useMemo(
    () => createInfiniteBoardStyle(gridMode, viewport),
    [gridMode, viewport],
  );

  const resetContext = useCallback((context: CanvasRenderingContext2D) => {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.imageSmoothingEnabled = true;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  }, []);

  const renderViewport = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    const ratio = Number(canvas.dataset.pixelRatio || 1);
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;
    const currentViewport = viewportRef.current;
    const visibleBounds = {
      height: height / currentViewport.zoom,
      width: width / currentViewport.zoom,
      x: -currentViewport.x / currentViewport.zoom,
      y: -currentViewport.y / currentViewport.zoom,
    };

    context.save();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.translate(currentViewport.x, currentViewport.y);
    context.scale(currentViewport.zoom, currentViewport.zoom);
    renderElementsToCanvas(context, elementsRef.current);
    for (const chunk of drawingChunksRef.current.values()) {
      if (boundsIntersect(chunkToBounds(chunk), visibleBounds)) {
        context.drawImage(chunk.canvas, chunk.x, chunk.y);
      }
    }
    context.restore();
  }, []);

  const getCanvasDataUrl = useCallback(() => {
    return serializeDrawingChunks(drawingChunksRef.current);
  }, []);

  const restoreCanvas = useCallback(
    (snapshot: string) => {
      restoreDrawingChunks(
        snapshot,
        drawingChunksRef.current,
        resetContext,
        renderViewport,
      );
    },
    [renderViewport, resetContext],
  );

  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) {
      return;
    }

    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));

    canvas.dataset.pixelRatio = String(ratio);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    renderViewport();
    onCanvasReadyRef.current(serializeDrawingChunks(drawingChunksRef.current));
  }, [renderViewport]);

  useEffect(() => {
    initializeCanvas();
    window.addEventListener("resize", initializeCanvas);
    return () => window.removeEventListener("resize", initializeCanvas);
  }, [initializeCanvas]);

  useEffect(() => {
    renderViewport();
  }, [renderViewport, viewport]);

  useEffect(() => {
    renderViewport();
  }, [elements, renderViewport]);

  useEffect(
    () => () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    },
    [],
  );

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number) => {
      const stageRect = stageRef.current?.getBoundingClientRect();
      if (!stageRect) {
        return { x: 0, y: 0 };
      }

      return {
        x: (clientX - stageRect.left - viewport.x) / viewport.zoom,
        y: (clientY - stageRect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport],
  );

  const getStagePoint = useCallback((clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const flushPendingStroke = useCallback(() => {
    if (!drawingChunksRef.current) {
      pendingStrokeRef.current = [];
      rafRef.current = null;
      return;
    }

    const segments = pendingStrokeRef.current.splice(0);
    rafRef.current = null;

    for (const segment of segments) {
      drawCreativeSegmentToChunks(drawingChunksRef.current, resetContext, segment, {
        color: strokeColor,
        opacity: strokeOpacity,
        textureIntensity,
        tool: segment.tool,
        width: strokeWidth,
      });
    }
    renderViewport();
  }, [
    renderViewport,
    resetContext,
    strokeColor,
    strokeOpacity,
    strokeWidth,
    textureIntensity,
  ]);

  const enqueueStrokeSegment = useCallback(
    (segment: StrokeSegment) => {
      pendingStrokeRef.current.push(segment);
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(flushPendingStroke);
      }
    },
    [flushPendingStroke],
  );

  const flushStrokeNow = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    flushPendingStroke();
  }, [flushPendingStroke]);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const nextZoom = clamp(
      viewport.zoom * (event.deltaY < 0 ? 1.08 : 0.92),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    const boardPoint = getCanvasPoint(event.clientX, event.clientY);
    const stagePoint = getStagePoint(event.clientX, event.clientY);

    onViewportChange({
      x: stagePoint.x - boardPoint.x * nextZoom,
      y: stagePoint.y - boardPoint.y * nextZoom,
      zoom: nextZoom,
    });
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    onSelectElement(null);

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const point = getCanvasPoint(event.clientX, event.clientY);

    if (tool === "select") {
      const shape = findTopmostShapeAtPoint(point, elementsRef.current);
      if (shape) {
        canvas.setPointerCapture(event.pointerId);
        shapeMoveRef.current = {
          baseElements: elementsRef.current,
          hasMoved: false,
          id: shape.id,
          next: shape,
          original: shape,
          start: point,
        };
        drawingModeRef.current = "move-shape";
        onSelectElement(shape.id);
        return;
      }

      drawingModeRef.current = "idle";
      return;
    }

    if (tool === "fill") {
      const shape = findTopmostShapeAtPoint(point, elementsRef.current);
      if (shape) {
        const nextElements = elementsRef.current.map((element) =>
          element.id === shape.id ? { ...element, fillColor } : element,
        );
        onElementsChange(nextElements);
        onElementCommit(nextElements);
        onSelectElement(shape.id);
        drawingModeRef.current = "idle";
        return;
      }

      const snapshot = floodFillCustomDrawing(
        drawingChunksRef.current,
        point,
        fillColor,
        resetContext,
      );
      if (snapshot) {
        renderViewport();
        onCanvasCommit(snapshot);
      } else {
        onFillMiss("Couldn't find a closed shape to fill.");
      }

      drawingModeRef.current = "idle";
      return;
    }

    canvas.setPointerCapture(event.pointerId);

    if (tool === "pan") {
      drawingModeRef.current = "pan";
      panStartRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        viewport,
      };
      return;
    }

    startPointRef.current = point;
    lastPointRef.current = point;

    if (isShapeTool(tool)) {
      const id = createId();
      const baseElements = elementsRef.current;
      const draft = createShapeElement({
        borderColor,
        borderWidth,
        end: point,
        fillColor,
        id,
        kind: tool,
        start: point,
      });

      shapeDraftRef.current = { baseElements, id, next: draft };
      drawingModeRef.current = "shape";
      onElementsChange([...baseElements, draft]);
      onSelectElement(id);
      return;
    }

    if (isDrawingTool(tool)) {
      drawingModeRef.current = "draw";
      drawCreativePointToChunks(drawingChunksRef.current, resetContext, point, {
        color: strokeColor,
        opacity: strokeOpacity,
        textureIntensity,
        tool,
        width: strokeWidth,
      });
      renderViewport();
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (drawingModeRef.current === "pan" && panStartRef.current) {
      event.preventDefault();
      const pan = panStartRef.current;
      onViewportChange({
        x: pan.viewport.x + event.clientX - pan.clientX,
        y: pan.viewport.y + event.clientY - pan.clientY,
        zoom: pan.viewport.zoom,
      });
      return;
    }

    if (drawingModeRef.current === "move-shape" && shapeMoveRef.current) {
      event.preventDefault();
      const coalescedEvents = event.nativeEvent.getCoalescedEvents?.() ?? [
        event.nativeEvent,
      ];
      const lastEvent = coalescedEvents.at(-1) ?? event.nativeEvent;
      const point = getCanvasPoint(lastEvent.clientX, lastEvent.clientY);
      const draft = shapeMoveRef.current;
      const dx = point.x - draft.start.x;
      const dy = point.y - draft.start.y;
      const next = {
        ...draft.original,
        x: draft.original.x + dx,
        y: draft.original.y + dy,
      };

      draft.hasMoved = draft.hasMoved || Math.hypot(dx, dy) > 0.5;
      draft.next = next;
      if (draft.hasMoved) {
        onElementsChange(
          draft.baseElements.map((element) =>
            element.id === draft.id ? next : element,
          ),
        );
      }
      return;
    }

    if (drawingModeRef.current === "idle") {
      return;
    }

    event.preventDefault();

    const coalescedEvents = event.nativeEvent.getCoalescedEvents?.() ?? [
      event.nativeEvent,
    ];
    const start = startPointRef.current;
    const previous = lastPointRef.current;
    if (!start || !previous) {
      return;
    }

    if (drawingModeRef.current === "shape") {
      const lastEvent = coalescedEvents.at(-1) ?? event.nativeEvent;
      const point = getCanvasPoint(lastEvent.clientX, lastEvent.clientY);
      const draft = shapeDraftRef.current;
      const activeTool = toolRef.current;
      if (!draft || !isShapeTool(activeTool)) {
        return;
      }

      const nextShape = createShapeElement({
        borderColor,
        borderWidth,
        end: point,
        fillColor,
        id: draft.id,
        kind: activeTool,
        start,
      });
      draft.next = nextShape;
      onElementsChange([...draft.baseElements, nextShape]);
      lastPointRef.current = point;
      return;
    }

    const activeTool = toolRef.current;
    if (isDrawingTool(activeTool)) {
      let from = previous;
      for (const pointerEvent of coalescedEvents) {
        const point = getCanvasPoint(pointerEvent.clientX, pointerEvent.clientY);
        enqueueStrokeSegment({
          from,
          to: point,
          tool: activeTool,
        });
        from = point;
      }
      lastPointRef.current = from;
    }
  };

  const finishPointerAction = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    const mode = drawingModeRef.current;
    if (mode === "idle") {
      return;
    }

    if (!canvas) {
      drawingModeRef.current = "idle";
      return;
    }

    if (mode === "pan") {
      drawingModeRef.current = "idle";
      panStartRef.current = null;
      return;
    }

    if (mode === "move-shape" && shapeMoveRef.current) {
      const draft = shapeMoveRef.current;
      if (draft.hasMoved) {
        const nextElements = draft.baseElements.map((element) =>
          element.id === draft.id ? draft.next : element,
        );
        onElementsChange(nextElements);
        onElementCommit(nextElements);
      }
      shapeMoveRef.current = null;
      drawingModeRef.current = "idle";
      startPointRef.current = null;
      lastPointRef.current = null;
      return;
    }

    if (mode === "shape" && shapeDraftRef.current) {
      const draft = shapeDraftRef.current;
      const nextElements = [...draft.baseElements, draft.next];
      onElementsChange(nextElements);
      onElementCommit(nextElements);
      shapeDraftRef.current = null;
      drawingModeRef.current = "idle";
      startPointRef.current = null;
      lastPointRef.current = null;
      return;
    }

    drawingModeRef.current = "idle";
    startPointRef.current = null;
    lastPointRef.current = null;
    flushStrokeNow();
    onCanvasCommit(serializeDrawingChunks(drawingChunksRef.current));
  };

  const updateElement = (nextElement: WhiteboardElement, commit = false) => {
    const nextElements = elements.map((element) =>
      element.id === nextElement.id ? nextElement : element,
    );

    onElementsChange(nextElements);
    if (commit) {
      onElementCommit(nextElements);
    }
  };

  const clear = useCallback(() => {
    drawingChunksRef.current.clear();
    renderViewport();
    return serializeDrawingChunks(drawingChunksRef.current);
  }, [renderViewport]);

  const exportImage = useCallback(
    (format: ExportFormat = "image/png") => {
      const exportBounds = getExportBounds(drawingChunksRef.current, elements);
      const scale = Math.min(
        1,
        MAX_EXPORT_SIDE / Math.max(exportBounds.width, exportBounds.height),
      );
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = Math.max(1, Math.ceil(exportBounds.width * scale));
      exportCanvas.height = Math.max(1, Math.ceil(exportBounds.height * scale));
      const context = exportCanvas.getContext("2d");
      if (!context) {
        return null;
      }

      context.scale(scale, scale);
      renderBoardBackground(context, gridMode, exportBounds);
      context.save();
      context.translate(-exportBounds.x, -exportBounds.y);
      renderElementsToCanvas(context, elements);
      renderChunksToCanvas(context, drawingChunksRef.current, exportBounds);
      context.restore();

      return exportCanvas.toDataURL(
        format,
        format === "image/jpeg" ? 0.95 : undefined,
      );
    },
    [elements, gridMode],
  );

  const replaceWithImage = useCallback(
    (imageUrl: string) =>
      new Promise<string | null>((resolve) => {
        const image = new Image();
        image.onload = () => {
          drawingChunksRef.current.clear();

          const stageRect = stageRef.current?.getBoundingClientRect();
          const currentViewport = viewportRef.current;
          const visibleWidth =
            (stageRect?.width ?? BOARD_WIDTH) / currentViewport.zoom;
          const visibleHeight =
            (stageRect?.height ?? BOARD_HEIGHT) / currentViewport.zoom;
          const centerX =
            ((stageRect?.width ?? BOARD_WIDTH) / 2 - currentViewport.x) /
            currentViewport.zoom;
          const centerY =
            ((stageRect?.height ?? BOARD_HEIGHT) / 2 - currentViewport.y) /
            currentViewport.zoom;
          const maxWidth = Math.min(BOARD_WIDTH * 0.76, visibleWidth * 0.76);
          const maxHeight = Math.min(BOARD_HEIGHT * 0.76, visibleHeight * 0.76);
          const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
          const width = image.width * scale;
          const height = image.height * scale;
          const x = centerX - width / 2;
          const y = centerY - height / 2;

          drawImageToChunks(
            drawingChunksRef.current,
            resetContext,
            image,
            { height, width, x, y },
          );
          renderViewport();
          resolve(serializeDrawingChunks(drawingChunksRef.current));
        };
        image.onerror = () => resolve(null);
        image.src = imageUrl;
      }),
    [renderViewport, resetContext],
  );

  useImperativeHandle(
    ref,
    () => ({
      clear,
      exportImage,
      getCanvasDataUrl,
      replaceWithImage,
      restoreCanvas,
    }),
    [clear, exportImage, getCanvasDataUrl, replaceWithImage, restoreCanvas],
  );

  return (
    <div
      ref={stageRef}
      className="relative h-screen w-screen overflow-hidden bg-[#fffdf7] text-slate-950"
      onWheel={handleWheel}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,247,173,0.4)_0,transparent_24%),radial-gradient(circle_at_78%_18%,rgba(255,214,232,0.38)_0,transparent_26%),linear-gradient(135deg,rgba(224,242,254,0.42)_0%,rgba(255,247,237,0.24)_42%,rgba(245,208,254,0.28)_100%)]" />
      <div
        className="pointer-events-none absolute inset-0"
        style={boardStyle}
      />
      <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:34px_34px]" />

      <canvas
        ref={canvasRef}
        aria-label="Interactive creativity canvas"
        className={[
          "absolute inset-0 h-full w-full touch-none",
          tool === "pan" ? "cursor-grab" : "",
          tool === "select" ? "cursor-default" : "",
          tool !== "pan" && tool !== "select" ? "cursor-crosshair" : "",
        ].join(" ")}
        onPointerCancel={finishPointerAction}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerAction}
      />

      <div
        className="pointer-events-none absolute left-0 top-0 overflow-visible"
        style={{
          height: 0,
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
          width: 0,
        }}
      >
        {elements.map((element) => (
          <CreativeShape
            key={element.id}
            element={element}
            isSelected={selectedElementId === element.id}
            tool={tool}
            zoom={viewport.zoom}
            onChange={updateElement}
            onSelect={onSelectElement}
          />
        ))}
      </div>
    </div>
  );
});

function isDrawingTool(tool: WhiteboardTool): tool is DrawingTool {
  return DRAWING_TOOLS.has(tool);
}

function isShapeTool(tool: WhiteboardTool): tool is ShapeKind {
  return SHAPE_TOOLS.has(tool);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function createShapeElement({
  borderColor,
  borderWidth,
  end,
  fillColor,
  id,
  kind,
  start,
}: {
  borderColor: string;
  borderWidth: number;
  end: Point;
  fillColor: string;
  id: string;
  kind: ShapeKind;
  start: Point;
}): ShapeElementData {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.max(44, Math.abs(end.x - start.x));
  const height = Math.max(44, Math.abs(end.y - start.y));

  return {
    borderColor,
    borderWidth,
    fillColor,
    height,
    id,
    kind,
    rotation: 0,
    type: "shape",
    width,
    x,
    y,
  };
}

function findTopmostShapeAtPoint(
  point: Point,
  elements: WhiteboardElement[],
): ShapeElementData | null {
  const hitCanvas = document.createElement("canvas");
  hitCanvas.width = BOARD_WIDTH;
  hitCanvas.height = BOARD_HEIGHT;
  const context = hitCanvas.getContext("2d");
  if (!context) {
    return null;
  }

  for (let index = elements.length - 1; index >= 0; index -= 1) {
    const element = elements[index];
    const localPoint = toShapeLocalPoint(point, element);
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.beginPath();
    addShapePath(context, element.kind, element.width, element.height);
    context.lineWidth =
      element.kind === "arrow"
        ? Math.max(element.borderWidth * 2, 8)
        : Math.max(element.borderWidth, 8);

    const isHit =
      context.isPointInPath(localPoint.x, localPoint.y) ||
      context.isPointInStroke(localPoint.x, localPoint.y);
    context.restore();

    if (isHit) {
      return element;
    }
  }

  return null;
}

function toShapeLocalPoint(point: Point, element: ShapeElementData): Point {
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  const angle = (-element.rotation * Math.PI) / 180;
  const dx = point.x - centerX;
  const dy = point.y - centerY;

  return {
    x: dx * Math.cos(angle) - dy * Math.sin(angle) + element.width / 2,
    y: dx * Math.sin(angle) + dy * Math.cos(angle) + element.height / 2,
  };
}

function createChunk(
  chunks: DrawingChunkMap,
  indexX: number,
  indexY: number,
  resetContext: (context: CanvasRenderingContext2D) => void,
) {
  const key = `${indexX}:${indexY}`;
  const existing = chunks.get(key);
  if (existing) {
    return existing;
  }

  const canvas = document.createElement("canvas");
  canvas.width = DRAWING_CHUNK_SIZE;
  canvas.height = DRAWING_CHUNK_SIZE;
  const context = canvas.getContext("2d");
  if (context) {
    resetContext(context);
  }

  const chunk = {
    canvas,
    key,
    x: indexX * DRAWING_CHUNK_SIZE,
    y: indexY * DRAWING_CHUNK_SIZE,
  };
  chunks.set(key, chunk);
  return chunk;
}

function getChunksForBounds(
  chunks: DrawingChunkMap,
  bounds: WorldBounds,
  resetContext: (context: CanvasRenderingContext2D) => void,
) {
  const startX = Math.floor(bounds.x / DRAWING_CHUNK_SIZE);
  const startY = Math.floor(bounds.y / DRAWING_CHUNK_SIZE);
  const endX = Math.floor(
    (bounds.x + Math.max(bounds.width, 1) - 0.001) / DRAWING_CHUNK_SIZE,
  );
  const endY = Math.floor(
    (bounds.y + Math.max(bounds.height, 1) - 0.001) / DRAWING_CHUNK_SIZE,
  );
  const drawingChunks: DrawingChunk[] = [];

  for (let indexY = startY; indexY <= endY; indexY += 1) {
    for (let indexX = startX; indexX <= endX; indexX += 1) {
      drawingChunks.push(createChunk(chunks, indexX, indexY, resetContext));
    }
  }

  return drawingChunks;
}

function drawCreativePointToChunks(
  chunks: DrawingChunkMap,
  resetContext: (context: CanvasRenderingContext2D) => void,
  point: Point,
  options: CreativeDrawOptions,
) {
  drawCreativeSegmentToChunks(
    chunks,
    resetContext,
    {
      from: { x: point.x - 0.01, y: point.y - 0.01 },
      to: { x: point.x + 0.01, y: point.y + 0.01 },
      tool: options.tool,
    },
    options,
  );
}

function drawCreativeSegmentToChunks(
  chunks: DrawingChunkMap,
  resetContext: (context: CanvasRenderingContext2D) => void,
  segment: StrokeSegment,
  options: CreativeDrawOptions,
) {
  const pad = Math.max(80, options.width * 3.2 + options.textureIntensity * 18);
  const bounds = {
    height: Math.abs(segment.to.y - segment.from.y) + pad * 2,
    width: Math.abs(segment.to.x - segment.from.x) + pad * 2,
    x: Math.min(segment.from.x, segment.to.x) - pad,
    y: Math.min(segment.from.y, segment.to.y) - pad,
  };

  for (const chunk of getChunksForBounds(chunks, bounds, resetContext)) {
    const context = chunk.canvas.getContext("2d");
    if (!context) {
      continue;
    }

    context.save();
    context.translate(-chunk.x, -chunk.y);
    drawCreativeSegment(context, segment.from, segment.to, options);
    context.restore();
    resetContext(context);
  }
}

function drawImageToChunks(
  chunks: DrawingChunkMap,
  resetContext: (context: CanvasRenderingContext2D) => void,
  image: CanvasImageSource,
  bounds: WorldBounds,
  compositeOperation: GlobalCompositeOperation = "source-over",
) {
  for (const chunk of getChunksForBounds(chunks, bounds, resetContext)) {
    const context = chunk.canvas.getContext("2d");
    if (!context) {
      continue;
    }

    context.save();
    context.globalCompositeOperation = compositeOperation;
    context.drawImage(
      image,
      bounds.x - chunk.x,
      bounds.y - chunk.y,
      bounds.width,
      bounds.height,
    );
    context.restore();
    resetContext(context);
  }
}

function renderChunksToCanvas(
  context: CanvasRenderingContext2D,
  chunks: DrawingChunkMap,
  bounds: WorldBounds,
) {
  for (const chunk of chunks.values()) {
    if (boundsIntersect(chunkToBounds(chunk), bounds)) {
      context.drawImage(chunk.canvas, chunk.x, chunk.y);
    }
  }
}

function serializeDrawingChunks(chunks: DrawingChunkMap) {
  const snapshot: DrawingStoreSnapshot = {
    chunks: [],
    version: 2,
  };

  for (const chunk of chunks.values()) {
    if (isCanvasTransparent(chunk.canvas)) {
      continue;
    }

    snapshot.chunks.push({
      dataUrl: chunk.canvas.toDataURL("image/png"),
      key: chunk.key,
      x: chunk.x,
      y: chunk.y,
    });
  }

  return JSON.stringify(snapshot);
}

function restoreDrawingChunks(
  snapshot: string,
  chunks: DrawingChunkMap,
  resetContext: (context: CanvasRenderingContext2D) => void,
  onRestore: () => void,
) {
  chunks.clear();
  const parsedSnapshot = parseDrawingStoreSnapshot(snapshot);
  if (parsedSnapshot) {
    if (!parsedSnapshot.chunks.length) {
      onRestore();
      return;
    }

    Promise.all(
      parsedSnapshot.chunks.map(
        (chunkSnapshot) =>
          new Promise<void>((resolve) => {
            const image = new Image();
            image.onload = () => {
              const indexX = Math.floor(chunkSnapshot.x / DRAWING_CHUNK_SIZE);
              const indexY = Math.floor(chunkSnapshot.y / DRAWING_CHUNK_SIZE);
              const chunk = createChunk(chunks, indexX, indexY, resetContext);
              const context = chunk.canvas.getContext("2d");
              if (context) {
                context.clearRect(0, 0, DRAWING_CHUNK_SIZE, DRAWING_CHUNK_SIZE);
                context.drawImage(image, 0, 0);
                resetContext(context);
              }
              resolve();
            };
            image.onerror = () => resolve();
            image.src = chunkSnapshot.dataUrl;
          }),
      ),
    ).then(onRestore);
    return;
  }

  if (!snapshot.startsWith("data:image/")) {
    onRestore();
    return;
  }

  const image = new Image();
  image.onload = () => {
    drawImageToChunks(
      chunks,
      resetContext,
      image,
      { height: BOARD_HEIGHT, width: BOARD_WIDTH, x: 0, y: 0 },
    );
    onRestore();
  };
  image.onerror = onRestore;
  image.src = snapshot;
}

function parseDrawingStoreSnapshot(snapshot: string): DrawingStoreSnapshot | null {
  try {
    const parsed = JSON.parse(snapshot) as Partial<DrawingStoreSnapshot>;
    if (
      parsed.version === 2 &&
      Array.isArray(parsed.chunks) &&
      parsed.chunks.every(
        (chunk) =>
          typeof chunk.dataUrl === "string" &&
          typeof chunk.key === "string" &&
          typeof chunk.x === "number" &&
          typeof chunk.y === "number",
      )
    ) {
      return parsed as DrawingStoreSnapshot;
    }
  } catch {
    return null;
  }

  return null;
}

function getChunkContentBounds(chunks: DrawingChunkMap): WorldBounds | null {
  let bounds: WorldBounds | null = null;

  for (const chunk of chunks.values()) {
    if (isCanvasTransparent(chunk.canvas)) {
      continue;
    }

    bounds = mergeBounds(bounds, chunkToBounds(chunk));
  }

  return bounds;
}

function getExportBounds(
  chunks: DrawingChunkMap,
  elements: WhiteboardElement[],
): WorldBounds {
  let bounds = getChunkContentBounds(chunks);

  for (const element of elements) {
    bounds = mergeBounds(bounds, getShapeWorldBounds(element));
  }

  return expandBounds(
    bounds ?? { height: BOARD_HEIGHT, width: BOARD_WIDTH, x: 0, y: 0 },
    bounds ? EXPORT_PADDING : 0,
  );
}

function getShapeWorldBounds(element: ShapeElementData): WorldBounds {
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  const angle = (element.rotation * Math.PI) / 180;
  const corners = [
    { x: element.x, y: element.y },
    { x: element.x + element.width, y: element.y },
    { x: element.x + element.width, y: element.y + element.height },
    { x: element.x, y: element.y + element.height },
  ].map((point) => {
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    return {
      x: centerX + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: centerY + dx * Math.sin(angle) + dy * Math.cos(angle),
    };
  });
  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));

  return expandBounds(
    { height: maxY - minY, width: maxX - minX, x: minX, y: minY },
    Math.max(24, element.borderWidth * 2),
  );
}

function mergeBounds(
  first: WorldBounds | null,
  second: WorldBounds,
): WorldBounds {
  if (!first) {
    return second;
  }

  const minX = Math.min(first.x, second.x);
  const minY = Math.min(first.y, second.y);
  const maxX = Math.max(first.x + first.width, second.x + second.width);
  const maxY = Math.max(first.y + first.height, second.y + second.height);

  return {
    height: maxY - minY,
    width: maxX - minX,
    x: minX,
    y: minY,
  };
}

function expandBounds(bounds: WorldBounds, padding: number): WorldBounds {
  return {
    height: Math.ceil(bounds.height + padding * 2),
    width: Math.ceil(bounds.width + padding * 2),
    x: Math.floor(bounds.x - padding),
    y: Math.floor(bounds.y - padding),
  };
}

function chunkToBounds(chunk: DrawingChunk): WorldBounds {
  return {
    height: DRAWING_CHUNK_SIZE,
    width: DRAWING_CHUNK_SIZE,
    x: chunk.x,
    y: chunk.y,
  };
}

function boundsIntersect(first: WorldBounds, second: WorldBounds) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function isCanvasTransparent(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return true;
  }

  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] > 0) {
      return false;
    }
  }

  return true;
}

function floodFillCustomDrawing(
  chunks: DrawingChunkMap,
  start: Point,
  fillColor: string,
  resetContext: (context: CanvasRenderingContext2D) => void,
) {
  const contentBounds = getChunkContentBounds(chunks);
  if (!contentBounds) {
    return null;
  }

  const bounds = expandBounds(contentBounds, 180);
  const width = Math.ceil(bounds.width);
  const height = Math.ceil(bounds.height);
  const startX = Math.floor(start.x - bounds.x);
  const startY = Math.floor(start.y - bounds.y);
  if (
    width < 1 ||
    height < 1 ||
    width * height > MAX_FILL_PIXELS ||
    startX < 0 ||
    startY < 0 ||
    startX >= width ||
    startY >= height
  ) {
    return null;
  }

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!sourceContext) {
    return null;
  }

  sourceContext.translate(-bounds.x, -bounds.y);
  renderChunksToCanvas(sourceContext, chunks, bounds);
  sourceContext.setTransform(1, 0, 0, 1, 0, 0);

  const sourceImage = sourceContext.getImageData(0, 0, width, height);
  const source = sourceImage.data;
  const startIndex = startY * width + startX;

  if (isBlockedByBoundary(source, width, height, startX, startY)) {
    return null;
  }

  const totalPixels = width * height;
  const safeLimit = Math.floor(totalPixels * FLOOD_FILL_SAFETY_RATIO);
  const visited = new Uint8Array(totalPixels);
  const stack = new Uint32Array(totalPixels);
  let stackLength = 0;
  let fillCount = 0;
  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;

  stack[stackLength] = startIndex;
  visited[startIndex] = 1;
  stackLength += 1;

  while (stackLength > 0) {
    stackLength -= 1;
    const pixelIndex = stack[stackLength];

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (isBlockedByBoundary(source, width, height, x, y)) {
      continue;
    }

    visited[pixelIndex] = 2;
    fillCount += 1;

    if (fillCount > safeLimit) {
      return null;
    }

    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
      return null;
    }

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    if (x > 0) {
      stackLength = pushFloodPixel(stack, stackLength, pixelIndex - 1, visited);
    }
    if (x < width - 1) {
      stackLength = pushFloodPixel(stack, stackLength, pixelIndex + 1, visited);
    }
    if (y > 0) {
      stackLength = pushFloodPixel(stack, stackLength, pixelIndex - width, visited);
    }
    if (y < height - 1) {
      stackLength = pushFloodPixel(stack, stackLength, pixelIndex + width, visited);
    }
  }

  if (fillCount < FLOOD_FILL_MIN_PIXELS) {
    return null;
  }

  const fillCanvas = document.createElement("canvas");
  fillCanvas.width = width;
  fillCanvas.height = height;
  const fillContext = fillCanvas.getContext("2d");
  if (!fillContext) {
    return null;
  }

  const fill = parseHexColor(fillColor);
  const fillImage = fillContext.createImageData(width, height);
  const fillData = fillImage.data;

  for (let y = minY; y <= maxY; y += 1) {
    const row = y * width;
    for (let x = minX; x <= maxX; x += 1) {
      const pixelIndex = row + x;
      if (visited[pixelIndex] !== 2) {
        continue;
      }

      const dataIndex = pixelIndex * 4;
      fillData[dataIndex] = fill.r;
      fillData[dataIndex + 1] = fill.g;
      fillData[dataIndex + 2] = fill.b;
      fillData[dataIndex + 3] = 230;
    }
  }

  fillContext.putImageData(fillImage, 0, 0);

  drawImageToChunks(chunks, resetContext, fillCanvas, bounds, "destination-over");

  return serializeDrawingChunks(chunks);
}

function pushFloodPixel(
  stack: Uint32Array,
  stackLength: number,
  pixelIndex: number,
  visited: Uint8Array,
) {
  if (visited[pixelIndex] === 0 && stackLength < stack.length) {
    visited[pixelIndex] = 1;
    stack[stackLength] = pixelIndex;
    return stackLength + 1;
  }

  return stackLength;
}

function isBlockedByBoundary(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    const nextY = y + offsetY;
    if (nextY < 0 || nextY >= height) {
      continue;
    }

    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const nextX = x + offsetX;
      if (nextX < 0 || nextX >= width) {
        continue;
      }

      if (data[(nextY * width + nextX) * 4 + 3] > FLOOD_FILL_BOUNDARY_ALPHA) {
        return true;
      }
    }
  }

  return false;
}

function parseHexColor(hexColor: string) {
  const normalized = hexColor.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((digit) => `${digit}${digit}`)
          .join("")
      : normalized;

  const value = Number.parseInt(expanded, 16);
  return {
    b: value & 255,
    g: (value >> 8) & 255,
    r: (value >> 16) & 255,
  };
}

type CreativeDrawOptions = {
  color: string;
  opacity: number;
  textureIntensity: number;
  tool: DrawingTool;
  width: number;
};

function drawCreativeSegment(
  context: CanvasRenderingContext2D,
  previous: Point,
  point: Point,
  options: CreativeDrawOptions,
) {
  context.save();
  context.globalCompositeOperation =
    options.tool === "eraser" ? "destination-out" : "source-over";
  context.strokeStyle = options.color;
  context.lineCap = "round";
  context.lineJoin = "round";

  const texture = clamp(options.textureIntensity, 0, 1);
  const opacity = clamp(options.opacity, 0.05, 1);

  if (options.tool === "pencil") {
    drawCurve(context, previous, point, options.width * 0.42, 0.72 * opacity);
    drawCurve(
      context,
      jitter(previous, 0.5 + texture * 1.7),
      jitter(point, 0.5 + texture * 1.7),
      Math.max(1, options.width * 0.18),
      0.28 * opacity,
    );
  } else if (options.tool === "marker") {
    drawCurve(context, previous, point, options.width * 1.35, 0.92 * opacity);
  } else if (options.tool === "crayon") {
    const passes = 2 + Math.round(texture * 5);
    for (let index = 0; index < passes; index += 1) {
      drawCurve(
        context,
        jitter(previous, 1.5 + texture * 4),
        jitter(point, 1.5 + texture * 4),
        Math.max(1.5, options.width * (0.38 + Math.random() * 0.24)),
        0.24 * opacity,
      );
    }
  } else if (options.tool === "paint-brush") {
    drawCurve(
      context,
      previous,
      point,
      options.width * (1.1 + Math.random() * 0.45),
      (0.68 + Math.random() * 0.18) * opacity,
    );
    drawCurve(
      context,
      jitter(previous, 0.8 + texture * 2.7),
      jitter(point, 0.8 + texture * 2.7),
      options.width * 0.45,
      0.28 * opacity,
    );
  } else if (options.tool === "chalk") {
    const passes = 2 + Math.round(texture * 5);
    for (let index = 0; index < passes; index += 1) {
      drawCurve(
        context,
        jitter(previous, 1.8 + texture * 5),
        jitter(point, 1.8 + texture * 5),
        Math.max(1, options.width * 0.32),
        0.18 * opacity,
      );
    }
  } else if (options.tool === "highlighter") {
    drawCurve(context, previous, point, options.width * 2.7, 0.34 * opacity);
  } else if (options.tool === "eraser") {
    drawCurve(context, previous, point, options.width * 2.6, 1);
  }

  context.restore();
}

function drawCurve(
  context: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  width: number,
  alpha: number,
) {
  context.globalAlpha = alpha;
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
}

function jitter(point: Point, amount: number) {
  return {
    x: point.x + (Math.random() - 0.5) * amount,
    y: point.y + (Math.random() - 0.5) * amount,
  };
}

const PAPER_BACKGROUND = {
  color: "#fffdf7",
  image:
    "radial-gradient(rgba(15,23,42,0.045) 0.7px, transparent 0.7px), linear-gradient(135deg, rgba(255,255,255,0.8), rgba(248,250,252,0.35))",
};

function createInfiniteBoardStyle(
  gridMode: GridMode,
  viewport: ViewportState,
): CSSProperties {
  const zoom = clamp(viewport.zoom, MIN_ZOOM, MAX_ZOOM);
  const textureSize = `${Math.max(8, 20 * zoom)}px ${Math.max(8, 20 * zoom)}px`;
  const worldPosition = `${viewport.x}px ${viewport.y}px`;

  if (gridMode === "grid") {
    return {
      backgroundColor: PAPER_BACKGROUND.color,
      backgroundImage:
        "linear-gradient(rgba(15,23,42,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.08) 1px, transparent 1px), radial-gradient(rgba(15,23,42,0.045) 0.7px, transparent 0.7px), linear-gradient(135deg, rgba(255,255,255,0.82), rgba(248,250,252,0.36))",
      backgroundPosition: `${worldPosition}, ${worldPosition}, ${worldPosition}, 0 0`,
      backgroundSize: `${42 * zoom}px ${42 * zoom}px, ${42 * zoom}px ${42 * zoom}px, ${textureSize}, auto`,
    };
  }

  if (gridMode === "dots") {
    return {
      backgroundColor: PAPER_BACKGROUND.color,
      backgroundImage:
        "radial-gradient(rgba(15,23,42,0.18) 1.2px, transparent 1.2px), radial-gradient(rgba(15,23,42,0.045) 0.7px, transparent 0.7px), linear-gradient(135deg, rgba(255,255,255,0.82), rgba(248,250,252,0.36))",
      backgroundPosition: `${worldPosition}, ${worldPosition}, 0 0`,
      backgroundSize: `${28 * zoom}px ${28 * zoom}px, ${textureSize}, auto`,
    };
  }

  return {
    backgroundColor: PAPER_BACKGROUND.color,
    backgroundImage: PAPER_BACKGROUND.image,
    backgroundPosition: `${worldPosition}, 0 0`,
    backgroundSize: `${textureSize}, auto`,
  };
}

function renderBoardBackground(
  context: CanvasRenderingContext2D,
  gridMode: GridMode,
  bounds: WorldBounds,
) {
  context.fillStyle = PAPER_BACKGROUND.color;
  context.fillRect(0, 0, bounds.width, bounds.height);

  context.fillStyle = "rgba(15, 23, 42, 0.035)";
  const speckleStartX = Math.floor((bounds.x - 10) / 20) * 20 + 10;
  const speckleStartY = Math.floor((bounds.y - 10) / 20) * 20 + 10;
  for (let y = speckleStartY; y < bounds.y + bounds.height; y += 20) {
    for (let x = speckleStartX; x < bounds.x + bounds.width; x += 20) {
      context.fillRect(x - bounds.x, y - bounds.y, 1, 1);
    }
  }

  if (gridMode === "grid") {
    context.strokeStyle = "rgba(15,23,42,0.08)";
    context.lineWidth = 1;
    const gridStartX = Math.floor(bounds.x / 42) * 42;
    const gridStartY = Math.floor(bounds.y / 42) * 42;
    for (let x = gridStartX; x < bounds.x + bounds.width; x += 42) {
      context.beginPath();
      context.moveTo(x - bounds.x, 0);
      context.lineTo(x - bounds.x, bounds.height);
      context.stroke();
    }
    for (let y = gridStartY; y < bounds.y + bounds.height; y += 42) {
      context.beginPath();
      context.moveTo(0, y - bounds.y);
      context.lineTo(bounds.width, y - bounds.y);
      context.stroke();
    }
  }

  if (gridMode === "dots") {
    context.fillStyle = "rgba(15,23,42,0.16)";
    const dotStartX = Math.floor((bounds.x - 14) / 28) * 28 + 14;
    const dotStartY = Math.floor((bounds.y - 14) / 28) * 28 + 14;
    for (let y = dotStartY; y < bounds.y + bounds.height; y += 28) {
      for (let x = dotStartX; x < bounds.x + bounds.width; x += 28) {
        context.beginPath();
        context.arc(x - bounds.x, y - bounds.y, 1.2, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
}

function renderElementsToCanvas(
  context: CanvasRenderingContext2D,
  elements: WhiteboardElement[],
) {
  for (const element of elements) {
    renderShapeToCanvas(context, element);
  }
}

function renderShapeToCanvas(context: CanvasRenderingContext2D, element: ShapeElementData) {
  context.save();
  context.translate(element.x + element.width / 2, element.y + element.height / 2);
  context.rotate((element.rotation * Math.PI) / 180);
  context.translate(-element.width / 2, -element.height / 2);
  context.fillStyle = element.fillColor;
  context.strokeStyle = element.borderColor;
  context.lineWidth = element.borderWidth;
  context.lineCap = "round";
  context.lineJoin = "round";

  const w = element.width;
  const h = element.height;

  context.beginPath();
  addShapePath(context, element.kind, w, h);
  context.fill();
  context.stroke();
  context.restore();
}

function addShapePath(
  context: CanvasRenderingContext2D,
  kind: ShapeKind,
  width: number,
  height: number,
) {
  const x = (value: number) => (value / 100) * width;
  const y = (value: number) => (value / 100) * height;

  if (kind === "rectangle") {
    roundedRect(context, x(8), y(10), x(84), y(80), Math.min(x(2), y(2)));
  } else if (kind === "rounded-rectangle") {
    roundedRect(
      context,
      x(8),
      y(10),
      x(84),
      y(80),
      Math.min(x(16), y(16)),
    );
  } else if (kind === "circle") {
    context.ellipse(x(50), y(50), x(42), y(40), 0, 0, Math.PI * 2);
  } else if (kind === "triangle") {
    context.moveTo(x(50), y(8));
    context.lineTo(x(94), y(90));
    context.lineTo(x(6), y(90));
    context.closePath();
  } else if (kind === "star") {
    starPath(context, x, y);
  } else if (kind === "heart") {
    heartPath(context, x, y);
  } else if (kind === "cloud") {
    cloudPath(context, x, y);
  } else if (kind === "speech-bubble") {
    speechBubblePath(context, x, y);
  } else {
    context.moveTo(x(8), y(38));
    context.lineTo(x(58), y(38));
    context.lineTo(x(58), y(12));
    context.lineTo(x(92), y(52));
    context.lineTo(x(58), y(88));
    context.lineTo(x(58), y(62));
    context.lineTo(x(8), y(62));
    context.closePath();
  }
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
}

function starPath(
  context: CanvasRenderingContext2D,
  x: (value: number) => number,
  y: (value: number) => number,
) {
  context.moveTo(x(50), y(6));
  context.lineTo(x(62), y(36));
  context.lineTo(x(94), y(38));
  context.lineTo(x(69), y(58));
  context.lineTo(x(77), y(90));
  context.lineTo(x(50), y(72));
  context.lineTo(x(23), y(90));
  context.lineTo(x(31), y(58));
  context.lineTo(x(6), y(38));
  context.lineTo(x(38), y(36));
  context.closePath();
}

function heartPath(
  context: CanvasRenderingContext2D,
  x: (value: number) => number,
  y: (value: number) => number,
) {
  context.moveTo(x(50), y(88));
  context.bezierCurveTo(x(26), y(66), x(12), y(52), x(12), y(33));
  context.bezierCurveTo(x(12), y(20), x(22), y(10), x(35), y(10));
  context.bezierCurveTo(x(42), y(10), x(48), y(13), x(50), y(19));
  context.bezierCurveTo(x(52), y(13), x(58), y(10), x(65), y(10));
  context.bezierCurveTo(x(78), y(10), x(88), y(20), x(88), y(33));
  context.bezierCurveTo(x(88), y(52), x(74), y(66), x(50), y(88));
  context.closePath();
}

function cloudPath(
  context: CanvasRenderingContext2D,
  x: (value: number) => number,
  y: (value: number) => number,
) {
  context.moveTo(x(28), y(76));
  context.bezierCurveTo(x(15), y(76), x(5), y(67), x(5), y(55));
  context.bezierCurveTo(x(5), y(44), x(13), y(35), x(24), y(34));
  context.bezierCurveTo(x(29), y(20), x(42), y(11), x(57), y(15));
  context.bezierCurveTo(x(70), y(18), x(80), y(29), x(82), y(42));
  context.bezierCurveTo(x(90), y(45), x(95), y(52), x(95), y(60));
  context.bezierCurveTo(x(95), y(70), x(87), y(76), x(76), y(76));
  context.closePath();
}

function speechBubblePath(
  context: CanvasRenderingContext2D,
  x: (value: number) => number,
  y: (value: number) => number,
) {
  context.moveTo(x(10), y(17));
  context.lineTo(x(90), y(17));
  context.lineTo(x(90), y(69));
  context.lineTo(x(58), y(69));
  context.lineTo(x(43), y(88));
  context.lineTo(x(43), y(69));
  context.lineTo(x(10), y(69));
  context.closePath();
}
