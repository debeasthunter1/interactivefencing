"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ToolButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick"
> & {
  active?: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
  size?: "compact" | "regular";
  shortcut?: string;
};

export function ToolButton({
  active = false,
  children,
  disabled = false,
  label,
  onClick,
  size = "regular",
  shortcut,
  ...buttonProps
}: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={onClick}
      {...buttonProps}
      className={[
        "group relative inline-flex shrink-0 items-center justify-center border transition duration-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-300",
        size === "compact"
          ? "h-9 w-9 rounded-[15px] sm:h-10 sm:w-10 sm:rounded-[16px]"
          : "h-12 w-12 rounded-2xl",
        active
          ? "border-fuchsia-300 bg-gradient-to-br from-fuchsia-50 to-sky-50 text-fuchsia-700 shadow-lg shadow-fuchsia-500/15"
          : "border-transparent text-slate-600 hover:-translate-y-0.5 hover:bg-white hover:text-slate-950 hover:shadow-md",
        disabled ? "cursor-not-allowed opacity-40 hover:translate-y-0 hover:shadow-none" : "",
        buttonProps.className ?? "",
      ].join(" ")}
    >
      <span className="transition duration-200 group-hover:scale-110">
        {children}
      </span>
      {shortcut ? (
        <span className="absolute bottom-1 right-1 text-[9px] font-black text-slate-400">
          {shortcut}
        </span>
      ) : null}
    </button>
  );
}
