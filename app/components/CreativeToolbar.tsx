"use client";

import {
  Brush,
  Eraser,
  Hand,
  Highlighter,
  MousePointer2,
  Paintbrush,
  PaintBucket,
  Pencil,
  Redo2,
  Sparkles,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ShapeKind, WhiteboardTool } from "@/app/types/whiteboard";
import { ShapeDropdown } from "./ShapeDropdown";
import { ToolButton } from "./ToolButton";

type CreativeToolbarProps = {
  activeTool: WhiteboardTool;
  canRedo: boolean;
  canUndo: boolean;
  onRedo: () => void;
  onToolChange: (tool: WhiteboardTool) => void;
  onUndo: () => void;
};

const tools: Array<{
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  tool: WhiteboardTool;
}> = [
  { icon: MousePointer2, label: "Select", tool: "select" },
  { icon: Hand, label: "Pan", tool: "pan" },
  { icon: Pencil, label: "Pencil", shortcut: "P", tool: "pencil" },
  { icon: Brush, label: "Marker", shortcut: "M", tool: "marker" },
  { icon: Sparkles, label: "Crayon", tool: "crayon" },
  { icon: Paintbrush, label: "Paint brush", tool: "paint-brush" },
  { icon: Sparkles, label: "Chalk", tool: "chalk" },
  { icon: Highlighter, label: "Highlighter", tool: "highlighter" },
  { icon: Eraser, label: "Eraser", shortcut: "E", tool: "eraser" },
  { icon: PaintBucket, label: "Fill shape", shortcut: "F", tool: "fill" },
];

export function CreativeToolbar({
  activeTool,
  canRedo,
  canUndo,
  onRedo,
  onToolChange,
  onUndo,
}: CreativeToolbarProps) {
  return (
    <nav
      aria-label="Creative tools"
      className="fixed bottom-[124px] left-3 right-3 z-30 flex items-center gap-1 overflow-x-auto rounded-[26px] border border-white/70 bg-white/82 p-2 shadow-[0_20px_70px_rgba(124,58,237,0.18)] backdrop-blur-xl sm:bottom-[112px] md:bottom-auto md:left-4 md:right-auto md:top-1/2 md:max-h-[calc(100vh-148px)] md:w-[88px] md:-translate-y-1/2 md:flex-col md:overflow-y-auto md:overflow-x-visible"
    >
      <div className="flex shrink-0 items-center gap-1 rounded-[20px] bg-white/58 p-1 md:flex-col">
        {tools.slice(0, 2).map(({ icon: Icon, label, shortcut, tool }) => (
          <ToolButton
            key={tool}
            active={activeTool === tool}
            label={label}
            shortcut={shortcut}
            onClick={() => onToolChange(tool)}
          >
            <Icon className="h-6 w-6" />
          </ToolButton>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-[20px] bg-white/58 p-1 md:flex-col">
        {tools.slice(2, 9).map(({ icon: Icon, label, shortcut, tool }) => (
          <ToolButton
            key={tool}
            active={activeTool === tool}
            label={label}
            shortcut={shortcut}
            onClick={() => onToolChange(tool)}
          >
            <Icon className="h-6 w-6" />
          </ToolButton>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-[20px] bg-white/58 p-1 md:flex-col">
        <ShapeDropdown
          activeTool={activeTool}
          onShapeSelect={(shape: ShapeKind) => onToolChange(shape)}
        />
        {tools.slice(9).map(({ icon: Icon, label, shortcut, tool }) => (
          <ToolButton
            key={tool}
            active={activeTool === tool}
            label={label}
            shortcut={shortcut}
            onClick={() => onToolChange(tool)}
          >
            <Icon className="h-6 w-6" />
          </ToolButton>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-[20px] bg-white/58 p-1 md:flex-col">
        <ToolButton label="Undo" disabled={!canUndo} onClick={onUndo}>
          <Undo2 className="h-6 w-6" />
        </ToolButton>
        <ToolButton label="Redo" disabled={!canRedo} onClick={onRedo}>
          <Redo2 className="h-6 w-6" />
        </ToolButton>
      </div>
    </nav>
  );
}
