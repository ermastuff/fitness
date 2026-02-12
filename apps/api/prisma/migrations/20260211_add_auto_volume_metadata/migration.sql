-- Add auto volume metadata to session_exercises
ALTER TABLE "session_exercises"
  ADD COLUMN "auto_volume_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "exercise_role" TEXT NOT NULL DEFAULT 'secondary',
  ADD COLUMN "min_sets" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "max_sets" INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN "joint_stress" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "last_auto_volume_adjusted_at" TIMESTAMP NULL,
  ADD COLUMN "last_auto_volume_adjusted_direction" INTEGER NULL;

ALTER TABLE "session_exercises"
  ADD CONSTRAINT "session_exercises_role_check" CHECK ("exercise_role" IN ('main', 'secondary', 'isolation')),
  ADD CONSTRAINT "session_exercises_min_sets_check" CHECK ("min_sets" >= 0),
  ADD CONSTRAINT "session_exercises_max_sets_check" CHECK ("max_sets" >= "min_sets"),
  ADD CONSTRAINT "session_exercises_joint_stress_check" CHECK ("joint_stress" BETWEEN 1 AND 5),
  ADD CONSTRAINT "session_exercises_adjust_direction_check" CHECK (
    "last_auto_volume_adjusted_direction" IN (-1, 1) OR "last_auto_volume_adjusted_direction" IS NULL
  );

CREATE INDEX "session_exercises_auto_volume_exercise_idx"
  ON "session_exercises" ("auto_volume_enabled", "exercise_id");

CREATE INDEX "session_exercises_last_auto_volume_adjusted_at_idx"
  ON "session_exercises" ("last_auto_volume_adjusted_at");

WITH resolved AS (
  SELECT
    se.id AS session_exercise_id,
    se.sets_target AS sets_target,
    e.tool_type AS tool_type,
    LOWER(mg.name) AS muscle_group,
    CASE
      WHEN LOWER(mg.name) IN ('abs', 'addome', 'forearms', 'avambracci') THEN 'isolation'
      WHEN e.tool_type = 'DUMBBELL'
        AND LOWER(mg.name) IN ('biceps', 'bicipiti', 'triceps', 'tricipiti', 'calves', 'polpacci', 'lateral_delts', 'lateral delts', 'deltoidi laterali')
        THEN 'isolation'
      WHEN e.tool_type = 'BARBELL'
        AND LOWER(mg.name) IN ('chest', 'petto', 'back', 'dorso', 'legs', 'quadricipiti', 'femorali', 'glutes', 'glutei')
        THEN 'main'
      WHEN e.tool_type = 'MACHINE' THEN 'secondary'
      WHEN e.tool_type = 'DUMBBELL' THEN 'secondary'
      ELSE 'secondary'
    END AS exercise_role,
    CASE
      WHEN e.tool_type = 'BARBELL'
        AND LOWER(mg.name) IN ('legs', 'quadricipiti', 'femorali', 'back', 'dorso', 'glutes', 'glutei')
        THEN 4
      WHEN e.tool_type = 'BARBELL'
        AND LOWER(mg.name) IN ('chest', 'petto', 'shoulders', 'spalle')
        THEN 4
      WHEN e.tool_type = 'BARBELL' THEN 3
      WHEN e.tool_type = 'MACHINE' THEN 2
      WHEN e.tool_type = 'DUMBBELL' THEN 2
      ELSE 3
    END AS base_stress
  FROM "session_exercises" se
  JOIN "exercises" e ON e.id = se.exercise_id
  JOIN "muscle_groups" mg ON mg.id = e.primary_muscle_group_id
)
UPDATE "session_exercises" se
SET
  "exercise_role" = resolved.exercise_role,
  "joint_stress" = LEAST(5, GREATEST(1,
    CASE
      WHEN resolved.exercise_role = 'isolation' THEN LEAST(resolved.base_stress, 2)
      ELSE resolved.base_stress
    END
  )),
  "min_sets" = 1,
  "max_sets" = CASE
    WHEN resolved.exercise_role = 'main' THEN GREATEST(8, resolved.sets_target)
    WHEN resolved.exercise_role = 'secondary' THEN GREATEST(6, resolved.sets_target)
    WHEN resolved.exercise_role = 'isolation' THEN GREATEST(5, resolved.sets_target)
    ELSE GREATEST(6, resolved.sets_target)
  END
FROM resolved
WHERE se.id = resolved.session_exercise_id;
