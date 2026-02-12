type WeeklyEntry = {
  sets: number;
  fatigue: number;
  doms: number;
  pump: number;
  tendonPain: number;
};

export type WeeklyFeedback = {
  fatigueWeek: number;
  domsWeek: number;
  pumpWeek: number;
  painWeek: number;
  fatigueEff: number;
};

export type AutoVolumeFlags = {
  painOverride: boolean;
  freezeIncrease: boolean;
  smoothingBlocked: boolean;
  noCandidate: boolean;
};

export type AutoVolumeState = {
  lastDeltaSign: number;
  consecutiveCount: number;
};

export type CandidateExercise = {
  id: string;
  exerciseId: string;
  orderIndex: number;
  setsTarget: number;
  minSets: number;
  maxSets: number;
  exerciseRole: 'main' | 'secondary' | 'isolation';
  jointStress: number;
  lastAutoVolumeAdjustedAt: Date | null;
  session: {
    dayOfWeek: number;
    sessionOrderInWeek: number;
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const weightedAvg = (values: number[], weights: number[]) => {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return 0;
  }
  const weightedSum = values.reduce((sum, value, idx) => sum + value * weights[idx], 0);
  return weightedSum / total;
};

export const aggregateWeeklyFeedback = (entries: WeeklyEntry[]): WeeklyFeedback => {
  const weights = entries.map((entry) => entry.sets);
  const fatigueWeek = Math.round(
    weightedAvg(
      entries.map((entry) => entry.fatigue),
      weights,
    ),
  );
  const domsWeek = Math.round(
    weightedAvg(
      entries.map((entry) => entry.doms),
      weights,
    ),
  );
  const pumpWeek = Math.round(
    weightedAvg(
      entries.map((entry) => entry.pump),
      weights,
    ),
  );
  const painWeek = entries.reduce((max, entry) => Math.max(max, entry.tendonPain), 0);

  const domsMod = domsWeek === 1 ? -1 : domsWeek >= 4 ? domsWeek - 3 : 0;
  const fatigueEff = clamp(fatigueWeek + domsMod, 1, 5);

  return {
    fatigueWeek,
    domsWeek,
    pumpWeek,
    painWeek,
    fatigueEff,
  };
};

const MATRIX: number[][] = [
  [1, 1, 1, 0, 0],
  [1, 1, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [-1, -1, -1, 0, 0],
  [-1, -1, -1, -1, -1],
];

export const computeDeltaFromMatrix = (fatigueEff: number, pumpWeek: number) => {
  const fIdx = clamp(fatigueEff, 1, 5) - 1;
  const pIdx = clamp(pumpWeek, 1, 5) - 1;
  return MATRIX[fIdx][pIdx] ?? 0;
};

export const applyPainOverride = (delta: number, painWeek: number) => {
  let next = delta;
  let painOverride = false;
  let freezeIncrease = false;

  if (painWeek === 5) {
    next = -2;
    painOverride = true;
    freezeIncrease = true;
  } else if (painWeek === 4) {
    next = -1;
    painOverride = true;
    freezeIncrease = true;
  } else if (painWeek === 3 && next === 1) {
    next = 0;
    painOverride = true;
    freezeIncrease = true;
  }

  return { delta: next, painOverride, freezeIncrease };
};

export const applySmoothing = (
  delta: number,
  state: AutoVolumeState | null,
) => {
  if (delta === 0) {
    return {
      deltaFinal: 0,
      smoothingBlocked: false,
      state: { lastDeltaSign: 0, consecutiveCount: 0 },
    };
  }

  const sign = delta > 0 ? 1 : -1;
  const prev = state ?? { lastDeltaSign: 0, consecutiveCount: 0 };
  const consecutiveCount =
    prev.lastDeltaSign === sign ? prev.consecutiveCount + 1 : 1;
  const deltaFinal = consecutiveCount >= 2 ? delta : 0;

  return {
    deltaFinal,
    smoothingBlocked: deltaFinal === 0,
    state: { lastDeltaSign: sign, consecutiveCount },
  };
};

const roleRankPlus: Record<CandidateExercise['exerciseRole'], number> = {
  main: 0,
  secondary: 1,
  isolation: 2,
};

const roleRankMinus: Record<CandidateExercise['exerciseRole'], number> = {
  isolation: 0,
  secondary: 1,
  main: 2,
};

const sortByRecency = (a: CandidateExercise, b: CandidateExercise) => {
  if (!a.lastAutoVolumeAdjustedAt && b.lastAutoVolumeAdjustedAt) {
    return -1;
  }
  if (a.lastAutoVolumeAdjustedAt && !b.lastAutoVolumeAdjustedAt) {
    return 1;
  }
  const aTime = a.lastAutoVolumeAdjustedAt
    ? a.lastAutoVolumeAdjustedAt.getTime()
    : 0;
  const bTime = b.lastAutoVolumeAdjustedAt
    ? b.lastAutoVolumeAdjustedAt.getTime()
    : 0;
  return aTime - bTime;
};

export const selectAutoVolumeCandidate = (
  candidates: CandidateExercise[],
  delta: number,
  painWeek: number,
) => {
  if (delta === 0) {
    return null;
  }
  const isIncrease = delta > 0;
  const sorted = [...candidates].sort((a, b) => {
    const roleRank = isIncrease ? roleRankPlus : roleRankMinus;
    const roleDiff = roleRank[a.exerciseRole] - roleRank[b.exerciseRole];
    if (roleDiff !== 0) {
      return roleDiff;
    }

    if (painWeek >= 3) {
      const stressDiff = isIncrease
        ? a.jointStress - b.jointStress
        : b.jointStress - a.jointStress;
      if (stressDiff !== 0) {
        return stressDiff;
      }
    }

    const stressDiff = isIncrease
      ? a.jointStress - b.jointStress
      : b.jointStress - a.jointStress;
    if (stressDiff !== 0) {
      return stressDiff;
    }

    return sortByRecency(a, b);
  });

  return sorted[0] ?? null;
};

export const filterCandidatesForDelta = (
  candidates: CandidateExercise[],
  delta: number,
) => {
  if (delta === 0) {
    return [];
  }
  return candidates.filter((candidate) => {
    const nextSets = candidate.setsTarget + delta;
    if (delta > 0) {
      return nextSets <= candidate.maxSets;
    }
    return nextSets >= candidate.minSets;
  });
};
