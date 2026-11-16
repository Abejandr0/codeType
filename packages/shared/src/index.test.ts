import { describe, expect, it } from 'vitest';
import { calculateMetrics, compareLessons, compareLearningPaths, typeCharacter, typingKeyInstruction } from './index';

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
  it('orders learning paths in curriculum order', () => {
    expect(['Funciones', 'Bucles', 'Introducción', 'Condicionales'].sort(compareLearningPaths))
      .toEqual(['Introducción', 'Condicionales', 'Bucles', 'Funciones']);
  });
  it('orders lessons by path, language, and their own level sequence', () => {
    const lessons = [
      { id: 'js-2', path: 'Introducción', language: 'JavaScript', level: 2 },
      { id: 'py-1', path: 'Introducción', language: 'Python', level: 1 },
      { id: 'js-1', path: 'Introducción', language: 'JavaScript', level: 1 },
      { id: 'py-cond', path: 'Condicionales', language: 'Python', level: 6 },
    ];
    expect(lessons.sort(compareLessons).map(({ id }) => id)).toEqual(['js-1', 'js-2', 'py-1', 'py-cond']);
  });
  it('shows the real key combination for uppercase and layout-specific symbols', () => {
    expect(typingKeyInstruction('H', 'ES')).toEqual({ key: 'h', shift: true });
    expect(typingKeyInstruction('"', 'ES')).toEqual({ key: '2', shift: true });
    expect(typingKeyInstruction('"', 'US')).toEqual({ key: "'", shift: true });
    expect(typingKeyInstruction('\n', 'ES')).toEqual({ key: 'Enter', shift: false });
    expect(typingKeyInstruction('\t', 'ES')).toEqual({ key: 'Tab', shift: false });
  });
});
