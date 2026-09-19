import { describe, expect, it } from "vitest";
import catalog from "../../data/videos.json";
import { SKILLS, subjectKind } from "../curriculum";
import { channelUrl, embedUrl, hasVideo, videoForSkill, videosForSkill, watchUrl, type LessonVideo } from "../videos";

/** One row per video: a skill with a series of lessons contributes several. */
const entries = Object.entries(catalog as Record<string, LessonVideo | LessonVideo[]>).flatMap(
  ([id, entry]) => (Array.isArray(entry) ? entry : [entry]).map((v) => [id, v] as const),
);

describe("lesson video catalog", () => {
  it("covers most of the core catalog", () => {
    // Measured over math and language arts only. Khan Academy teaches topics,
    // not entrance-exam formats, so there is no honest lesson to attach to a
    // figure-matrix or a synonyms item -- and claiming one would be worse than
    // the search fallback the practice page already offers.
    const core = SKILLS.filter((s) => subjectKind(s.subject) === "core");
    const covered = core.filter((s) => hasVideo(s)).length;
    expect(covered / core.length).toBeGreaterThan(0.9);
  });

  it("lets a test-prep skill borrow the lesson for the topic it shares", () => {
    const borrower = SKILLS.find((s) => s.id === "isee-6-order-of-operations");
    expect(borrower, "the ISEE order-of-operations skill").toBeDefined();
    const lesson = videoForSkill(borrower!);
    expect(lesson?.videoId).toBe(videoForSkill(SKILLS.find((s) => s.id === "math-5-order-of-operations")!)?.videoId);
  });

  it("offers nothing rather than a bad match for an exam-only skill", () => {
    // These have no curated lesson and no core skill to borrow one from. The
    // borrow rule must not reach for a video about something else just to
    // fill the panel.
    for (const id of ["cogat-1-paper-folding", "isee-6-quantitative-comparison"]) {
      const skill = SKILLS.find((s) => s.id === id);
      expect(skill, id).toBeDefined();
      expect(videoForSkill(skill!)).toBeNull();
    }
  });

  it("only references skills that exist", () => {
    const ids = new Set(SKILLS.map((s) => s.id));
    const orphans = entries.filter(([id]) => !ids.has(id)).map(([id]) => id);
    expect(orphans).toEqual([]);
  });

  it("stores well-formed, attributed YouTube ids", () => {
    // The channel is no longer assumed to be Khan Academy -- CogAT lessons are
    // curated from elsewhere -- but every video still has to name one, because
    // the credit line under the player is built from it.
    const bad = entries.filter(
      ([, v]) => !/^[A-Za-z0-9_-]{11}$/.test(v.videoId) || !v.channel?.trim() || !v.title?.trim(),
    );
    expect(bad).toEqual([]);
  });

  it("links a credit to the channel that actually owns the video", () => {
    // Khan Academy's URL is the default, so a video from anyone else without
    // its own channelUrl would credit the wrong channel.
    const misattributed = entries.filter(
      ([, v]) => v.channel !== "Khan Academy" && !v.channelUrl?.startsWith("https://www.youtube.com/"),
    );
    expect(misattributed.map(([id, v]) => `${id}: ${v.channel}`)).toEqual([]);
    for (const [, v] of entries) expect(channelUrl(v)).toContain("youtube.com");
  });

  it("uses no video id twice for the same skill", () => {
    const bySkill = new Map<string, string[]>();
    for (const [id, v] of entries) bySkill.set(id, [...(bySkill.get(id) ?? []), v.videoId]);
    const dupes = [...bySkill].filter(([, ids]) => new Set(ids).size !== ids.length).map(([id]) => id);
    expect(dupes).toEqual([]);
  });

  it("keeps a series of lessons in order behind one skill", () => {
    const skill = SKILLS.find((s) => s.id === "cogat-1-picture-analogies")!;
    const lessons = videosForSkill(skill);
    expect(lessons.length).toBeGreaterThan(1);
    expect(lessons.map((v) => v.label)).toEqual(["Part 1", "Part 2", "Part 3", "Practice questions"]);
    // The single-video helper stays the entry point for everything else.
    expect(videoForSkill(skill)).toEqual(lessons[0]);
  });

  it("embeds through the privacy-enhanced player", () => {
    for (const [, v] of entries.slice(0, 5)) {
      expect(embedUrl(v.videoId)).toContain("youtube-nocookie.com");
      expect(watchUrl(v.videoId)).toContain(v.videoId);
    }
  });

  it("returns null rather than a guess for uncovered skills", () => {
    const uncovered = SKILLS.find((s) => !hasVideo(s));
    if (uncovered) expect(videoForSkill(uncovered)).toBeNull();
  });
});
