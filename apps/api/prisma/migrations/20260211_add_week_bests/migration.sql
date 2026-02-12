-- Add week type enum and column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WeekType') THEN
    CREATE TYPE "WeekType" AS ENUM ('HARD', 'DELOAD');
  END IF;
END $$;

ALTER TABLE "weeks"
  ADD COLUMN IF NOT EXISTS "week_type" "WeekType" NOT NULL DEFAULT 'HARD';

UPDATE "weeks"
SET "week_type" = (CASE WHEN "is_deload" THEN 'DELOAD' ELSE 'HARD' END)::"WeekType";

-- Weekly bests per exercise
CREATE TABLE IF NOT EXISTS "exercise_week_bests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "exercise_id" UUID NOT NULL,
  "week_id" UUID NOT NULL,
  "best_set_weight" DOUBLE PRECISION NOT NULL,
  "best_set_reps" INTEGER NOT NULL,
  "best_set_e1rm" DOUBLE PRECISION NOT NULL,
  "best_set_id" UUID,
  "computed_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "exercise_week_bests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exercise_week_bests_unique" UNIQUE ("user_id", "exercise_id", "week_id"),
  CONSTRAINT "exercise_week_bests_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "exercise_week_bests_exercise_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE,
  CONSTRAINT "exercise_week_bests_week_fkey" FOREIGN KEY ("week_id") REFERENCES "weeks"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "exercise_week_bests_user_exercise_idx"
  ON "exercise_week_bests" ("user_id", "exercise_id");

CREATE INDEX IF NOT EXISTS "exercise_week_bests_week_idx"
  ON "exercise_week_bests" ("week_id");

-- Snapshot of last hard-week best per exercise
CREATE TABLE IF NOT EXISTS "exercise_last_hard_bests" (
  "user_id" UUID NOT NULL,
  "exercise_id" UUID NOT NULL,
  "source_week_id" UUID,
  "best_set_weight" DOUBLE PRECISION NOT NULL,
  "best_set_reps" INTEGER NOT NULL,
  "best_set_e1rm" DOUBLE PRECISION NOT NULL,
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "exercise_last_hard_bests_pkey" PRIMARY KEY ("user_id", "exercise_id"),
  CONSTRAINT "exercise_last_hard_bests_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "exercise_last_hard_bests_exercise_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "exercise_last_hard_bests_user_idx"
  ON "exercise_last_hard_bests" ("user_id");
