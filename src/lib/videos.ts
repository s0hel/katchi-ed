import catalog from "@/data/videos.json";
import { SKILLS, subjectKind } from "./curriculum";
import type { Skill } from "./types";

/**
 * Lesson videos, embedded through YouTube's official privacy-enhanced player.
 * We never re-host the files; every lesson shows its channel and links back to
 * the original video.
 *
 * Most of the catalog is Khan Academy, harvested offline by
 * scripts/harvest-videos.ts. Some skills are curated by hand from another
 * channel -- the CogAT ones, because Khan Academy does not teach entrance-test
 * formats -- so the channel is a property of the video rather than a constant,
 * and so is the attribution line beneath the player. Nothing is scraped at
 * request time and we never render an embed for a dead video id.
 */

export interface LessonVideo {
  videoId: string;
  title: string;
  channel: string;
  /** The channel's page. Khan Academy's is assumed when this is absent. */
  channelUrl?: string;
  /** Short name when a skill has several lessons: "Part 2", "Practice questions". */
  label?: string;
  query?: string;
  verifiedAt?: string;
}

/**
 * A skill has one lesson or a short series of them. Both shapes are stored
 * because most skills genuinely have one: wrapping a hundred harvested entries
 * in single-element arrays would be churn for nothing.
 */
const VIDEOS = catalog as Record<string, LessonVideo | LessonVideo[]>;

function listed(skillId: string): LessonVideo[] {
  const entry = VIDEOS[skillId];
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

/** Every lesson for a skill, in the order they should be watched. */
export function videosForSkill(skill: Skill): LessonVideo[] {
  const own = listed(skill.id);
  if (own.length) return own;
  const lent = borrowed(skill);
  return lent ? [lent] : [];
}

export function videoForSkill(skill: Skill): LessonVideo | null {
  return videosForSkill(skill)[0] ?? null;
}

/**
 * The lesson a test-prep skill borrows.
 *
 * Khan Academy has no CogAT or ISEE material, and it should not: those tests
 * are formats, not topics. But an ISEE Mathematics Achievement skill points at
 * the same generator as a math skill in the catalog, which means it is the
 * same topic wearing a different name -- so it can show that skill's lesson
 * rather than nothing. Skills with no core counterpart (every CogAT item, ISEE
 * synonyms, quantitative comparison) get null, and the practice page falls
 * back to a channel search.
 */
function borrowed(skill: Skill): LessonVideo | null {
  if (subjectKind(skill.subject) === "core") return null;
  const wanted = Object.entries(skill.params ?? {});
  const candidates = SKILLS.filter(
    (s) => subjectKind(s.subject) === "core" && s.generator === skill.generator && listed(s.id).length > 0,
  );
  if (!candidates.length) return null;

  // Closest topic first: the one sharing the most parameters, then the one
  // taught nearest this skill's grade.
  const shared = (s: Skill) => wanted.filter(([k, v]) => (s.params ?? {})[k] === v).length;
  const best = candidates.sort(
    (a, b) => shared(b) - shared(a) || Math.abs(a.grade - skill.grade) - Math.abs(b.grade - skill.grade),
  )[0];
  return listed(best.id)[0] ?? null;
}

export function hasVideo(skill: Skill): boolean {
  return videoForSkill(skill) !== null;
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

export const KHAN_CHANNEL_URL = "https://www.youtube.com/c/khanacademy";

export function channelUrl(video: LessonVideo): string {
  return video.channelUrl ?? KHAN_CHANNEL_URL;
}

/**
 * The credit line under a player.
 *
 * Khan Academy's licence is stated because it grants something (CC BY-NC-SA);
 * for any other channel the honest line is narrower -- we embed their player
 * and they keep every right they had. Naming a licence we have not been given
 * would be worse than naming none.
 */
export function attributionFor(video: LessonVideo): string {
  return video.channel === "Khan Academy"
    ? "Lesson by Khan Academy, used under CC BY-NC-SA and embedded from YouTube."
    : `Lesson by ${video.channel}, embedded from YouTube. All rights remain with the channel.`;
}
