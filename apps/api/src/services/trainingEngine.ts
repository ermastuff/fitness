export type MesocycleStructure = 'THREE_ONE' | 'FOUR_ONE' | 'FIVE_ONE';
export type ToolType = 'DUMBBELL' | 'BARBELL' | 'MACHINE';
export type SessionExerciseMode = 'AUTO' | 'LOCK_LOAD' | 'LOCK_REPS';

export const getRirTarget = (
  structure: MesocycleStructure,
  weekIndex: number,
  isDeload: boolean,
) => {
  if (isDeload) {
    return 5;
  }

  const rampMap: Record<MesocycleStructure, number[]> = {
    THREE_ONE: [3, 2, 1, 5],
    FOUR_ONE: [3, 2, 2, 1, 5],
    FIVE_ONE: [3, 3, 2, 2, 1, 5],
  };

  const ramp = rampMap[structure];
  const index = Math.max(1, Math.min(weekIndex, ramp.length)) - 1;
  return ramp[index];
};

export const computePerfSessionFromNumbers = (currentScore: number, prevScore: number) => {
  if (prevScore <= 0) {
    return 3;
  }

  const deltaPct = (currentScore - prevScore) / prevScore;

  if (deltaPct <= -0.2) {
    return 1;
  }
  if (deltaPct <= -0.1) {
    return 2;
  }
  if (deltaPct < 0.1) {
    return 3;
  }
  if (deltaPct >= 0.2) {
    return 5;
  }
  return 4;
};

type DeltaSetsInput = {
  jl: number;
  doms: number;
  pump: number;
  fat: number;
  perf: number;
  isSecondOrLaterSameMuscleInWeek: boolean;
};

export const computeDeltaSets = ({
  jl,
  doms,
  pump,
  fat,
  perf,
  isSecondOrLaterSameMuscleInWeek,
}: DeltaSetsInput): -2 | -1 | 0 | 1 => {
  if (jl >= 5) {
    return -2;
  }
  if (jl === 4) {
    return -1;
  }
  if (jl === 3) {
    return 0;
  }

  let delta: -1 | 0 | 1 = 0;

  if (doms === 5 || fat === 5) {
    delta = -1;
  } else if (doms === 4 && fat >= 4) {
    delta = -1;
  } else if (doms === 4 && fat <= 3) {
    delta = 0;
  } else if (doms === 3 && fat === 4) {
    delta = 0;
  }

  if (pump >= 4 && perf >= 3 && doms <= 3 && fat <= 3) {
    delta = 1;
  } else if (perf <= 2 && (doms >= 4 || fat >= 4)) {
    delta = -1;
  }

  if (isSecondOrLaterSameMuscleInWeek && doms >= 4 && fat >= 3) {
    delta = delta > 0 ? 0 : delta;
  }

  return delta;
};

type ExerciseTargetsInput = {
  toolType: ToolType;
  loadPrev: number;
  repsRefPrev: number;
  setsPrev: number;
  loadChosen?: number | null;
};

type ExerciseTargetsResult = {
  loadTarget: number;
  repsTargetHint: number;
  suggestionText: string | null;
};

const getStepMin = (toolType: ToolType) => (toolType === 'DUMBBELL' ? 1 : 2.5);
const getStepMax = (toolType: ToolType) => (toolType === 'DUMBBELL' ? 2.5 : 5);
const getOverstepUnit = (toolType: ToolType) => (toolType === 'DUMBBELL' ? 1.5 : 2.5);

const appendSuggestion = (existing: string | null, next: string) =>
  existing ? `${existing} ${next}` : next;

export const computeExerciseTargets = ({
  toolType,
  loadPrev,
  repsRefPrev,
  setsPrev,
  loadChosen,
}: ExerciseTargetsInput): ExerciseTargetsResult => {
  const stepMin = getStepMin(toolType);
  const stepMax = getStepMax(toolType);
  const overstepUnit = getOverstepUnit(toolType);
  let loadTarget = loadChosen ?? loadPrev;
  let repsTargetHint = repsRefPrev;
  let suggestionText: string | null = null;

  loadTarget = loadChosen ?? loadPrev + stepMin;
  const minTarget = loadPrev + stepMin;
  if (loadTarget < minTarget) {
    loadTarget = minTarget;
  }

  const maxTarget = loadPrev + stepMax;
  if (loadTarget > maxTarget) {
    const excess = loadTarget - maxTarget;
    const extraSteps = Math.ceil(excess / overstepUnit);
    repsTargetHint = Math.max(1, repsRefPrev - extraSteps);
    suggestionText = appendSuggestion(
      suggestionText,
      `Carico oltre range: -${extraSteps} rep(s) target.`,
    );
  } else {
    repsTargetHint = repsRefPrev;
  }

  const volPrev = loadPrev * repsRefPrev * setsPrev;
  const volNew = loadTarget * repsTargetHint * setsPrev;
  if (volNew < volPrev) {
    suggestionText = appendSuggestion(
      suggestionText,
      'Volume in calo: valuta +1 rep su una serie o un incremento carico piu piccolo.',
    );
  }

  return {
    loadTarget,
    repsTargetHint,
    suggestionText,
  };
};
