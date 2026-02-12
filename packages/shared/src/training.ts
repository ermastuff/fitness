export type ToolType = 'DUMBBELL' | 'BARBELL' | 'MACHINE';

export type SeriesTargetFlags = {
  overrideUsed: boolean;
  clampedByMinReps: boolean;
  clampedByMaxDrop: boolean;
  clampedByMaxIncrease: boolean;
  tooHeavy: boolean;
  sameWeightPlusOneRep?: boolean;
  inRangeKeepReps?: boolean;
  auto?: boolean;
  underAutoButNotBelowPrevPlusOneRep?: boolean;
  aboveRangeE1rm?: boolean;
  belowPrevE1rm?: boolean;
  repsRemovedOutOfBounds?: boolean;
  inDeltaRangeKeepReps?: boolean;
};

export type SeriesTargetConfig = {
  minReps?: number;
  minRepsByTool?: Partial<Record<ToolType, number>>;
  maxRepDropPerWeek?: number;
  maxRepIncreasePerWeek?: number;
  maxIntensity?: number;
  maxRepsScan?: number;
  stepMinByTool?: Partial<Record<ToolType, number>>;
  stepMaxByTool?: Partial<Record<ToolType, number>>;
  weightQuantization?: number;
  removeRepsIfClamped?: boolean;
};

type PreviousSet = {
  weight: number;
  reps: number;
};

const DEFAULT_STEP_MIN: Record<ToolType, number> = {
  DUMBBELL: 1,
  BARBELL: 2.5,
  MACHINE: 2.5,
};

const DEFAULT_STEP_MAX: Record<ToolType, number> = {
  DUMBBELL: 2.5,
  BARBELL: 5,
  MACHINE: 5,
};

const DEFAULT_MIN_REPS: Record<ToolType, number> = {
  DUMBBELL: 5,
  BARBELL: 3,
  MACHINE: 5,
};

const getStepMin = (toolType: ToolType, config?: SeriesTargetConfig) =>
  config?.stepMinByTool?.[toolType] ?? DEFAULT_STEP_MIN[toolType];

const getStepMax = (toolType: ToolType, config?: SeriesTargetConfig) =>
  config?.stepMaxByTool?.[toolType] ?? DEFAULT_STEP_MAX[toolType];

const getMinReps = (toolType: ToolType, config?: SeriesTargetConfig) =>
  config?.minReps ?? config?.minRepsByTool?.[toolType] ?? DEFAULT_MIN_REPS[toolType];

const quantizeWeight = (value: number, step: number) =>
  Math.round(value / step) * step;

export const estimateE1rmStrengthLevel = (weight: number, reps: number) => {
  if (weight <= 0 || reps <= 0) {
    return 0;
  }

  const brz = weight * 36 / (37 - reps);
  const epl = weight * (1 + reps / 30);

  if (reps < 8) {
    return brz;
  }
  if (reps > 10) {
    return epl;
  }

  const t = (reps - 8) / 2;
  return (1 - t) * brz + t * epl;
};

export const findRepsForWeight = (
  weightAnchor: number,
  repsAnchor: number,
  weightUser: number,
  config: SeriesTargetConfig & { toolType: ToolType },
) => {
  const flags: SeriesTargetFlags = {
    overrideUsed: true,
    clampedByMinReps: false,
    clampedByMaxDrop: false,
    clampedByMaxIncrease: false,
    tooHeavy: false,
  };

  const minSearch = 1;
  const maxSearch = config.maxRepsScan ?? 30;
  const maxDrop = config.maxRepDropPerWeek ?? 3;
  const maxIncrease = config.maxRepIncreasePerWeek ?? 5;

  const eTarget = estimateE1rmStrengthLevel(weightAnchor, repsAnchor);

  let bestReps = minSearch;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (let reps = minSearch; reps <= maxSearch; reps += 1) {
    const estimate = estimateE1rmStrengthLevel(weightUser, reps);
    const diff = Math.abs(estimate - eTarget);
    if (
      diff < bestDiff ||
      (diff === bestDiff &&
        Math.abs(reps - repsAnchor) < Math.abs(bestReps - repsAnchor))
    ) {
      bestDiff = diff;
      bestReps = reps;
    }
  }

  let repsTarget = bestReps;

  if (weightUser > weightAnchor && repsTarget > repsAnchor) {
    repsTarget = repsAnchor;
    flags.clampedByMaxIncrease = true;
  }
  if (weightUser < weightAnchor && repsTarget < repsAnchor) {
    repsTarget = repsAnchor;
    flags.clampedByMaxDrop = true;
  }

  const drop = repsAnchor - repsTarget;
  if (drop > maxDrop) {
    repsTarget = repsAnchor - maxDrop;
    flags.clampedByMaxDrop = true;
  }

  const increase = repsTarget - repsAnchor;
  if (increase > maxIncrease) {
    repsTarget = repsAnchor + maxIncrease;
    flags.clampedByMaxIncrease = true;
  }

  const minReps = getMinReps(config.toolType, config);
  if (repsTarget < minReps) {
    repsTarget = minReps;
    flags.clampedByMinReps = true;
  }

  if (config.maxIntensity) {
    const intensity = eTarget > 0 ? weightUser / eTarget : 0;
    if (intensity > config.maxIntensity) {
      flags.tooHeavy = true;
    }
  }

  const clamped =
    flags.clampedByMinReps || flags.clampedByMaxDrop || flags.clampedByMaxIncrease;
  if (config.removeRepsIfClamped && clamped) {
    flags.repsRemovedOutOfBounds = true;
    return { repsTarget: null, flags, eTarget };
  }
  if (flags.tooHeavy) {
    flags.repsRemovedOutOfBounds = true;
    return { repsTarget: null, flags, eTarget };
  }

  return { repsTarget, flags, eTarget };
};

export const computeSeriesTarget = (
  previousSet: PreviousSet,
  desiredWeight: number | null | undefined,
  config: SeriesTargetConfig & { toolType: ToolType },
) => {
  const stepMin = getStepMin(config.toolType, config);
  const stepMax = getStepMax(config.toolType, config);
  const quantStep = config.weightQuantization ?? 0.5;

  const prevWeight = quantizeWeight(previousSet.weight, quantStep);
  const prevReps = previousSet.reps;
  const autoWeight = quantizeWeight(prevWeight + stepMin, quantStep);
  const hasOverride = typeof desiredWeight === 'number';
  const rawUserWeight = hasOverride ? desiredWeight : autoWeight;
  const userWeight = quantizeWeight(rawUserWeight, quantStep);

  const wLow = quantizeWeight(prevWeight + stepMin, quantStep);
  const wHigh = quantizeWeight(prevWeight + stepMax, quantStep);

  if (!hasOverride) {
    return {
      weightTarget: autoWeight,
      repsTarget: prevReps,
      flags: {
        overrideUsed: false,
        clampedByMinReps: false,
        clampedByMaxDrop: false,
        clampedByMaxIncrease: false,
        tooHeavy: false,
        auto: true,
      },
    };
  }

  if (userWeight < autoWeight && userWeight >= prevWeight) {
    return {
      weightTarget: userWeight,
      repsTarget: prevReps + 1,
      flags: {
        overrideUsed: true,
        clampedByMinReps: false,
        clampedByMaxDrop: false,
        clampedByMaxIncrease: false,
        tooHeavy: false,
        sameWeightPlusOneRep: userWeight === prevWeight,
        underAutoButNotBelowPrevPlusOneRep: true,
      },
    };
  }

  if (userWeight >= wLow && userWeight <= wHigh) {
    return {
      weightTarget: userWeight,
      repsTarget: prevReps,
      flags: {
        overrideUsed: true,
        clampedByMinReps: false,
        clampedByMaxDrop: false,
        clampedByMaxIncrease: false,
        tooHeavy: false,
        inRangeKeepReps: true,
        inDeltaRangeKeepReps: true,
      },
    };
  }

  if (userWeight > prevWeight && userWeight < wLow) {
    const { repsTarget, flags } = findRepsForWeight(wLow, prevReps, userWeight, config);
    return {
      weightTarget: userWeight,
      repsTarget,
      flags: { ...flags, overrideUsed: true, underAutoButNotBelowPrevPlusOneRep: false },
    };
  }

  if (userWeight > wHigh) {
    const { repsTarget, flags } = findRepsForWeight(wHigh, prevReps, userWeight, config);
    return {
      weightTarget: userWeight,
      repsTarget,
      flags: { ...flags, overrideUsed: true, aboveRangeE1rm: true },
    };
  }

  const { repsTarget, flags } = findRepsForWeight(
    prevWeight,
    prevReps + 1,
    userWeight,
    config,
  );
  return {
    weightTarget: userWeight,
    repsTarget,
    flags: { ...flags, overrideUsed: true, belowPrevE1rm: true },
  };
};

export const estimate_e1rm_strengthlevel = estimateE1rmStrengthLevel;
export const find_reps_equivalent = findRepsForWeight;
export const findRepsEquivalent = findRepsForWeight;
