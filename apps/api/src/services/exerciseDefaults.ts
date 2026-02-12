type ExerciseRole = 'main' | 'secondary' | 'isolation';

const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const muscleGroupIn = (value: string, list: string[]) =>
  list.includes(normalize(value));

export const deriveExerciseRole = (toolType: string, muscleGroupName: string): ExerciseRole => {
  const mg = normalize(muscleGroupName);
  if (muscleGroupIn(mg, ['abs', 'addome', 'forearms', 'avambracci'])) {
    return 'isolation';
  }

  if (
    toolType === 'DUMBBELL' &&
    muscleGroupIn(mg, [
      'biceps',
      'bicipiti',
      'triceps',
      'tricipiti',
      'calves',
      'polpacci',
      'lateral delts',
      'lateral_delts',
      'deltoidi laterali',
    ])
  ) {
    return 'isolation';
  }

  if (
    toolType === 'BARBELL' &&
    muscleGroupIn(mg, [
      'chest',
      'petto',
      'back',
      'dorso',
      'legs',
      'quadricipiti',
      'femorali',
      'glutes',
      'glutei',
    ])
  ) {
    return 'main';
  }

  if (toolType === 'MACHINE' || toolType === 'DUMBBELL') {
    return 'secondary';
  }

  return 'secondary';
};

export const deriveJointStress = (
  toolType: string,
  muscleGroupName: string,
  role: ExerciseRole,
) => {
  const mg = normalize(muscleGroupName);
  let stress = 3;

  if (
    toolType === 'BARBELL' &&
    muscleGroupIn(mg, ['legs', 'quadricipiti', 'femorali', 'back', 'dorso', 'glutes', 'glutei'])
  ) {
    stress = 4;
  } else if (
    toolType === 'BARBELL' &&
    muscleGroupIn(mg, ['chest', 'petto', 'shoulders', 'spalle'])
  ) {
    stress = 4;
  } else if (toolType === 'BARBELL') {
    stress = 3;
  } else if (toolType === 'MACHINE') {
    stress = 2;
  } else if (toolType === 'DUMBBELL') {
    stress = 2;
  }

  if (role === 'isolation') {
    stress = Math.min(stress, 2);
  }

  return Math.min(5, Math.max(1, stress));
};

export const deriveMaxSets = (role: ExerciseRole, currentSets: number) => {
  const base =
    role === 'main' ? 8 : role === 'isolation' ? 5 : 6;
  return Math.max(base, currentSets);
};
