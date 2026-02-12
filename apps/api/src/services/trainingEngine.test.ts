import { describe, expect, it } from 'vitest';
import {
  computeDeltaSets,
  computeExerciseTargets,
  getRirTarget,
} from './trainingEngine';
import {
  computeSeriesTarget,
  estimateE1rmStrengthLevel,
  findRepsEquivalent,
} from '@fitness-forge/shared';

describe('TrainingEngine.getRirTarget', () => {
  it('returns deload target when isDeload is true', () => {
    expect(getRirTarget('FOUR_ONE', 2, true)).toBe(5);
  });
});

describe('TrainingEngine.computeDeltaSets', () => {
  it('applies stop rules for jl', () => {
    expect(
      computeDeltaSets({
        jl: 5,
        doms: 1,
        pump: 1,
        fat: 1,
        perf: 3,
        isSecondOrLaterSameMuscleInWeek: false,
      }),
    ).toBe(-2);
  });

  it('applies recovery rules for doms/fat', () => {
    expect(
      computeDeltaSets({
        jl: 2,
        doms: 5,
        pump: 2,
        fat: 2,
        perf: 3,
        isSecondOrLaterSameMuscleInWeek: false,
      }),
    ).toBe(-1);
  });

  it('applies stimulus rule for pump/perf', () => {
    expect(
      computeDeltaSets({
        jl: 2,
        doms: 2,
        pump: 4,
        fat: 2,
        perf: 3,
        isSecondOrLaterSameMuscleInWeek: false,
      }),
    ).toBe(1);
  });

  it('applies soft rule to avoid positive delta on second session', () => {
    expect(
      computeDeltaSets({
        jl: 2,
        doms: 4,
        pump: 5,
        fat: 3,
        perf: 4,
        isSecondOrLaterSameMuscleInWeek: true,
      }),
    ).toBe(0);
  });
});

describe('TrainingEngine.computeExerciseTargets', () => {
  it('uses step min as default load increase', () => {
    const result = computeExerciseTargets({
      toolType: 'DUMBBELL',
      loadPrev: 20,
      repsRefPrev: 10,
      setsPrev: 3,
    });

    expect(result.loadTarget).toBe(21);
    expect(result.repsTargetHint).toBe(10);
  });

  it('scales reps when load exceeds step max', () => {
    const result = computeExerciseTargets({
      toolType: 'BARBELL',
      loadPrev: 100,
      repsRefPrev: 8,
      setsPrev: 3,
      loadChosen: 110,
    });

    expect(result.repsTargetHint).toBe(6);
  });
});

describe('Series target (e1RM)', () => {
  it('interpolates between Brzycki and Epley for 8-10 reps', () => {
    const brz8 = estimateE1rmStrengthLevel(100, 8);
    const brz9 = 100 * 36 / (37 - 9);
    const epl9 = 100 * (1 + 9 / 30);
    const expected9 = (1 - 0.5) * brz9 + 0.5 * epl9;
    const e9 = estimateE1rmStrengthLevel(100, 9);
    const e10 = estimateE1rmStrengthLevel(100, 10);

    expect(brz8).toBeGreaterThan(0);
    expect(e9).toBeCloseTo(expected9, 5);
    expect(e10).toBeGreaterThan(e9);
  });

  it('reduces reps when weight increases significantly', () => {
    const result = findRepsEquivalent(105, 8, 110, {
      toolType: 'BARBELL',
      maxRepDropPerWeek: 5,
      maxRepIncreasePerWeek: 5,
    });

    expect(result.repsTarget).toBeLessThanOrEqual(6);
  });

  it('increases reps when weight decreases, with clamp', () => {
    const result = findRepsEquivalent(100, 8, 90, {
      toolType: 'BARBELL',
      maxRepDropPerWeek: 3,
      maxRepIncreasePerWeek: 3,
    });

    expect(result.repsTarget).toBeGreaterThan(8);
    expect(result.repsTarget).toBeLessThanOrEqual(11);
    expect(result.flags.clampedByMaxIncrease).toBe(true);
  });

  it('clamps to min reps', () => {
    const result = findRepsEquivalent(105, 5, 130, {
      toolType: 'BARBELL',
      minRepsByTool: { BARBELL: 4 },
      maxRepDropPerWeek: 10,
      maxRepIncreasePerWeek: 10,
    });

    expect(result.repsTarget).toBeGreaterThanOrEqual(4);
    expect(result.flags.clampedByMinReps).toBe(true);
  });

  it('flags too heavy when intensity is above threshold', () => {
    const result = findRepsEquivalent(105, 8, 120, {
      toolType: 'BARBELL',
      maxIntensity: 0.92,
    });

    expect(result.flags.tooHeavy).toBe(true);
  });

  it('auto uses w_auto and keeps reps', () => {
    const result = computeSeriesTarget(
      { weight: 16.5, reps: 12 },
      null,
      { toolType: 'DUMBBELL' },
    );

    expect(result.weightTarget).toBe(17.5);
    expect(result.repsTarget).toBe(12);
    expect(result.flags.auto).toBe(true);
  });

  it('same weight or below auto but not below prev adds one rep', () => {
    const result = computeSeriesTarget(
      { weight: 16.5, reps: 12 },
      17,
      { toolType: 'DUMBBELL' },
    );

    expect(result.repsTarget).toBe(13);
    expect(result.flags.underAutoButNotBelowPrevPlusOneRep).toBe(true);
  });

  it('keeps reps inside delta range', () => {
    const result = computeSeriesTarget(
      { weight: 100, reps: 8 },
      104,
      { toolType: 'BARBELL' },
    );

    expect(result.repsTarget).toBe(8);
    expect(result.flags.inDeltaRangeKeepReps).toBe(true);
  });

  it('returns null reps when clamped and removeRepsIfClamped is true', () => {
    const result = computeSeriesTarget(
      { weight: 100, reps: 5 },
      140,
      { toolType: 'BARBELL', minRepsByTool: { BARBELL: 4 }, removeRepsIfClamped: true },
    );

    expect(result.repsTarget).toBeNull();
    expect(result.flags.repsRemovedOutOfBounds).toBe(true);
  });
});
