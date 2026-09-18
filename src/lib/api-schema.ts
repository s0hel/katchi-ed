import { z } from "zod";

/** Shared request shapes for the practice endpoints. */
export const questionRequest = z.object({
  skillId: z.string().min(1).max(120),
  level: z.number().int().min(1).max(8),
  seed: z.number().int().min(0).max(2 ** 31),
});

export const gradeRequest = questionRequest.extend({
  response: z.string().max(400),
});

export const assessmentGradeRequest = z.object({
  items: z
    .array(
      questionRequest.extend({ response: z.string().max(400) }),
    )
    .min(1)
    .max(40),
});

export type QuestionRequest = z.infer<typeof questionRequest>;
export type GradeRequest = z.infer<typeof gradeRequest>;
