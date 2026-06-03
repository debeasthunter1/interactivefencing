"use client";

import { Frame, Palette, SlidersHorizontal } from "lucide-react";
import type { GridMode, ShapeElementData } from "@/app/types/whiteboard";

type BottomCreativeControlsProps = {
  borderColor: string;
  borderWidth: number;
  fillColor: string;
  gridMode: GridMode;
  selectedShapeElement: ShapeElementData | null;
  strokeColor: string;
  strokeOpacity: number;
  strokeWidth: number;
  textureIntensity: number;
  onBorderColorChange: (color: string) => void;
  onBorderWidthChange: (width: number) => void;
  onFillColorChange: (color: string) => void;
  onGridModeChange: (mode: GridMode) => void;
  onShapeStyleChange: (updates: Partial<ShapeElementData>) => void;
  onStrokeColorChange: (color: string) => void;
  onStrokeOpacityChange: (opacity: number) => void;
  onStrokeWidthChange: (width: number) => void;
  onTextureIntensityChange: (intensity: number) => void;
};

const gridModes: Array<{ label: string; mode: GridMode }> = [
  { label: "Clean", mode: "none" },
  { label: "Grid", mode: "grid" },
  { label: "Dots", mode: "dots" },
];

export function BottomCreativeControls({
  borderColor,
  borderWidth,
  fillColor,
  gridMode,
  selectedShapeElement,
  strokeColor,
  strokeOpacity,
  strokeWidth,
  textureIntensity,
  onBorderColorChange,
  onBorderWidthChange,
  onFillColorChange,
  onGridModeChange,
  onShapeStyleChange,
  onStrokeColorChange,
  onStrokeOpacityChange,
  onStrokeWidthChange,
  onTextureIntensityChange,
}: BottomCreativeControlsProps) {
  return (
    <section
      aria-label="Creative controls"
      className="fixed bottom-3 left-3 right-3 z-30 mx-auto max-w-5xl rounded-[28px] border border-white/70 bg-white/78 p-2 shadow-[0_20px_70px_rgba(124,58,237,0.18)] backdrop-blur-xl transition duration-200 hover:bg-white/84 md:left-28 md:right-6 md:p-3"
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-2 rounded-[22px] bg-white/62 px-3 py-2">
          <Palette className="h-4 w-4 text-fuchsia-500" />
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
            Stroke
            <input
              aria-label="Stroke color"
              type="color"
              value={strokeColor}
              onChange={(event) => onStrokeColorChange(event.target.value)}
              className="h-9 w-10 cursor-pointer rounded-xl border border-white bg-transparent shadow-inner"
            />
          </label>
          <RangeControl
            label={`Size ${strokeWidth}px`}
            min={2}
            max={36}
            value={strokeWidth}
            onChange={onStrokeWidthChange}
          />
          <RangeControl
            label={`Opacity ${Math.round(strokeOpacity * 100)}%`}
            min={15}
            max={100}
            value={Math.round(strokeOpacity * 100)}
            onChange={(value) => onStrokeOpacityChange(value / 100)}
          />
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-center gap-2 rounded-[22px] bg-white/62 px-3 py-2">
          <Frame className="h-4 w-4 text-violet-500" />
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
            Fill
            <input
              aria-label="Shape fill color"
              type="color"
              value={selectedShapeElement?.fillColor ?? fillColor}
              onChange={(event) => {
                onFillColorChange(event.target.value);
                if (selectedShapeElement) {
                  onShapeStyleChange({ fillColor: event.target.value });
                }
              }}
              className="h-9 w-10 cursor-pointer rounded-xl border border-white bg-transparent shadow-inner"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
            Border
            <input
              aria-label="Shape border color"
              type="color"
              value={selectedShapeElement?.borderColor ?? borderColor}
              onChange={(event) => {
                onBorderColorChange(event.target.value);
                if (selectedShapeElement) {
                  onShapeStyleChange({ borderColor: event.target.value });
                }
              }}
              className="h-9 w-10 cursor-pointer rounded-xl border border-white bg-transparent shadow-inner"
            />
          </label>
          <RangeControl
            label={`${selectedShapeElement?.borderWidth ?? borderWidth}px`}
            min={1}
            max={24}
            value={selectedShapeElement?.borderWidth ?? borderWidth}
            onChange={(value) => {
              onBorderWidthChange(value);
              if (selectedShapeElement) {
                onShapeStyleChange({ borderWidth: value });
              }
            }}
          />
        </div>

        <details className="group relative">
          <summary className="flex h-12 cursor-pointer list-none items-center gap-2 rounded-[22px] bg-white/62 px-4 text-xs font-black text-slate-600 transition hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-fuchsia-300 [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="h-4 w-4 text-sky-500" />
            More
          </summary>
          <div className="absolute bottom-14 right-0 z-[85] w-[min(280px,calc(100vw-2rem))] rounded-[24px] border border-white/80 bg-white/92 p-3 shadow-[0_22px_70px_rgba(124,58,237,0.2)] backdrop-blur-xl">
            <div className="grid gap-3">
              <RangeControl
                label={`Texture ${Math.round(textureIntensity * 100)}%`}
                min={0}
                max={100}
                value={Math.round(textureIntensity * 100)}
                onChange={(value) => onTextureIntensityChange(value / 100)}
              />
              <SegmentedButtons
                label="Canvas guide"
                value={gridMode}
                options={gridModes}
                onChange={onGridModeChange}
              />
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}

function RangeControl({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="flex min-w-[96px] flex-1 items-center gap-2 text-xs font-bold text-slate-500 sm:flex-none">
      <span className="whitespace-nowrap">{label}</span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 min-w-0 flex-1 cursor-pointer accent-fuchsia-500 sm:w-20 md:w-24"
      />
    </label>
  );
}

function SegmentedButtons<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: Array<{ label: string; mode: T }>;
  value: T;
}) {
  return (
    <div aria-label={label} className="flex flex-wrap rounded-2xl bg-white/72 p-1">
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          aria-pressed={value === option.mode}
          onClick={() => onChange(option.mode)}
          className={[
            "h-8 rounded-xl px-3 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-fuchsia-300",
            value === option.mode
              ? "bg-slate-950 text-white shadow-md"
              : "text-slate-500 hover:bg-white hover:text-slate-950",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
