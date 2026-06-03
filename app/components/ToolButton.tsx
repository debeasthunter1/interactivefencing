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
  shortcut?: string;
};

export function ToolButton({
  active = false,
  children,
  disabled = false,
  label,
  onClick,
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
        "group relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition duration-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-300",
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
