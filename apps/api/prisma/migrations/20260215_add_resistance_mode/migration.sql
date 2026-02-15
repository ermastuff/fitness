DO $$
BEGIN
  CREATE TYPE "ResistanceMode" AS ENUM ('LOAD_AND_REPS', 'REPS_ONLY', 'BODYWEIGHT_OPTIONAL_LOAD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "exercises"
  ADD COLUMN IF NOT EXISTS "resistance_mode" "ResistanceMode" NOT NULL DEFAULT 'LOAD_AND_REPS';

UPDATE "exercises"
SET "resistance_mode" = CASE
  WHEN "tool_type" = 'BODYWEIGHT' AND "name" IN ('Dip (parallele)', 'Pull-up / Chin-up') THEN 'BODYWEIGHT_OPTIONAL_LOAD'::"ResistanceMode"
  WHEN "tool_type" = 'BODYWEIGHT' THEN 'REPS_ONLY'::"ResistanceMode"
  ELSE 'LOAD_AND_REPS'::"ResistanceMode"
END;

CREATE INDEX IF NOT EXISTS "exercises_resistance_mode_idx"
  ON "exercises" ("resistance_mode");
