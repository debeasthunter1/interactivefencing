"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import type { PointerEvent, WheelEvent } from "react";
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

type DrawingMode = "draw" | "shape" | "pan" | "idle";

type ShapeDraft = {
  baseElements: WhiteboardElement[];
  id: string;
  next: ShapeElementData;
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
  const elementsRef = useRef(elements);
  const lastPointRef = useRef<Point | null>(null);
  const onCanvasReadyRef = useRef(onCanvasReady);
  const panStartRef = useRef<PanStart | null>(null);
  const pendingStrokeRef = useRef<StrokeSegment[]>([]);
  const rafRef = useRef<number | null>(null);
  const shapeDraftRef = useRef<ShapeDraft | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const startPointRef = useRef<Point | null>(null);
  const toolRef = useRef(tool);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    onCanvasReadyRef.current = onCanvasReady;
  }, [onCanvasReady]);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  const boardStyle = useMemo(
    () => createBoardStyle(gridMode),
    [gridMode],
  );

  const resetContext = useCallback((context: CanvasRenderingContext2D) => {
    const ratio = Number(canvasRef.current?.dataset.pixelRatio || 1);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  }, []);

  const getCanvasDataUrl = useCallback(() => {
    const canvas = canvasRef.current;
    return canvas ? canvas.toDataURL("image/png") : null;
  }, []);

  const restoreCanvas = useCallback(
    (snapshot: string) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) {
        return;
      }

      const image = new Image();
      image.onload = () => {
        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        context.restore();
        resetContext(context);
      };
      image.src = snapshot;
    },
    [resetContext],
  );

  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    const currentSnapshot = canvas.width ? canvas.toDataURL("image/png") : null;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);

    canvas.dataset.pixelRatio = String(ratio);
    canvas.width = Math.round(BOARD_WIDTH * ratio);
    canvas.height = Math.round(BOARD_HEIGHT * ratio);
    canvas.style.width = `${BOARD_WIDTH}px`;
    canvas.style.height = `${BOARD_HEIGHT}px`;

    resetContext(context);

    if (currentSnapshot) {
      restoreCanvas(currentSnapshot);
    } else {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.restore();
      resetContext(context);
      onCanvasReadyRef.current(canvas.toDataURL("image/png"));
    }
  }, [resetContext, restoreCanvas]);

  useEffect(() => {
    initializeCanvas();
  }, [initializeCanvas]);

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
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (canvas && rect && rect.width > 0 && rect.height > 0) {
        const ratio = Number(canvas.dataset.pixelRatio || 1);
        const logicalWidth = canvas.width / ratio;
        const logicalHeight = canvas.height / ratio;

        return {
          x: (clientX - rect.left) * (logicalWidth / rect.width),
          y: (clientY - rect.top) * (logicalHeight / rect.height),
        };
      }

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
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      pendingStrokeRef.current = [];
      rafRef.current = null;
      return;
    }

    const segments = pendingStrokeRef.current.splice(0);
    rafRef.current = null;

    for (const segment of segments) {
      drawCreativeSegment(context, segment.from, segment.to, {
        color: strokeColor,
        opacity: strokeOpacity,
        textureIntensity,
        tool: segment.tool,
        width: strokeWidth,
      });
    }
  }, [strokeColor, strokeOpacity, strokeWidth, textureIntensity]);

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
        canvas,
        point,
        fillColor,
        resetContext,
      );
      if (snapshot) {
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
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      drawingModeRef.current = "draw";
      drawCreativePoint(context, point, {
        color: strokeColor,
        opacity: strokeOpacity,
        textureIntensity,
        tool,
        width: strokeWidth,
      });
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
    onCanvasCommit(canvas.toDataURL("image/png"));
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
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return null;
    }

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    resetContext(context);
    return canvas.toDataURL("image/png");
  }, [resetContext]);

  const exportImage = useCallback(
    (format: ExportFormat = "image/png") => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return null;
      }

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = BOARD_WIDTH;
      exportCanvas.height = BOARD_HEIGHT;
      const context = exportCanvas.getContext("2d");
      if (!context) {
        return null;
      }

      renderBoardBackground(context, gridMode);
      context.drawImage(canvas, 0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      renderElementsToCanvas(context, elements);

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
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) {
          resolve(null);
          return;
        }

        const image = new Image();
        image.onload = () => {
          context.save();
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.restore();
          resetContext(context);

          const maxWidth = BOARD_WIDTH * 0.76;
          const maxHeight = BOARD_HEIGHT * 0.76;
          const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
          const width = image.width * scale;
          const height = image.height * scale;
          const x = (BOARD_WIDTH - width) / 2;
          const y = (BOARD_HEIGHT - height) / 2;

          context.drawImage(image, x, y, width, height);
          resolve(canvas.toDataURL("image/png"));
        };
        image.onerror = () => resolve(null);
        image.src = imageUrl;
      }),
    [resetContext],
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
      className="relative h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_20%_12%,#fff7ad_0,transparent_24%),radial-gradient(circle_at_78%_18%,#ffd6e8_0,transparent_26%),linear-gradient(135deg,#e0f2fe_0%,#fff7ed_42%,#f5d0fe_100%)] text-slate-950"
      onWheel={handleWheel}
    >
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div
        className="absolute left-0 top-0 overflow-hidden rounded-[28px] shadow-[0_34px_100px_rgba(88,28,135,0.2)] transition-[box-shadow,filter] duration-300"
        style={{
          ...boardStyle,
          height: BOARD_HEIGHT,
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
          width: BOARD_WIDTH,
        }}
      >
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

        <div className="absolute inset-0 pointer-events-none">
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

function floodFillCustomDrawing(
  canvas: HTMLCanvasElement,
  start: Point,
  fillColor: string,
  resetContext: (context: CanvasRenderingContext2D) => void,
) {
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = BOARD_WIDTH;
  sourceCanvas.height = BOARD_HEIGHT;
  const sourceContext = sourceCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  const canvasContext = canvas.getContext("2d");

  if (!sourceContext || !canvasContext) {
    return null;
  }

  sourceContext.drawImage(canvas, 0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const startX = clamp(Math.floor(start.x), 0, width - 1);
  const startY = clamp(Math.floor(start.y), 0, height - 1);
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

  const originalCanvas = document.createElement("canvas");
  originalCanvas.width = canvas.width;
  originalCanvas.height = canvas.height;
  const originalContext = originalCanvas.getContext("2d");
  if (!originalContext) {
    return null;
  }
  originalContext.drawImage(canvas, 0, 0);

  canvasContext.save();
  canvasContext.setTransform(1, 0, 0, 1, 0, 0);
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  canvasContext.restore();
  resetContext(canvasContext);
  canvasContext.drawImage(fillCanvas, 0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  canvasContext.drawImage(originalCanvas, 0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  return canvas.toDataURL("image/png");
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

function drawCreativePoint(
  context: CanvasRenderingContext2D,
  point: Point,
  options: CreativeDrawOptions,
) {
  drawCreativeSegment(
    context,
    { x: point.x - 0.01, y: point.y - 0.01 },
    { x: point.x + 0.01, y: point.y + 0.01 },
    options,
  );
}

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

function createBoardStyle(gridMode: GridMode) {
  const grid =
    gridMode === "grid"
      ? "linear-gradient(rgba(15,23,42,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.08) 1px, transparent 1px), "
      : gridMode === "dots"
        ? "radial-gradient(rgba(15,23,42,0.18) 1.2px, transparent 1.2px), "
        : "";
  const gridSize =
    gridMode === "grid" ? "42px 42px, 42px 42px, auto" : gridMode === "dots" ? "28px 28px, auto" : "auto";

  return {
    backgroundColor: PAPER_BACKGROUND.color,
    backgroundImage: `${grid}${PAPER_BACKGROUND.image}`,
    backgroundSize: gridSize,
  };
}

function renderBoardBackground(context: CanvasRenderingContext2D, gridMode: GridMode) {
  context.fillStyle = PAPER_BACKGROUND.color;
  context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  context.fillStyle = "rgba(15, 23, 42, 0.035)";
  for (let y = 10; y < BOARD_HEIGHT; y += 20) {
    for (let x = 10; x < BOARD_WIDTH; x += 20) {
      context.fillRect(x, y, 1, 1);
    }
  }

  if (gridMode === "grid") {
    context.strokeStyle = "rgba(15,23,42,0.08)";
    context.lineWidth = 1;
    for (let x = 0; x < BOARD_WIDTH; x += 42) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, BOARD_HEIGHT);
      context.stroke();
    }
    for (let y = 0; y < BOARD_HEIGHT; y += 42) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(BOARD_WIDTH, y);
      context.stroke();
    }
  }

  if (gridMode === "dots") {
    context.fillStyle = "rgba(15,23,42,0.16)";
    for (let y = 14; y < BOARD_HEIGHT; y += 28) {
      for (let x = 14; x < BOARD_WIDTH; x += 28) {
        context.beginPath();
        context.arc(x, y, 1.2, 0, Math.PI * 2);
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
  if (kind === "rectangle") {
    context.rect(0, 0, width, height);
  } else if (kind === "rounded-rectangle") {
    roundedRect(
      context,
      0,
      0,
      width,
      height,
      Math.min(32, width * 0.18, height * 0.18),
    );
  } else if (kind === "circle") {
    context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  } else if (kind === "triangle") {
    context.moveTo(width / 2, 0);
    context.lineTo(width, height);
    context.lineTo(0, height);
    context.closePath();
  } else if (kind === "star") {
    starPath(context, width, height);
  } else if (kind === "heart") {
    heartPath(context, width, height);
  } else if (kind === "cloud") {
    cloudPath(context, width, height);
  } else if (kind === "speech-bubble") {
    speechBubblePath(context, width, height);
  } else {
    context.moveTo(0, height * 0.38);
    context.lineTo(width * 0.58, height * 0.38);
    context.lineTo(width * 0.58, height * 0.12);
    context.lineTo(width, height / 2);
    context.lineTo(width * 0.58, height * 0.88);
    context.lineTo(width * 0.58, height * 0.62);
    context.lineTo(0, height * 0.62);
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

function starPath(context: CanvasRenderingContext2D, width: number, height: number) {
  const centerX = width / 2;
  const centerY = height / 2;
  const outer = Math.min(width, height) / 2;
  const inner = outer * 0.45;
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const radius = index % 2 === 0 ? outer : inner;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
}

function heartPath(context: CanvasRenderingContext2D, width: number, height: number) {
  context.moveTo(width / 2, height * 0.9);
  context.bezierCurveTo(width * 0.08, height * 0.62, 0, height * 0.28, width * 0.24, height * 0.12);
  context.bezierCurveTo(width * 0.38, height * 0.02, width * 0.49, height * 0.12, width / 2, height * 0.24);
  context.bezierCurveTo(width * 0.51, height * 0.12, width * 0.62, height * 0.02, width * 0.76, height * 0.12);
  context.bezierCurveTo(width, height * 0.28, width * 0.92, height * 0.62, width / 2, height * 0.9);
  context.closePath();
}

function cloudPath(context: CanvasRenderingContext2D, width: number, height: number) {
  context.moveTo(width * 0.25, height * 0.76);
  context.bezierCurveTo(width * 0.04, height * 0.76, 0, height * 0.54, width * 0.18, height * 0.44);
  context.bezierCurveTo(width * 0.2, height * 0.2, width * 0.42, height * 0.1, width * 0.58, height * 0.22);
  context.bezierCurveTo(width * 0.78, height * 0.14, width * 0.92, height * 0.32, width * 0.84, height * 0.5);
  context.bezierCurveTo(width, height * 0.54, width * 0.96, height * 0.76, width * 0.76, height * 0.76);
  context.closePath();
}

function speechBubblePath(context: CanvasRenderingContext2D, width: number, height: number) {
  roundedRect(context, 0, 0, width, height * 0.78, Math.min(28, width * 0.12));
  context.moveTo(width * 0.44, height * 0.78);
  context.lineTo(width * 0.32, height);
  context.lineTo(width * 0.62, height * 0.78);
}
