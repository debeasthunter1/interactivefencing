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
  Undo2,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
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

type ToolIcon = ComponentType<SVGProps<SVGSVGElement>>;

const tools: Array<{
  icon: ToolIcon;
  label: string;
  shortcut?: string;
  tool: WhiteboardTool;
}> = [
  { icon: MousePointer2, label: "Select", tool: "select" },
  { icon: Hand, label: "Pan", tool: "pan" },
  { icon: Pencil, label: "Pencil", shortcut: "P", tool: "pencil" },
  { icon: Brush, label: "Marker", shortcut: "M", tool: "marker" },
  { icon: CrayonIcon, label: "Crayon", tool: "crayon" },
  { icon: Paintbrush, label: "Paint brush", tool: "paint-brush" },
  { icon: ChalkIcon, label: "Chalk", tool: "chalk" },
  { icon: Highlighter, label: "Highlighter", tool: "highlighter" },
  { icon: PaintBucket, label: "Fill shape", shortcut: "F", tool: "fill" },
  { icon: Eraser, label: "Eraser", shortcut: "E", tool: "eraser" },
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
      className="pointer-events-auto fixed left-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-1 rounded-[24px] border border-white/70 bg-white/82 p-1.5 shadow-[0_20px_70px_rgba(124,58,237,0.18)] backdrop-blur-xl transition duration-200 hover:bg-white/88 sm:left-4"
    >
      <div className="grid shrink-0 gap-1 rounded-[18px] bg-white/58 p-1">
        {tools.slice(0, 2).map(({ icon: Icon, label, shortcut, tool }) => (
          <ToolButton
            key={tool}
            active={activeTool === tool}
            label={label}
            shortcut={shortcut}
            size="compact"
            onClick={() => onToolChange(tool)}
          >
            <Icon className="h-5 w-5" />
          </ToolButton>
        ))}
        <ShapeDropdown
          activeTool={activeTool}
          buttonSize="compact"
          onShapeSelect={(shape: ShapeKind) => onToolChange(shape)}
        />
      </div>

      <div className="grid shrink-0 gap-1 rounded-[18px] bg-white/58 p-1">
        {tools.slice(2, 8).map(({ icon: Icon, label, shortcut, tool }) => (
          <ToolButton
            key={tool}
            active={activeTool === tool}
            label={label}
            shortcut={shortcut}
            size="compact"
            onClick={() => onToolChange(tool)}
          >
            <Icon className="h-5 w-5" />
          </ToolButton>
        ))}
      </div>

      <div className="grid shrink-0 gap-1 rounded-[18px] bg-white/58 p-1">
        {tools.slice(8).map(({ icon: Icon, label, shortcut, tool }) => (
          <ToolButton
            key={tool}
            active={activeTool === tool}
            label={label}
            shortcut={shortcut}
            size="compact"
            onClick={() => onToolChange(tool)}
          >
            <Icon className="h-5 w-5" />
          </ToolButton>
        ))}
      </div>

      <div className="grid shrink-0 gap-1 rounded-[18px] bg-white/58 p-1">
        <ToolButton
          label="Undo"
          disabled={!canUndo}
          onClick={onUndo}
          size="compact"
        >
          <Undo2 className="h-5 w-5" />
        </ToolButton>
        <ToolButton
          label="Redo"
          disabled={!canRedo}
          onClick={onRedo}
          size="compact"
        >
          <Redo2 className="h-5 w-5" />
        </ToolButton>
      </div>
    </nav>
  );
}

function CrayonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M7 19 19 7l-2-2L5 17l-.5 2.5Z" />
      <path d="m14 8 2 2" />
      <path d="m11 11 2 2" />
      <path d="m5 17 2 2" />
      <path d="M17 5 19.5 3.5 20.5 4.5 19 7" />
    </svg>
  );
}

function ChalkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 15.5 14.5 6a2.1 2.1 0 0 1 3 0l.5.5a2.1 2.1 0 0 1 0 3L8.5 19a2.1 2.1 0 0 1-3 0l-.5-.5a2.1 2.1 0 0 1 0-3Z" />
      <path d="m13.5 7 3.5 3.5" />
      <path d="M16.5 15.5h.01" />
      <path d="M19.5 13h.01" />
      <path d="M14 18.5h.01" />
    </svg>
  );
}
