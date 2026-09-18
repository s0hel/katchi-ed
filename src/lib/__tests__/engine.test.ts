import { describe, expect, it } from "vitest";
import {
  applyAnswer, emptySkillState, levelForScore, MASTERY, PROFICIENT, scoreBand,
} from "../smartscore";
import {
  buildReport, gradeToScore, pickNext, recordAnswer, scoreToGrade, startDiagnostic,
} from "../diagnostic";
import { buildAssessment, scoreAssessment } from "../assessment";
import { SKILLS } from "../curriculum";
import { generateQuestion } from "../generators";

describe("SmartScore", () => {
  it("starts at zero and stays inside 0..100", () => {
    let state = emptySkillState();
    expect(state.score).toBe(0);
    for (let i = 0; i < 200; i++) {
      state = applyAnswer(state, i % 3 !== 0, 4000).state;
      expect(state.score).toBeGreaterThanOrEqual(0);
      expect(state.score).toBeLessThanOrEqual(MASTERY);
    }
  });

  it("reaches mastery in a realistic number of correct answers", () => {
    let state = emptySkillState();
    let answers = 0;
    while (state.score < MASTERY && answers < 100) {
      state = applyAnswer(state, true, 3000).state;
      answers++;
    }
    expect(state.score).toBe(MASTERY);
    // IXL-like: a sustained run, not a handful of questions
    expect(answers).toBeGreaterThanOrEqual(12);
    expect(answers).toBeLessThanOrEqual(30);
  });

  it("awards less as the score climbs", () => {
    const low = applyAnswer({ ...emptySkillState(), score: 5 }, true, 3000).delta;
    const high = applyAnswer({ ...emptySkillState(), score: 95 }, true, 3000).delta;
    expect(low).toBeGreaterThan(high);
  });

  it("penalizes more as the score climbs", () => {
    const low = applyAnswer({ ...emptySkillState(), score: 10 }, false, 3000).delta;
    const high = applyAnswer({ ...emptySkillState(), score: 95 }, false, 3000).delta;
    expect(Math.abs(high)).toBeGreaterThan(Math.abs(low));
  });

  it("never drops below zero on a wrong answer", () => {
    expect(applyAnswer(emptySkillState(), false, 1000).state.score).toBe(0);
  });

  it("resets the streak on a miss but keeps the best score", () => {
    let state = emptySkillState();
    for (let i = 0; i < 5; i++) state = applyAnswer(state, true, 1000).state;
    const peak = state.score;
    expect(state.streak).toBe(5);
    state = applyAnswer(state, false, 1000).state;
    expect(state.streak).toBe(0);
    expect(state.best).toBe(peak);
    expect(state.score).toBeLessThan(peak);
  });

  it("flags milestones exactly once", () => {
    const justUnder = { ...emptySkillState(), score: PROFICIENT - 1 };
    expect(applyAnswer(justUnder, true, 1000).justProficient).toBe(true);
    const alreadyOver = { ...emptySkillState(), score: PROFICIENT + 5 };
    expect(applyAnswer(alreadyOver, true, 1000).justProficient).toBe(false);
  });

  it("raises the difficulty tier as the score rises", () => {
    expect(levelForScore(0, 4)).toBe(1);
    expect(levelForScore(99, 4)).toBe(4);
    expect(levelForScore(MASTERY, 4)).toBe(4);
    let previous = 0;
    for (let score = 0; score <= 100; score += 5) {
      const level = levelForScore(score, 4);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });

  it("bands the score the way the UI expects", () => {
    expect(scoreBand(0)).toBe("none");
    expect(scoreBand(40)).toBe("developing");
    expect(scoreBand(80)).toBe("proficient");
    expect(scoreBand(95)).toBe("excelling");
    expect(scoreBand(100)).toBe("mastered");
  });
});

describe("diagnostic", () => {
  /** Simulate a learner who reliably answers at or below `trueGrade`. */
  function simulate(trueGrade: number, questions = 30) {
    let state = startDiagnostic("math", 4, questions);
    for (let i = 0; i < questions; i++) {
      const pick = pickNext(state);
      if (!pick) break;
      state = recordAnswer(state, pick, pick.skill.grade <= trueGrade);
    }
    return buildReport(state);
  }

  it("converges upward for a strong learner", () => {
    const report = simulate(9);
    expect(report.overallGrade).toBeGreaterThan(5);
  });

  it("converges downward for a struggling learner", () => {
    const report = simulate(1);
    expect(report.overallGrade).toBeLessThan(4);
  });

  it("separates a learner who is strong in one strand only", () => {
    let state = startDiagnostic("math", 4, 40);
    for (let i = 0; i < 40; i++) {
      const pick = pickNext(state);
      if (!pick) break;
      // aces geometry at any level, struggles everywhere above grade 2
      const correct = pick.strand === "Geometry & Measurement" ? true : pick.skill.grade <= 2;
      state = recordAnswer(state, pick, correct);
    }
    const report = buildReport(state);
    const geometry = report.strands.find((s) => s.strand === "Geometry & Measurement")!;
    const others = report.strands.filter((s) => s.strand !== "Geometry & Measurement" && s.asked > 0);
    for (const other of others) {
      expect(geometry.score).toBeGreaterThan(other.score);
    }
    expect(report.strongest).toBe("Geometry & Measurement");
  });

  it("spreads questions across strands", () => {
    let state = startDiagnostic("math", 4, 20);
    for (let i = 0; i < 20; i++) {
      const pick = pickNext(state);
      if (!pick) break;
      state = recordAnswer(state, pick, true);
    }
    const counts = state.strands.map((s) => s.asked);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("stops at the requested length", () => {
    let state = startDiagnostic("math", 4, 10);
    for (let i = 0; i < 25; i++) {
      const pick = pickNext(state);
      if (!pick) break;
      state = recordAnswer(state, pick, i % 2 === 0);
    }
    expect(state.asked).toBe(10);
    expect(state.finished).toBe(true);
    expect(pickNext(state)).toBeNull();
  });

  it("serves questions that actually generate", () => {
    let state = startDiagnostic("ela", 5, 15);
    for (let i = 0; i < 15; i++) {
      const pick = pickNext(state);
      if (!pick) break;
      const q = generateQuestion(pick.skill, pick.level, 1000 + i);
      expect(q.stem.length).toBeGreaterThan(0);
      state = recordAnswer(state, pick, true);
    }
  });

  it("maps scores to grades symmetrically", () => {
    for (let grade = 0; grade <= 9; grade++) {
      expect(scoreToGrade(gradeToScore(grade))).toBe(grade);
    }
  });
});

describe("assessment", () => {
  it("builds the requested number of questions", () => {
    for (const count of [5, 10, 15]) {
      const plan = buildAssessment("math", 5, count, 42);
      expect(plan.items).toHaveLength(count);
    }
  });

  it("spreads items across the grade's strands", () => {
    const plan = buildAssessment("math", 6, 10, 7);
    const strands = new Set(
      plan.items.map((i) => SKILLS.find((s) => s.id === i.skillId)!.strand),
    );
    expect(strands.size).toBeGreaterThanOrEqual(3);
  });

  it("is reproducible from its seed", () => {
    expect(buildAssessment("math", 4, 10, 99).items).toEqual(
      buildAssessment("math", 4, 10, 99).items,
    );
  });

  it("only uses skills from the requested subject and grade", () => {
    const plan = buildAssessment("ela", 5, 10, 3);
    for (const item of plan.items) {
      const skill = SKILLS.find((s) => s.id === item.skillId)!;
      expect(skill.subject).toBe("ela");
      expect(skill.grade).toBe(5);
    }
  });

  it("generates a valid question for every item", () => {
    const plan = buildAssessment("math", 8, 15, 21);
    for (const item of plan.items) {
      const skill = SKILLS.find((s) => s.id === item.skillId)!;
      const q = generateQuestion(skill, item.level, item.seed);
      expect(q.answer.length).toBeGreaterThan(0);
    }
  });

  it("scores results by strand", () => {
    const plan = buildAssessment("math", 5, 10, 11);
    const outcomes = plan.items.map((_, i) => i % 2 === 0);
    const result = scoreAssessment(plan, outcomes);
    expect(result.total).toBe(10);
    expect(result.correct).toBe(5);
    expect(result.percent).toBe(50);
    expect(result.byStrand.reduce((n, s) => n + s.total, 0)).toBe(10);
  });
});
