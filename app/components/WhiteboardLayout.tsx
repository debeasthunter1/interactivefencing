"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AIResultModal } from "./AIResultModal";
import { BottomCreativeControls } from "./BottomCreativeControls";
import { CreativeToolbar } from "./CreativeToolbar";
import { FloatingActionButtons } from "./FloatingActionButtons";
import { LoadingOverlay } from "./LoadingOverlay";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  WhiteboardCanvas,
  type WhiteboardCanvasHandle,
} from "./WhiteboardCanvas";
import { createExportFileName, downloadDataUrl } from "@/app/lib/canvas-export";
import type {
  BoardSnapshot,
  GridMode,
  ShapeElementData,
  ViewportState,
  WhiteboardElement,
  WhiteboardTool,
} from "@/app/types/whiteboard";

const HISTORY_LIMIT = 50;

type OptimizeDrawingResponse = {
  error?: string;
  imageUrl?: string;
};

type AIResult = {
  generated: string;
  original: string;
};

export function WhiteboardLayout() {
  const canvasRef = useRef<WhiteboardCanvasHandle | null>(null);
  const hasInitialHistoryRef = useRef(false);

  const [tool, setTool] = useState<WhiteboardTool>("pencil");
  const [strokeColor, setStrokeColor] = useState("#0f172a");
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [strokeOpacity, setStrokeOpacity] = useState(0.86);
  const [textureIntensity, setTextureIntensity] = useState(0.58);
  const [fillColor, setFillColor] = useState("#fef3c7");
  const [borderColor, setBorderColor] = useState("#0f172a");
  const [borderWidth, setBorderWidth] = useState(5);
  const [gridMode, setGridMode] = useState<GridMode>("dots");
  const [viewport, setViewport] = useState<ViewportState>({
    x: 88,
    y: 52,
    zoom: 0.58,
  });
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [history, setHistory] = useState<BoardSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);

  const selectedElement = useMemo(
    () => elements.find((element) => element.id === selectedElementId) ?? null,
    [elements, selectedElementId],
  );

  const selectedShapeElement = selectedElement;

  const commitSnapshot = useCallback(
    (canvasDataUrl: string, nextElements: WhiteboardElement[]) => {
      const snapshot = {
        canvasDataUrl,
        elements: cloneElements(nextElements),
      };

      setHistory((current) => {
        const base = historyIndex >= 0 ? current.slice(0, historyIndex + 1) : [];
        const previous = base.at(-1);
        const serializedPrevious = previous ? JSON.stringify(previous) : "";
        const serializedNext = JSON.stringify(snapshot);

        if (serializedPrevious === serializedNext) {
          return current;
        }

        const nextHistory = [...base, snapshot].slice(-HISTORY_LIMIT);
        setHistoryIndex(nextHistory.length - 1);
        return nextHistory;
      });
    },
    [historyIndex],
  );

  const applySnapshot = useCallback((snapshot: BoardSnapshot) => {
    canvasRef.current?.restoreCanvas(snapshot.canvasDataUrl);
    setElements(cloneElements(snapshot.elements));
    setSelectedElementId(null);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) {
      return;
    }

    const nextIndex = historyIndex - 1;
    const snapshot = history[nextIndex];
    if (!snapshot) {
      return;
    }

    setHistoryIndex(nextIndex);
    applySnapshot(snapshot);
  }, [applySnapshot, history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) {
      return;
    }

    const nextIndex = historyIndex + 1;
    const snapshot = history[nextIndex];
    if (!snapshot) {
      return;
    }

    setHistoryIndex(nextIndex);
    applySnapshot(snapshot);
  }, [applySnapshot, history, historyIndex]);

  const commitCurrentBoard = useCallback(
    (nextElements: WhiteboardElement[] = elements) => {
      const canvasDataUrl = canvasRef.current?.getCanvasDataUrl();
      if (canvasDataUrl) {
        commitSnapshot(canvasDataUrl, nextElements);
      }
    },
    [commitSnapshot, elements],
  );

  const updateElements = (nextElements: WhiteboardElement[]) => {
    setElements(nextElements);
  };

  const commitElements = (nextElements: WhiteboardElement[]) => {
    setElements(nextElements);
    commitCurrentBoard(nextElements);
  };

  const handleDeleteSelected = useCallback(() => {
    if (!selectedElementId) {
      return;
    }

    const nextElements = elements.filter(
      (element) => element.id !== selectedElementId,
    );
    setElements(nextElements);
    setSelectedElementId(null);
    commitCurrentBoard(nextElements);
  }, [commitCurrentBoard, elements, selectedElementId]);

  const handleClear = () => {
    const snapshot = canvasRef.current?.clear();
    const nextElements: WhiteboardElement[] = [];
    setElements(nextElements);
    setSelectedElementId(null);

    if (snapshot) {
      commitSnapshot(snapshot, nextElements);
    }
  };

  const handleExport = () => {
    const exportUrl = canvasRef.current?.exportImage("image/png");
    if (!exportUrl) {
      setErrorMessage("The whiteboard could not be exported.");
      return;
    }

    downloadDataUrl(exportUrl, createExportFileName("whiteboard"));
  };

  const handleGenerate = async () => {
    const original = canvasRef.current?.exportImage("image/png");
    if (!original) {
      setErrorMessage("The whiteboard could not be captured.");
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/optimize-drawing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: original }),
      });

      const payload = (await response.json()) as OptimizeDrawingResponse;
      if (!response.ok) {
        throw new Error(payload.error || "The AI generation request failed.");
      }

      if (!payload.imageUrl) {
        throw new Error("The AI response did not include an image.");
      }

      setAiResult({
        generated: payload.imageUrl,
        original,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while generating the AI version.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const showFillHint = (message: string) => {
    setHintMessage(message);
    window.setTimeout(() => {
      setHintMessage((current) => (current === message ? null : current));
    }, 2400);
  };

  const handleReplaceWithResult = async () => {
    if (!aiResult) {
      return;
    }

    const snapshot = await canvasRef.current?.replaceWithImage(aiResult.generated);
    if (!snapshot) {
      setErrorMessage("The generated result could not be placed on the board.");
      return;
    }

    const nextElements: WhiteboardElement[] = [];
    setElements(nextElements);
    setSelectedElementId(null);
    setAiResult(null);
    commitSnapshot(snapshot, nextElements);
  };

  const updateSelectedShape = (updates: Partial<ShapeElementData>) => {
    if (!selectedShapeElement) {
      return;
    }

    const nextElements = elements.map((element) =>
      element.id === selectedShapeElement.id && element.type === "shape"
        ? { ...element, ...updates }
        : element,
    );
    setElements(nextElements);
    commitCurrentBoard(nextElements);
  };

  useEffect(() => {
    const centerBoard = () => {
      const zoom = window.innerWidth < 768 ? 0.36 : 0.58;
      setViewport({
        x: (window.innerWidth - BOARD_WIDTH * zoom) / 2,
        y: (window.innerHeight - BOARD_HEIGHT * zoom) / 2,
        zoom,
      });
    };

    centerBoard();
  }, []);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA";

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (isEditing) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        handleDeleteSelected();
        return;
      }

      const nextTool = shortcutToTool(event.key);
      if (nextTool) {
        setTool(nextTool);
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [handleDeleteSelected, handleRedo, handleUndo]);

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <section aria-label="Infinite canvas world" className="absolute inset-0 z-0">
        <WhiteboardCanvas
          ref={canvasRef}
          borderColor={borderColor}
          borderWidth={borderWidth}
          elements={elements}
          fillColor={fillColor}
          gridMode={gridMode}
          selectedElementId={selectedElementId}
          strokeColor={strokeColor}
          strokeOpacity={strokeOpacity}
          strokeWidth={strokeWidth}
          textureIntensity={textureIntensity}
          tool={tool}
          viewport={viewport}
          onCanvasCommit={(snapshot) => commitSnapshot(snapshot, elements)}
          onCanvasReady={(snapshot) => {
            if (!hasInitialHistoryRef.current) {
              hasInitialHistoryRef.current = true;
              commitSnapshot(snapshot, elements);
            }
          }}
          onElementCommit={commitElements}
          onElementsChange={updateElements}
          onFillMiss={showFillHint}
          onSelectElement={setSelectedElementId}
          onViewportChange={setViewport}
        />
      </section>

      <section
        aria-label="Fixed whiteboard controls"
        className="pointer-events-none fixed inset-0 z-50"
      >
        <CreativeToolbar
          activeTool={tool}
          canRedo={historyIndex < history.length - 1}
          canUndo={historyIndex > 0}
          onRedo={handleRedo}
          onToolChange={setTool}
          onUndo={handleUndo}
        />

        <FloatingActionButtons
          isGenerating={isGenerating}
          viewport={viewport}
          onClear={handleClear}
          onExport={handleExport}
          onGenerate={handleGenerate}
          onViewportChange={setViewport}
        />

        <BottomCreativeControls
          borderColor={borderColor}
          borderWidth={borderWidth}
          fillColor={fillColor}
          onGridModeChange={setGridMode}
          gridMode={gridMode}
          selectedShapeElement={selectedShapeElement}
          strokeColor={strokeColor}
          strokeOpacity={strokeOpacity}
          strokeWidth={strokeWidth}
          textureIntensity={textureIntensity}
          onBorderColorChange={setBorderColor}
          onBorderWidthChange={setBorderWidth}
          onFillColorChange={setFillColor}
          onShapeStyleChange={updateSelectedShape}
          onStrokeColorChange={setStrokeColor}
          onStrokeOpacityChange={setStrokeOpacity}
          onStrokeWidthChange={setStrokeWidth}
          onTextureIntensityChange={setTextureIntensity}
        />
      </section>

      {errorMessage ? (
        <div
          role="alert"
          className="fixed bottom-40 left-1/2 z-40 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-medium text-red-700 shadow-xl shadow-red-950/10"
        >
          {errorMessage}
        </div>
      ) : null}

      {hintMessage ? (
        <div
          role="status"
          className="fixed bottom-40 left-1/2 z-40 w-[min(460px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-amber-100 bg-white/92 px-4 py-3 text-sm font-bold text-slate-700 shadow-xl shadow-amber-950/10 backdrop-blur-xl"
        >
          {hintMessage}
        </div>
      ) : null}

      {isGenerating ? <LoadingOverlay /> : null}

      {aiResult ? (
        <AIResultModal
          generatedImageUrl={aiResult.generated}
          originalImageUrl={aiResult.original}
          onClose={() => setAiResult(null)}
          onDownload={() =>
            downloadDataUrl(aiResult.generated, createExportFileName("ai-whiteboard"))
          }
          onGenerateAgain={handleGenerate}
          onReplaceWhiteboard={handleReplaceWithResult}
        />
      ) : null}
    </main>
  );
}

function cloneElements(elements: WhiteboardElement[]) {
  return elements.map((element) => ({ ...element }));
}

function shortcutToTool(key: string): WhiteboardTool | null {
  switch (key.toLowerCase()) {
    case "p":
      return "pencil";
    case "m":
      return "marker";
    case "e":
      return "eraser";
    case "f":
      return "fill";
    case "r":
      return "rectangle";
    case "c":
      return "circle";
    case "a":
      return "arrow";
    default:
      return null;
  }
}
