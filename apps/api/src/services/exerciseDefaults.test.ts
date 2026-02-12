import { describe, expect, it } from 'vitest';
import { deriveExerciseRole, deriveJointStress, deriveMaxSets } from './exerciseDefaults';

describe('exerciseDefaults', () => {
  it('assigns main role to barbell chest/back/legs/glutes', () => {
    expect(deriveExerciseRole('BARBELL', 'petto')).toBe('main');
    expect(deriveExerciseRole('BARBELL', 'dorso')).toBe('main');
    expect(deriveExerciseRole('BARBELL', 'glutei')).toBe('main');
    expect(deriveExerciseRole('BARBELL', 'quadricipiti')).toBe('main');
  });

  it('assigns isolation to dumbbell arms/calves and abs', () => {
    expect(deriveExerciseRole('DUMBBELL', 'bicipiti')).toBe('isolation');
    expect(deriveExerciseRole('DUMBBELL', 'tricipiti')).toBe('isolation');
    expect(deriveExerciseRole('DUMBBELL', 'polpacci')).toBe('isolation');
    expect(deriveExerciseRole('DUMBBELL', 'addome')).toBe('isolation');
  });

  it('derives joint stress with isolation cap', () => {
    const role = deriveExerciseRole('BARBELL', 'petto');
    const stress = deriveJointStress('BARBELL', 'petto', role);
    expect(stress).toBe(4);

    const isoRole = deriveExerciseRole('DUMBBELL', 'bicipiti');
    const isoStress = deriveJointStress('DUMBBELL', 'bicipiti', isoRole);
    expect(isoStress).toBeLessThanOrEqual(2);
  });

  it('keeps max sets at least current sets', () => {
    expect(deriveMaxSets('main', 10)).toBe(10);
    expect(deriveMaxSets('secondary', 4)).toBe(6);
    expect(deriveMaxSets('isolation', 5)).toBe(5);
  });
});
