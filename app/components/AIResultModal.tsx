"use client";

import { Download, RefreshCcw, Replace, Sparkles, X } from "lucide-react";
import Image from "next/image";

type AIResultModalProps = {
  generatedImageUrl: string;
  originalImageUrl: string;
  onClose: () => void;
  onDownload: () => void;
  onGenerateAgain: () => void;
  onReplaceWhiteboard: () => void;
};

export function AIResultModal({
  generatedImageUrl,
  originalImageUrl,
  onClose,
  onDownload,
  onGenerateAgain,
  onReplaceWhiteboard,
}: AIResultModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-violet-950/55 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-result-title"
        className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_32px_110px_rgba(88,28,135,0.35)] animate-[modal-reveal_220ms_ease-out]"
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-fuchsia-50 via-white to-sky-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-sky-500 text-white shadow-lg shadow-fuchsia-500/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
            <h2 id="ai-result-title" className="text-lg font-bold text-slate-950">
              Reveal your creation
            </h2>
            <p className="text-sm text-slate-500">Compare your original drawing with the AI transformation.</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close AI result"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid max-h-[calc(92vh-148px)] gap-4 overflow-y-auto bg-gradient-to-br from-slate-50 via-fuchsia-50/40 to-sky-50/50 p-4 lg:grid-cols-2">
          <PreviewCard title="Original" imageUrl={originalImageUrl} />
          <PreviewCard title="AI Result" imageUrl={generatedImageUrl} />
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
          >
            <Download className="h-4 w-4" />
            Download AI Image
          </button>
          <button
            type="button"
            onClick={onReplaceWhiteboard}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
          >
            <Replace className="h-4 w-4" />
            Replace Whiteboard
          </button>
          <button
            type="button"
            onClick={onGenerateAgain}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-sky-500 px-4 text-sm font-bold text-white transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
          >
            <RefreshCcw className="h-4 w-4" />
            Generate Again
          </button>
        </footer>
      </section>
    </div>
  );
}

function PreviewCard({
  imageUrl,
  title,
}: {
  imageUrl: string;
  title: string;
}) {
  return (
    <article className="rounded-[24px] border border-white bg-white/90 p-3 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
      <h3 className="mb-3 text-sm font-bold text-slate-700">{title}</h3>
      <div className="flex aspect-[16/11] items-center justify-center overflow-hidden rounded-[18px] bg-slate-100">
        <Image
          src={imageUrl}
          alt={`${title} whiteboard`}
          width={1600}
          height={1100}
          unoptimized
          className="h-full w-full object-contain"
        />
      </div>
    </article>
  );
}
