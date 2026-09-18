"use client";

import { useState } from "react";
import { ATTRIBUTION, CHANNEL_URL, embedUrl, searchUrl, watchUrl, type LessonVideo } from "@/lib/videos";
import type { Skill } from "@/lib/types";

/**
 * Lesson video for a skill. Collapsed by default so practice stays the focus,
 * and only mounted once opened -- an unopened panel loads nothing from YouTube.
 */
export function VideoPanel({
  skill,
  video,
  defaultOpen = false,
}: {
  skill: Skill;
  video: LessonVideo | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!video) {
    return (
      <div className="kx-card p-4">
        <p className="text-sm text-[var(--kx-muted)]">
          No lesson video is matched to this skill yet.{" "}
          <a
            className="font-semibold text-brand-700 underline underline-offset-2 dark:text-brand-300"
            href={searchUrl(skill)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Search Khan Academy
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="kx-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--kx-surface-2)]"
      >
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-600 text-white">
          ▶
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Watch the lesson</span>
          <span className="block truncate text-xs text-[var(--kx-muted)]">{video.title}</span>
        </span>
        <span aria-hidden className={`text-[var(--kx-muted)] transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--kx-border)] p-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={embedUrl(video.videoId)}
              title={video.title}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          <p className="mt-3 text-xs leading-relaxed text-[var(--kx-muted)]">
            {ATTRIBUTION}{" "}
            <a
              className="font-semibold underline underline-offset-2"
              href={watchUrl(video.videoId)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Watch on YouTube
            </a>
            {" · "}
            <a
              className="font-semibold underline underline-offset-2"
              href={CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {video.channel}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
