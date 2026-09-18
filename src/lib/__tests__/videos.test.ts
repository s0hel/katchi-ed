import { describe, expect, it } from "vitest";
import catalog from "../../data/videos.json";
import { SKILLS } from "../curriculum";
import { embedUrl, hasVideo, videoForSkill, watchUrl } from "../videos";

const entries = Object.entries(catalog as Record<string, { videoId: string; title: string; channel: string }>);

describe("lesson video catalog", () => {
  it("covers most skills", () => {
    const covered = SKILLS.filter((s) => hasVideo(s.id)).length;
    expect(covered / SKILLS.length).toBeGreaterThan(0.9);
  });

  it("only references skills that exist", () => {
    const ids = new Set(SKILLS.map((s) => s.id));
    const orphans = entries.filter(([id]) => !ids.has(id)).map(([id]) => id);
    expect(orphans).toEqual([]);
  });

  it("stores well-formed, attributed YouTube ids", () => {
    const bad = entries.filter(
      ([, v]) => !/^[A-Za-z0-9_-]{11}$/.test(v.videoId) || v.channel !== "Khan Academy" || !v.title?.trim(),
    );
    expect(bad).toEqual([]);
  });

  it("embeds through the privacy-enhanced player", () => {
    for (const [, v] of entries.slice(0, 5)) {
      expect(embedUrl(v.videoId)).toContain("youtube-nocookie.com");
      expect(watchUrl(v.videoId)).toContain(v.videoId);
    }
  });

  it("returns null rather than a guess for uncovered skills", () => {
    const uncovered = SKILLS.find((s) => !hasVideo(s.id));
    if (uncovered) expect(videoForSkill(uncovered)).toBeNull();
  });
});
