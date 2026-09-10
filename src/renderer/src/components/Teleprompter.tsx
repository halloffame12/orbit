import React, { useEffect, useRef } from "react";
import { InterviewMode } from "@/lib/types";

export interface TeleprompterProps {
  answer: string;
  isStreaming: boolean;
  mode: InterviewMode;
  solveStatus: string;
  fontSize: number;
  padding: number;
}

interface Section {
  title: string;
  body: string[];
}

/**
 * Parse a streaming, markdown-ish "## Section" document into sections.
 * Code fences are stripped and their content kept for <pre> rendering —
 * tolerant of an unfinished fence while tokens stream in.
 */
function parseSections(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  let inFence = false;

  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r/g, "");
    if (/^##\s+/.test(line)) {
      current = { title: line.replace(/^##\s+/, "").trim(), body: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      if (line.trim()) {
        current = { title: "", body: [] };
        sections.push(current);
      } else {
        continue;
      }
    }
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    current.body.push(line);
  }
  return sections;
}

function parseBullets(text: string): string[] {
  const normalized = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const hasBullets = normalized.some((l) => l.startsWith("•"));
  if (hasBullets) return normalized.filter((l) => l.startsWith("•"));
  return normalized;
}

/**
 * Teleprompter — the core overlay. Two rendering modes:
 *  - behavioral: high-contrast bullets (<50 words), auto-scroll
 *  - coding:     structured Complexity / Intuition / Code / Edge Cases
 * Auto-scrolls as tokens stream in. Sized for the camera notch.
 */
export function Teleprompter({
  answer,
  isStreaming,
  mode,
  solveStatus,
  fontSize,
  padding,
}: TeleprompterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [answer]);

  const isCoding = mode === "coding" || solveStatus !== "idle";
  const sections = isCoding ? parseSections(answer) : [];
  const bullets = isCoding ? [] : parseBullets(answer);
  const showing = answer.trim().length > 0 || isStreaming;

  const statusText = isStreaming
    ? "Streaming…"
    : solveStatus === "capturing"
      ? "Capturing screen…"
      : isCoding
        ? "Coding solver — Ctrl+Shift+S to capture problem"
        : "";

  return (
    <div className="w-full h-full flex flex-col" style={{ padding, fontSize }}>
      {statusText && (
        <div className="flex items-center gap-2 mb-1.5 opacity-80">
          <div className="w-1.5 h-1.5 rounded-full bg-copilot-accent pulse-accent" />
          <span className="text-copilot-muted text-[11px] font-mono uppercase tracking-widest">
            {statusText}
          </span>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scroll space-y-2"
        style={{ fontSize: `${fontSize}px` }}
      >
        {!showing && (
          <div className="text-copilot-dim font-mono italic h-full flex items-center justify-center">
            {isCoding
              ? "Press Ctrl+Shift+S to capture the problem"
              : `Awaiting interviewer question… press ${formatHotkey("CommandOrControl+Shift+Space")} to trigger manually`}
          </div>
        )}

        {showing && isCoding && <CodingView sections={sections} streaming={isStreaming} />}

        {showing && !isCoding && (
          <div className="space-y-2">
            {bullets.map((bullet, i) => (
              <div key={`${i}-${bullet.slice(0, 24)}`} className="bullet-in text-copilot-text leading-snug">
                <span className="text-copilot-accent mr-1.5">•</span>
                <span>{highlightKeywords(bullet)}</span>
                {isStreaming && i === bullets.length - 1 && (
                  <span className="streaming-caret text-copilot-accent">▍</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CodingView({ sections, streaming }: { sections: Section[]; streaming: boolean }) {
  if (!sections.length) return null;

  // Which section is still growing? Apply a caret on the last section's body.
  const lastIndex = sections.length - 1;
  const lastSection = sections[lastIndex];

  return (
    <div className="space-y-3">
      {sections.map((section, si) => {
        const isLast = si === lastIndex;
        const bodyText = section.body.join("\n");
        const isCode = section.title.toLowerCase().includes("code");
        const codeBlock = isCode ? extractCode(bodyText) : null;

        return (
          <div key={si} className="bullet-in">
            {section.title && (
              <div className="text-copilot-accent text-[0.45em] font-mono uppercase tracking-[0.2em] mb-1">
                {section.title}
              </div>
            )}
            {codeBlock ? (
              <pre className="font-mono text-copilot-text text-[0.55em] leading-relaxed whitespace-pre-wrap bg-black/40 border border-white/5 rounded-lg p-2.5">
                {codeBlock}
                {streaming && isLast && <span className="streaming-caret text-copilot-accent">▍</span>}
              </pre>
            ) : (
              <div className="text-copilot-text text-[0.55em] leading-relaxed whitespace-pre-wrap">
                {bodyText}
                {streaming && isLast && <span className="streaming-caret text-copilot-accent">▍</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function extractCode(body: string): string {
  const lines = body.split("\n");
  const idx = lines.findIndex((l) => l.trim().startsWith("```"));
  if (idx === -1) return body;
  const rest = lines.slice(idx + 1);
  const end = rest.findIndex((l) => l.trim().startsWith("```"));
  // While streaming, the closing fence may not have arrived yet.
  return end === -1 ? rest.join("\n") : rest.slice(0, end).join("\n");
}

function highlightKeywords(bullet: string): React.ReactNode {
  const parts = bullet.split(/(\d+(?:\.\d+)?%|\$\d+(?:\.\d+)?[kKmMbB]?|\b[A-Z][A-Za-z0-9+.#-]{1,20}\b)/g);
  return parts.map((part, i) => {
    const isMetric = /^\d/.test(part);
    const isTech =
      /^[A-Z][a-z]/.test(part) && !["I", "The", "We", "My", "It", "A"].includes(part);
    if (isMetric) {
      return (
        <span key={i} className="text-copilot-accent font-semibold">
          {part}
        </span>
      );
    }
    if (isTech) {
      return (
        <span key={i} className="text-copilot-text font-medium">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function formatHotkey(hotkey: string): string {
  const map: Record<string, string> = {
    CommandOrControl: "Ctrl",
    Shift: "⇧",
    Space: "Space",
  };
  return hotkey
    .split("+")
    .map((k) => map[k] ?? k)
    .join(" ");
}