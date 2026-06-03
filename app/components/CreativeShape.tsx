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
  mode: "move" | "resize" | "rotate";
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
    event: PointerEvent<HTMLButtonElement | HTMLDivElement>,
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
    event: PointerEvent<HTMLButtonElement | HTMLDivElement>,
  ) => {
    const state = interactionRef.current;
    if (!state) {
      return;
    }

    event.preventDefault();
    const dx = (event.clientX - state.clientX) / zoom;
    const dy = (event.clientY - state.clientY) / zoom;
    let next = state.element;

    if (state.mode === "move") {
      next = {
        ...state.element,
        x: state.element.x + dx,
        y: state.element.y + dy,
      };
    }

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
    event: PointerEvent<HTMLButtonElement | HTMLDivElement>,
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

  return (
    <div
      className={[
        "absolute transition-[filter,transform] duration-150",
        canInteract ? "pointer-events-auto" : "pointer-events-none",
        isSelected ? "drop-shadow-[0_10px_20px_rgba(56,189,248,0.2)]" : "",
      ].join(" ")}
      style={{
        height: element.height,
        left: element.x,
        top: element.y,
        transform: `rotate(${element.rotation}deg)`,
        width: element.width,
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(element.id);
      }}
      onPointerDown={(event) => beginInteraction(event, "move")}
      onPointerMove={updateInteraction}
      onPointerUp={endInteraction}
    >
      <svg
        className="h-full w-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${element.kind} shape`}
      >
        <ShapeSvg element={element} />
      </svg>

      {isSelected ? (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-sky-400 ring-offset-2 ring-offset-white/70" />
          <button
            type="button"
            aria-label="Resize shape"
            className="absolute -bottom-3 -right-3 h-6 w-6 rounded-full border border-white bg-sky-500 shadow-lg transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sky-300"
            onPointerDown={(event) => beginInteraction(event, "resize")}
            onPointerMove={updateInteraction}
            onPointerUp={endInteraction}
          />
          <button
            type="button"
            aria-label="Rotate shape"
            className="absolute -top-11 left-1/2 inline-flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-white bg-white text-sky-700 shadow-lg transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sky-300"
            onPointerDown={(event) => beginInteraction(event, "rotate")}
            onPointerMove={updateInteraction}
            onPointerUp={endInteraction}
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </>
      ) : null}
    </div>
  );
}

function ShapeSvg({ element }: { element: ShapeElementData }) {
  const common = {
    fill: element.fillColor,
    stroke: element.borderColor,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: element.borderWidth,
    vectorEffect: "non-scaling-stroke" as const,
  };

  if (element.kind === "rectangle") {
    return <rect x="8" y="10" width="84" height="80" rx="2" {...common} />;
  }

  if (element.kind === "rounded-rectangle") {
    return <rect x="8" y="10" width="84" height="80" rx="16" {...common} />;
  }

  if (element.kind === "circle") {
    return <ellipse cx="50" cy="50" rx="42" ry="40" {...common} />;
  }

  if (element.kind === "triangle") {
    return <path d="M50 8 94 90 6 90Z" {...common} />;
  }

  if (element.kind === "arrow") {
    return (
      <path
        d="M8 38h50V12l34 40-34 36V62H8Z"
        {...common}
      />
    );
  }

  if (element.kind === "star") {
    return <path d="M50 6 62 36 94 38 69 58 77 90 50 72 23 90 31 58 6 38 38 36Z" {...common} />;
  }

  if (element.kind === "heart") {
    return <path d="M50 88C26 66 12 52 12 33c0-13 10-23 23-23 7 0 13 3 15 9 2-6 8-9 15-9 13 0 23 10 23 23 0 19-14 33-38 55Z" {...common} />;
  }

  if (element.kind === "cloud") {
    return <path d="M28 76c-13 0-23-9-23-21 0-11 8-20 19-21C29 20 42 11 57 15c13 3 23 14 25 27 8 3 13 10 13 18 0 10-8 16-19 16Z" {...common} />;
  }

  return <path d="M10 17h80v52H58L43 88V69H10Z" {...common} />;
}
