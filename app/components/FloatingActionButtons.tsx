"use client";

import {
  Download,
  Sparkles,
  Trash2,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { ViewportState } from "@/app/types/whiteboard";
import { ToolButton } from "./ToolButton";

type FloatingActionButtonsProps = {
  isGenerating: boolean;
  viewport: ViewportState;
  onClear: () => void;
  onExport: () => void;
  onGenerate: () => void;
  onViewportChange: (viewport: ViewportState) => void;
};

export function FloatingActionButtons({
  isGenerating,
  viewport,
  onClear,
  onExport,
  onGenerate,
  onViewportChange,
}: FloatingActionButtonsProps) {
  return (
    <>
      <div className="pointer-events-auto fixed left-[5.25rem] top-4 z-30 hidden rounded-[22px] border border-white/70 bg-white/70 px-4 py-3 shadow-[0_18px_50px_rgba(124,58,237,0.12)] backdrop-blur-xl md:block">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400 via-amber-300 to-sky-400 text-white shadow-lg shadow-fuchsia-500/20">
            <WandSparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-950">Imagination Board</p>
            <p className="text-xs text-slate-500">Draw, play, transform</p>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto fixed right-4 top-4 z-30 flex max-w-[calc(100vw-2rem)] items-start gap-3">
        <div className="hidden rounded-[24px] border border-white/70 bg-white/72 p-2 shadow-[0_18px_54px_rgba(124,58,237,0.12)] backdrop-blur-xl sm:flex">
          <ToolButton label="Export canvas" onClick={onExport}>
            <Download className="h-6 w-6" />
          </ToolButton>
          <ToolButton label="Clear canvas" onClick={onClear}>
            <Trash2 className="h-6 w-6" />
          </ToolButton>
          <ToolButton
            label="Zoom out"
            onClick={() =>
              onViewportChange({
                ...viewport,
                zoom: Math.max(0.35, viewport.zoom - 0.1),
              })
            }
          >
            <ZoomOut className="h-6 w-6" />
          </ToolButton>
          <ToolButton
            label="Zoom in"
            onClick={() =>
              onViewportChange({
                ...viewport,
                zoom: Math.min(2.2, viewport.zoom + 0.1),
              })
            }
          >
            <ZoomIn className="h-6 w-6" />
          </ToolButton>
        </div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="group inline-flex h-12 items-center gap-2 rounded-[18px] bg-gradient-to-r from-fuchsia-500 via-violet-500 to-sky-500 px-5 text-sm font-bold text-white shadow-[0_18px_45px_rgba(124,58,237,0.28)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_54px_rgba(124,58,237,0.34)] focus:outline-none focus:ring-2 focus:ring-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-5 w-5 transition group-hover:rotate-12" />
          Create AI Version
        </button>
      </div>
    </>
  );
}
