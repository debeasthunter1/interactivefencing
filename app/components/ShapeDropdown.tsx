"use client";

import {
  ArrowRight,
  ChevronRight,
  Circle,
  Cloud,
  Heart,
  MessageCircle,
  Square,
  Star,
  Triangle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ShapeKind, WhiteboardTool } from "@/app/types/whiteboard";
import { ToolButton } from "./ToolButton";

type ShapeDropdownProps = {
  activeTool: WhiteboardTool;
  onShapeSelect: (shape: ShapeKind) => void;
};

const shapes: Array<{
  icon: LucideIcon;
  label: string;
  shape: ShapeKind;
  shortcut?: string;
}> = [
  { icon: Square, label: "Rectangle", shape: "rectangle", shortcut: "R" },
  { icon: Square, label: "Rounded rectangle", shape: "rounded-rectangle" },
  { icon: Circle, label: "Circle", shape: "circle", shortcut: "C" },
  { icon: Triangle, label: "Triangle", shape: "triangle" },
  { icon: ArrowRight, label: "Arrow", shape: "arrow", shortcut: "A" },
  { icon: Star, label: "Star", shape: "star" },
  { icon: Heart, label: "Heart", shape: "heart" },
  { icon: Cloud, label: "Cloud", shape: "cloud" },
  { icon: MessageCircle, label: "Speech bubble", shape: "speech-bubble" },
];

const shapeTools = new Set<WhiteboardTool>(shapes.map(({ shape }) => shape));
const MENU_HEIGHT = 218;
const MENU_WIDTH = 236;
const MENU_MARGIN = 12;

type MenuPosition = {
  left: number;
  top: number;
  width: number;
};

export function ShapeDropdown({
  activeTool,
  onShapeSelect,
}: ShapeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [lastShape, setLastShape] = useState<ShapeKind>("rectangle");
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({
    left: MENU_MARGIN,
    top: MENU_MARGIN,
    width: MENU_WIDTH,
  });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const activeShape = shapeTools.has(activeTool) ? (activeTool as ShapeKind) : null;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleReposition = () => {
      setMenuPosition(calculateMenuPosition(wrapperRef.current));
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen]);

  const selectedShape = activeShape ?? lastShape;
  const selectedOption = useMemo(
    () => shapes.find(({ shape }) => shape === selectedShape) ?? shapes[0],
    [selectedShape],
  );
  const SelectedIcon = selectedOption.icon;

  const selectShape = (shape: ShapeKind) => {
    setLastShape(shape);
    setIsOpen(false);
    onShapeSelect(shape);
  };

  const toggleMenu = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setMenuPosition(calculateMenuPosition(wrapperRef.current));
    setIsOpen(true);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <ToolButton
        aria-expanded={isOpen}
        aria-haspopup="menu"
        active={Boolean(activeShape)}
        label={`Shapes: ${selectedOption.label}`}
        onClick={toggleMenu}
      >
        <span className="relative inline-flex">
          <SelectedIcon className="h-6 w-6" />
          <ChevronRight className="absolute -right-2 -top-1 h-3.5 w-3.5 rotate-90 text-fuchsia-500" />
        </span>
      </ToolButton>

      {isOpen ? (
        <div
          role="menu"
          aria-label="Choose shape"
          className="fixed z-[80] grid grid-cols-3 gap-1 rounded-[22px] border border-white/80 bg-white/92 p-2 shadow-[0_22px_70px_rgba(124,58,237,0.22)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150"
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            width: menuPosition.width,
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false);
            }
          }}
        >
          {shapes.map(({ icon: Icon, label, shape }) => {
            const active = selectedShape === shape;
            return (
              <button
                key={shape}
                type="button"
                role="menuitem"
                aria-label={label}
                title={label}
                onClick={() => selectShape(shape)}
                className={[
                  "inline-flex h-14 flex-col items-center justify-center gap-1 rounded-2xl border text-[10px] font-bold transition focus:outline-none focus:ring-2 focus:ring-fuchsia-300",
                  active
                    ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700"
                    : "border-transparent text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-sm",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate px-1">{shortLabel(label)}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function shortLabel(label: string) {
  if (label === "Rounded rectangle") {
    return "Round";
  }
  if (label === "Speech bubble") {
    return "Bubble";
  }
  return label;
}

function calculateMenuPosition(anchor: HTMLDivElement | null): MenuPosition {
  const width = Math.min(MENU_WIDTH, Math.max(196, window.innerWidth - MENU_MARGIN * 2));
  if (!anchor) {
    return {
      left: MENU_MARGIN,
      top: MENU_MARGIN,
      width,
    };
  }

  const rect = anchor.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - width / 2;
  let top = rect.top - MENU_HEIGHT - MENU_MARGIN;

  left = clamp(left, MENU_MARGIN, window.innerWidth - width - MENU_MARGIN);
  top = clamp(top, MENU_MARGIN, window.innerHeight - MENU_HEIGHT - MENU_MARGIN);

  return {
    left,
    top,
    width,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
