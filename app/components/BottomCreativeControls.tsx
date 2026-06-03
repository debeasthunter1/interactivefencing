"use client";

import { Frame, Palette, SlidersHorizontal } from "lucide-react";
import type { GridMode, ShapeElementData } from "@/app/types/whiteboard";

type BottomCreativeControlsProps = {
  fillColor: string;
  gridMode: GridMode;
  selectedShapeElement: ShapeElementData | null;
  strokeColor: string;
  strokeOpacity: number;
  strokeWidth: number;
  onFillColorChange: (color: string) => void;
  onGridModeChange: (mode: GridMode) => void;
  onShapeStyleChange: (updates: Partial<ShapeElementData>) => void;
  onStrokeColorChange: (color: string) => void;
  onStrokeOpacityChange: (opacity: number) => void;
  onStrokeWidthChange: (width: number) => void;
};

const gridModes: Array<{ label: string; mode: GridMode }> = [
  { label: "Clean", mode: "none" },
  { label: "Grid", mode: "grid" },
  { label: "Dots", mode: "dots" },
];

export function BottomCreativeControls({
  ...props
}: BottomCreativeControlsProps) {
  return (
    <section
      aria-label="Creative controls"
      className="pointer-events-auto fixed right-2 top-[4.5rem] z-30 sm:right-3 md:right-3 md:top-1/2 md:w-[198px] md:-translate-y-1/2 lg:w-[212px]"
    >
      <details className="group relative md:hidden">
        <summary className="ml-auto flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-[16px] border border-white/70 bg-white/82 text-slate-700 shadow-[0_16px_44px_rgba(124,58,237,0.16)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-300 [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="h-5 w-5 text-sky-500" />
        </summary>
        <div className="absolute right-0 top-[3.25rem] w-[min(232px,calc(100vw-5rem))] rounded-[22px] border border-white/70 bg-white/86 p-1.5 shadow-[0_18px_56px_rgba(124,58,237,0.18)] backdrop-blur-xl">
          <ControlStack {...props} />
        </div>
      </details>

      <div className="hidden flex-col rounded-[22px] border border-white/70 bg-white/82 p-1.5 shadow-[0_18px_56px_rgba(124,58,237,0.16)] backdrop-blur-xl transition duration-200 hover:bg-white/88 md:flex">
        <ControlStack {...props} />
      </div>
    </section>
  );
}

function ControlStack({
  fillColor,
  gridMode,
  selectedShapeElement,
  strokeColor,
  strokeOpacity,
  strokeWidth,
  onFillColorChange,
  onGridModeChange,
  onShapeStyleChange,
  onStrokeColorChange,
  onStrokeOpacityChange,
  onStrokeWidthChange,
}: BottomCreativeControlsProps) {
  return (
    <div className="grid gap-1.5">
      <div className="rounded-[18px] bg-white/58 p-1">
        <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-black leading-none text-slate-600">
          <Palette className="h-3.5 w-3.5 text-fuchsia-500" />
          Stroke
        </div>
        <div className="grid gap-1.5">
          <ColorControl
            label="Color"
            value={strokeColor}
            onChange={onStrokeColorChange}
            ariaLabel="Stroke color"
          />
          <RangeControl
            label="Size"
            valueLabel={`${strokeWidth}px`}
            min={2}
            max={36}
            value={strokeWidth}
            onChange={onStrokeWidthChange}
          />
          <RangeControl
            label="Opacity"
            valueLabel={`${Math.round(strokeOpacity * 100)}%`}
            min={15}
            max={100}
            value={Math.round(strokeOpacity * 100)}
            onChange={(value) => onStrokeOpacityChange(value / 100)}
          />
        </div>
      </div>

      <div className="rounded-[18px] bg-white/58 p-1">
        <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-black leading-none text-slate-600">
          <Frame className="h-3.5 w-3.5 text-violet-500" />
          Shape
        </div>
        <div className="grid gap-1.5">
          <ColorControl
            label="Fill"
            value={selectedShapeElement?.fillColor ?? fillColor}
            ariaLabel="Shape fill color"
            onChange={(color) => {
              onFillColorChange(color);
              if (selectedShapeElement) {
                onShapeStyleChange({ fillColor: color });
              }
            }}
          />
        </div>
      </div>

      <div className="rounded-[18px] bg-white/58 p-1">
        <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-black leading-none text-slate-600">
          <SlidersHorizontal className="h-3.5 w-3.5 text-sky-500" />
          Board
        </div>
        <div className="grid gap-1.5">
          <SegmentedButtons
            label="Canvas guide"
            value={gridMode}
            options={gridModes}
            onChange={onGridModeChange}
          />
        </div>
      </div>
    </div>
  );
}

function RangeControl({
  label,
  max,
  min,
  onChange,
  value,
  valueLabel,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
  valueLabel: string;
}) {
  return (
    <label className="grid gap-1 rounded-[14px] bg-white/60 px-2 py-1.5 text-[11px] font-bold text-slate-500">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="text-slate-900">{valueLabel}</span>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-fuchsia-500"
      />
    </label>
  );
}

function ColorControl({
  ariaLabel,
  label,
  onChange,
  value,
}: {
  ariaLabel: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="flex min-h-9 items-center justify-between gap-2 rounded-[14px] bg-white/60 px-2 py-1.5 text-[11px] font-bold text-slate-500">
      <span>{label}</span>
      <input
        aria-label={ariaLabel}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-9 cursor-pointer rounded-xl border border-white bg-transparent shadow-inner"
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
    <div
      aria-label={label}
      className="grid grid-cols-3 gap-1 rounded-[14px] bg-white/60 p-1"
    >
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          aria-pressed={value === option.mode}
          onClick={() => onChange(option.mode)}
          className={[
            "h-8 rounded-[10px] px-1.5 text-[11px] font-bold transition focus:outline-none focus:ring-2 focus:ring-fuchsia-300",
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
