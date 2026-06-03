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
  ...props
}: BottomCreativeControlsProps) {
  return (
    <section
      aria-label="Creative controls"
      className="pointer-events-auto fixed right-3 top-[4.75rem] z-30 md:right-4 md:top-1/2 md:w-[248px] md:-translate-y-1/2"
    >
      <details className="group relative md:hidden">
        <summary className="ml-auto flex h-12 w-12 cursor-pointer list-none items-center justify-center rounded-[18px] border border-white/70 bg-white/82 text-slate-700 shadow-[0_18px_54px_rgba(124,58,237,0.18)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-300 [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="h-5 w-5 text-sky-500" />
        </summary>
        <div className="absolute right-0 top-14 w-[min(260px,calc(100vw-5.5rem))] rounded-[26px] border border-white/70 bg-white/86 p-2 shadow-[0_22px_70px_rgba(124,58,237,0.2)] backdrop-blur-xl">
          <ControlStack {...props} />
        </div>
      </details>

      <div className="hidden flex-col rounded-[28px] border border-white/70 bg-white/82 p-2 shadow-[0_20px_70px_rgba(124,58,237,0.18)] backdrop-blur-xl transition duration-200 hover:bg-white/88 md:flex">
        <ControlStack {...props} />
      </div>
    </section>
  );
}

function ControlStack({
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
    <div className="grid gap-2">
      <div className="rounded-[22px] bg-white/58 p-1.5">
        <div className="mb-1.5 flex items-center gap-2 px-1 text-xs font-black text-slate-600">
          <Palette className="h-4 w-4 text-fuchsia-500" />
          Stroke
        </div>
        <div className="grid gap-2">
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

      <div className="rounded-[22px] bg-white/58 p-1.5">
        <div className="mb-1.5 flex items-center gap-2 px-1 text-xs font-black text-slate-600">
          <Frame className="h-4 w-4 text-violet-500" />
          Shape
        </div>
        <div className="grid gap-2">
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
          <ColorControl
            label="Border"
            value={selectedShapeElement?.borderColor ?? borderColor}
            ariaLabel="Shape border color"
            onChange={(color) => {
              onBorderColorChange(color);
              if (selectedShapeElement) {
                onShapeStyleChange({ borderColor: color });
              }
            }}
          />
          <RangeControl
            label="Border width"
            valueLabel={`${selectedShapeElement?.borderWidth ?? borderWidth}px`}
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
      </div>

      <div className="rounded-[22px] bg-white/58 p-1.5">
        <div className="mb-1.5 flex items-center gap-2 px-1 text-xs font-black text-slate-600">
          <SlidersHorizontal className="h-4 w-4 text-sky-500" />
          Board
        </div>
        <div className="grid gap-2">
          <RangeControl
            label="Texture"
            valueLabel={`${Math.round(textureIntensity * 100)}%`}
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
    <label className="grid gap-1 rounded-[18px] bg-white/60 px-2.5 py-1.5 text-xs font-bold text-slate-500">
      <span className="flex items-center justify-between gap-3">
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
    <label className="flex items-center justify-between gap-3 rounded-[18px] bg-white/60 px-2.5 py-1.5 text-xs font-bold text-slate-500">
      <span>{label}</span>
      <input
        aria-label={ariaLabel}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-9 cursor-pointer rounded-xl border border-white bg-transparent shadow-inner"
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
      className="grid grid-cols-3 gap-1 rounded-[18px] bg-white/60 p-1"
    >
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          aria-pressed={value === option.mode}
          onClick={() => onChange(option.mode)}
          className={[
            "h-7 rounded-xl px-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-fuchsia-300",
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
