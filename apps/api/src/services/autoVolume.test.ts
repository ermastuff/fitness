import { describe, expect, it } from 'vitest';
import {
  aggregateWeeklyFeedback,
  applyPainOverride,
  applySmoothing,
  computeDeltaFromMatrix,
  filterCandidatesForDelta,
  selectAutoVolumeCandidate,
  type CandidateExercise,
} from './autoVolume';

describe('autoVolume aggregation', () => {
  it('computes weighted averages for different frequencies', () => {
    const entries = [
      { sets: 4, fatigue: 2, doms: 2, pump: 3, tendonPain: 2 },
      { sets: 1, fatigue: 5, doms: 4, pump: 1, tendonPain: 3 },
    ];
    const weekly = aggregateWeeklyFeedback(entries);
    expect(weekly.fatigueWeek).toBe(3);
    expect(weekly.domsWeek).toBe(2);
    expect(weekly.pumpWeek).toBe(3);
    expect(weekly.painWeek).toBe(3);
  });
});

describe('autoVolume pain override', () => {
  it('forces delta -2 when pain is 5', () => {
    const result = applyPainOverride(1, 5);
    expect(result.delta).toBe(-2);
    expect(result.painOverride).toBe(true);
  });
});

describe('autoVolume matrix + smoothing', () => {
  it('applies smoothing after two consecutive weeks', () => {
    const baseDelta = computeDeltaFromMatrix(1, 1);
    const first = applySmoothing(baseDelta, { lastDeltaSign: 0, consecutiveCount: 0 });
    expect(first.deltaFinal).toBe(0);
    expect(first.smoothingBlocked).toBe(true);

    const second = applySmoothing(baseDelta, first.state);
    expect(second.deltaFinal).toBe(1);
    expect(second.smoothingBlocked).toBe(false);
  });
});

describe('autoVolume candidate selection', () => {
  it('prefers main with low stress on increase, and least recent', () => {
    const base: Omit<CandidateExercise, 'id' | 'exerciseId' | 'orderIndex' | 'setsTarget'> = {
      minSets: 1,
      maxSets: 10,
      lastAutoVolumeAdjustedAt: null,
      jointStress: 2,
      exerciseRole: 'secondary',
      session: { dayOfWeek: 1, sessionOrderInWeek: 1 },
    };

    const candidates: CandidateExercise[] = [
      {
        id: 'a',
        exerciseId: 'ex1',
        orderIndex: 1,
        setsTarget: 3,
        ...base,
        exerciseRole: 'main',
        jointStress: 3,
      },
      {
        id: 'b',
        exerciseId: 'ex2',
        orderIndex: 1,
        setsTarget: 3,
        ...base,
        exerciseRole: 'secondary',
        jointStress: 2,
      },
    ];

    const picked = selectAutoVolumeCandidate(candidates, 1, 2);
    expect(picked?.id).toBe('a');
  });

  it('prefers isolation with high stress on decrease', () => {
    const candidates: CandidateExercise[] = [
      {
        id: 'a',
        exerciseId: 'ex1',
        orderIndex: 1,
        setsTarget: 3,
        minSets: 1,
        maxSets: 10,
        lastAutoVolumeAdjustedAt: null,
        jointStress: 2,
        exerciseRole: 'main',
        session: { dayOfWeek: 1, sessionOrderInWeek: 1 },
      },
      {
        id: 'b',
        exerciseId: 'ex2',
        orderIndex: 1,
        setsTarget: 3,
        minSets: 1,
        maxSets: 10,
        lastAutoVolumeAdjustedAt: null,
        jointStress: 4,
        exerciseRole: 'isolation',
        session: { dayOfWeek: 1, sessionOrderInWeek: 1 },
      },
    ];

    const picked = selectAutoVolumeCandidate(candidates, -1, 3);
    expect(picked?.id).toBe('b');
  });

  it('prefers least recently adjusted when role/stress tie', () => {
    const candidates: CandidateExercise[] = [
      {
        id: 'a',
        exerciseId: 'ex1',
        orderIndex: 1,
        setsTarget: 3,
        minSets: 1,
        maxSets: 10,
        lastAutoVolumeAdjustedAt: new Date('2025-01-01'),
        jointStress: 2,
        exerciseRole: 'secondary',
        session: { dayOfWeek: 1, sessionOrderInWeek: 1 },
      },
      {
        id: 'b',
        exerciseId: 'ex2',
        orderIndex: 1,
        setsTarget: 3,
        minSets: 1,
        maxSets: 10,
        lastAutoVolumeAdjustedAt: new Date('2024-01-01'),
        jointStress: 2,
        exerciseRole: 'secondary',
        session: { dayOfWeek: 1, sessionOrderInWeek: 1 },
      },
    ];

    const picked = selectAutoVolumeCandidate(candidates, 1, 2);
    expect(picked?.id).toBe('b');
  });
});

describe('autoVolume candidate filtering', () => {
  it('filters by min/max sets for delta', () => {
    const candidates: CandidateExercise[] = [
      {
        id: 'a',
        exerciseId: 'ex1',
        orderIndex: 1,
        setsTarget: 3,
        minSets: 1,
        maxSets: 3,
        lastAutoVolumeAdjustedAt: null,
        jointStress: 2,
        exerciseRole: 'secondary',
        session: { dayOfWeek: 1, sessionOrderInWeek: 1 },
      },
      {
        id: 'b',
        exerciseId: 'ex2',
        orderIndex: 1,
        setsTarget: 2,
        minSets: 2,
        maxSets: 5,
        lastAutoVolumeAdjustedAt: null,
        jointStress: 2,
        exerciseRole: 'secondary',
        session: { dayOfWeek: 1, sessionOrderInWeek: 1 },
      },
    ];

    const plusFiltered = filterCandidatesForDelta(candidates, 1);
    expect(plusFiltered.map((item) => item.id)).toEqual(['b']);

    const minusFiltered = filterCandidatesForDelta(candidates, -1);
    expect(minusFiltered.map((item) => item.id)).toEqual(['a']);
  });
});
