"use client";

import { RotateCw } from "lucide-react";
import { useRef } from "react";
import type { PointerEvent } from "react";
import type { ShapeElementData, WhiteboardTool } from "@/app/types/whiteboard";

type CreativeShapeProps = {
  element: ShapeElementData;
  isSelected: boolean;
  tool: WhiteboardTool;
  zoom: number;
  onChange: (element: ShapeElementData, commit?: boolean) => void;
  onSelect: (id: string | null) => void;
};

type InteractionState = {
  centerClientX?: number;
  centerClientY?: number;
  clientX: number;
  clientY: number;
  element: ShapeElementData;
  mode: "resize" | "rotate";
  next: ShapeElementData;
};

export function CreativeShape({
  element,
  isSelected,
  tool,
  zoom,
  onChange,
  onSelect,
}: CreativeShapeProps) {
  const interactionRef = useRef<InteractionState | null>(null);
  const canInteract = tool === "select";

  const beginInteraction = (
    event: PointerEvent<HTMLButtonElement>,
    mode: InteractionState["mode"],
  ) => {
    if (!canInteract) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(element.id);
    const shapeRect =
      mode === "rotate"
        ? (event.currentTarget.parentElement ?? event.currentTarget).getBoundingClientRect()
        : null;

    interactionRef.current = {
      centerClientX: shapeRect ? shapeRect.left + shapeRect.width / 2 : undefined,
      centerClientY: shapeRect ? shapeRect.top + shapeRect.height / 2 : undefined,
      clientX: event.clientX,
      clientY: event.clientY,
      element,
      mode,
      next: element,
    };
  };

  const updateInteraction = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    const state = interactionRef.current;
    if (!state) {
      return;
    }

    event.preventDefault();
    const dx = (event.clientX - state.clientX) / zoom;
    const dy = (event.clientY - state.clientY) / zoom;
    let next = state.element;

    if (state.mode === "resize") {
      next = {
        ...state.element,
        height: Math.max(44, state.element.height + dy),
        width: Math.max(44, state.element.width + dx),
      };
    }

    if (state.mode === "rotate") {
      const centerX = state.centerClientX ?? state.clientX;
      const centerY = state.centerClientY ?? state.clientY;
      const startAngle = Math.atan2(state.clientY - centerY, state.clientX - centerX);
      const currentAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
      next = {
        ...state.element,
        rotation:
          state.element.rotation + ((currentAngle - startAngle) * 180) / Math.PI,
      };
    }

    state.next = next;
    onChange(next);
  };

  const endInteraction = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (!interactionRef.current) {
      return;
    }

    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onChange(interactionRef.current.next, true);
    interactionRef.current = null;
  };

  if (!isSelected) {
    return null;
  }

  return (
    <div
      className={[
        "pointer-events-none absolute drop-shadow-[0_10px_20px_rgba(56,189,248,0.2)] transition-[filter,transform] duration-150",
      ].join(" ")}
      style={{
        height: element.height,
        left: element.x,
        top: element.y,
        transform: `rotate(${element.rotation}deg)`,
        width: element.width,
      }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-sky-400 ring-offset-2 ring-offset-white/70" />
      <button
        type="button"
        aria-label="Resize shape"
        className={[
          "absolute -bottom-3 -right-3 h-6 w-6 rounded-full border border-white bg-sky-500 shadow-lg transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sky-300",
          canInteract ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
        onPointerDown={(event) => beginInteraction(event, "resize")}
        onPointerMove={updateInteraction}
        onPointerUp={endInteraction}
      />
      <button
        type="button"
        aria-label="Rotate shape"
        className={[
          "absolute -top-11 left-1/2 inline-flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-white bg-white text-sky-700 shadow-lg transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sky-300",
          canInteract ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
        onPointerDown={(event) => beginInteraction(event, "rotate")}
        onPointerMove={updateInteraction}
        onPointerUp={endInteraction}
      >
        <RotateCw className="h-4 w-4" />
      </button>
    </div>
  );
}
