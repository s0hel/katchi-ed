import catalog from "@/data/videos.json";
import type { Skill } from "./types";

/**
 * Lesson videos come from Khan Academy's YouTube channel, embedded through the
 * official privacy-enhanced player. We never re-host the files; every lesson
 * shows the channel attribution and links back to the original video.
 *
 * The catalog is curated offline by scripts/harvest-videos.ts, so nothing is
 * scraped at request time and we never render an embed for a dead video id.
 */

export interface LessonVideo {
  videoId: string;
  title: string;
  channel: string;
  query?: string;
  verifiedAt?: string;
}

const VIDEOS = catalog as Record<string, LessonVideo>;

export function videoForSkill(skill: Skill): LessonVideo | null {
  return VIDEOS[skill.id] ?? null;
}

export function hasVideo(skillId: string): boolean {
  return skillId in VIDEOS;
}

export function videoCount(): number {
  return Object.keys(VIDEOS).length;
}

/** Privacy-enhanced embed URL (youtube-nocookie sets no tracking cookie until play). */
export function embedUrl(videoId: string): string {
  const params = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1" });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Fallback for a skill with no curated video: search the channel. */
export function searchUrl(skill: Skill): string {
  return `https://www.youtube.com/c/khanacademy/search?query=${encodeURIComponent(skill.name)}`;
}

export const CHANNEL_URL = "https://www.youtube.com/c/khanacademy";
export const ATTRIBUTION =
  "Lesson videos by Khan Academy, used under CC BY-NC-SA and embedded from YouTube.";
