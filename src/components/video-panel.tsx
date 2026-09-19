"use client";

import { ATTRIBUTION, CHANNEL_URL, embedUrl, searchUrl, watchUrl, type LessonVideo } from "@/lib/videos";
import type { Skill } from "@/lib/types";

/**
 * Lesson video for a skill. It sits at the top of the practice column at the
 * full width of that column -- a sidebar-sized player is unreadable for the
 * worked examples these lessons are made of.
 *
 * Open state is owned by the practice session so that a wrong answer can offer
 * the lesson and open it. The iframe is only mounted while open, so a closed
 * panel still loads nothing from YouTube.
 */
export function VideoPanel({
  skill,
  video,
  open,
  onToggle,
}: {
  skill: Skill;
  video: LessonVideo | null;
  open: boolean;
  onToggle: () => void;
}) {
  if (!video) {
    return (
      <div className="kx-card flex flex-wrap items-center gap-x-3 gap-y-1 p-4">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--kx-surface-2)]">
          ▶
        </span>
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
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-[var(--kx-surface-2)] sm:px-5"
      >
        <span
          aria-hidden
          className="grid h-12 w-[4.5rem] shrink-0 place-items-center rounded-lg bg-rose-600 text-xl text-white shadow-sm"
        >
          ▶
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold sm:text-lg">
            {open ? "Lesson video" : "Watch the lesson first"}
          </span>
          <span className="mt-0.5 block truncate text-sm text-[var(--kx-muted)]">{video.title}</span>
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-700 sm:flex dark:text-brand-300">
          {open ? "Hide" : "Play"}
          <span aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </span>
        <span aria-hidden className={`text-[var(--kx-muted)] transition-transform sm:hidden ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--kx-border)] p-4 sm:p-5">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
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
