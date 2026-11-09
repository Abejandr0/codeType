import { z } from 'zod';

export const registerSchema = z.object({ name: z.string().trim().min(2).max(60), email: z.string().trim().email(), password: z.string().min(10).max(128) });
export const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });
export const settingsSchema = z.object({ interfaceLanguage: z.enum(['ES','EN']).optional(), keyboardLayout: z.enum(['ES','LATAM','US']).optional(), defaultLanguage: z.enum(['Python','JavaScript']).optional(), editorFontSize: z.number().int().min(12).max(32).optional(), sounds: z.boolean().optional(), dailyGoalMinutes: z.number().int().min(5).max(240).optional(), notifications: z.boolean().optional(), timezone: z.string().min(1).max(80).optional() }).strict();
export const friendRequestSchema = z.object({ email: z.string().trim().email() });
export const completeLessonSchema = z.object({ lessonId: z.string().min(1), correctChars: z.number().int().nonnegative(), errors: z.number().int().nonnegative(), durationMs: z.number().int().positive(), keystrokes: z.array(z.object({ expected: z.string(), actual: z.string(), elapsedMs: z.number().int().nonnegative(), correct: z.boolean() })).max(10000) });
export type Keystroke = z.infer<typeof completeLessonSchema>['keystrokes'][number];
export function calculateMetrics(correctChars: number, errors: number, elapsedMs: number) {
  const minutes = Math.max(elapsedMs / 60_000, 1 / 60_000);
  const total = correctChars + errors;
  return { wpm: Math.round((correctChars / 5 / minutes) * 10) / 10, accuracy: total === 0 ? 100 : Math.round((correctChars / total) * 1000) / 10, errors, elapsedMs };
}

/** Advances only on an exact character match; callers may map physical keyboard events to text input. */
export function typeCharacter(target: string, cursor: number, input: string) {
  if (cursor >= target.length) return { cursor, correct: false, complete: true };
  const correct = input === target[cursor];
  const nextCursor = correct ? cursor + 1 : cursor;
  return { cursor: nextCursor, correct, complete: nextCursor === target.length };
}

export type Lesson = { id: string; language: 'Python' | 'JavaScript'; path: string; title: string; level: number; code: string; tip: string; minAccuracy: number };
