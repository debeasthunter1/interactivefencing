"use client";

type LoadingOverlayProps = {
  message?: string;
};

export function LoadingOverlay({
  message = "Revealing your creation...",
}: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-violet-950/62 backdrop-blur-md">
      <div className="flex min-w-[300px] flex-col items-center gap-5 rounded-[28px] border border-white/25 bg-white/92 px-8 py-7 text-center shadow-[0_28px_90px_rgba(88,28,135,0.35)]">
        <div className="relative h-16 w-28 overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-100 via-amber-100 to-sky-100">
          <div className="absolute left-3 top-4 h-1 w-16 animate-[draw_1.2s_ease-in-out_infinite] rounded-full bg-sky-500" />
          <div
            className="absolute left-5 top-7 h-1 w-12 animate-[draw_1.2s_ease-in-out_infinite] rounded-full bg-amber-400"
            style={{ animationDelay: "160ms" }}
          />
          <div
            className="absolute left-7 top-10 h-1 w-14 animate-[draw_1.2s_ease-in-out_infinite] rounded-full bg-emerald-400"
            style={{ animationDelay: "320ms" }}
          />
        </div>
        <div>
          <p className="text-base font-bold text-slate-950">{message}</p>
          <p className="mt-1 text-sm text-slate-500">
            Transforming your drawing into an AI version.
          </p>
        </div>
      </div>
    </div>
  );
}
