import { describe, expect, it } from 'vitest';
import { calculateMetrics, typeCharacter } from './index';

describe('typing engine primitives', () => {
  it('advances on correct input and holds position on mistakes', () => {
    expect(typeCharacter('ab', 0, 'a')).toEqual({ cursor: 1, correct: true, complete: false });
    expect(typeCharacter('ab', 1, 'x')).toEqual({ cursor: 1, correct: false, complete: false });
  });
  it('advances across spaces, newlines, tabs and Spanish accented characters', () => {
    const target = 'ñ\n  print("á")\t';
    let cursor = 0;
    for (const input of Array.from(target)) {
      const result = typeCharacter(target, cursor, input);
      expect(result.correct).toBe(true);
      cursor = result.cursor;
    }
    expect(cursor).toBe(target.length);
    expect(typeCharacter(target, cursor, 'x')).toEqual({ cursor, correct: false, complete: true });
  });
  it('calculates WPM and accuracy from actual counts', () => {
    expect(calculateMetrics(100, 10, 60_000)).toEqual({ wpm: 20, accuracy: 90.9, errors: 10, elapsedMs: 60_000 });
  });
});
