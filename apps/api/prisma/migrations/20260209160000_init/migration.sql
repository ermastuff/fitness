-- Initial schema for Fitness Forge

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "MesocycleStructure" AS ENUM ('THREE_ONE', 'FOUR_ONE', 'FIVE_ONE');
CREATE TYPE "ToolType" AS ENUM ('DUMBBELL', 'BARBELL', 'MACHINE');
CREATE TYPE "SessionExerciseMode" AS ENUM ('AUTO', 'LOCK_LOAD', 'LOCK_REPS');
CREATE TYPE "ProgressionEntityType" AS ENUM ('EXERCISE', 'MUSCLE_GROUP_SESSION');
CREATE TYPE "RecordSource" AS ENUM ('USER', 'SEED', 'TEST');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit_kg" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

CREATE TABLE "muscle_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  CONSTRAINT "muscle_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "muscle_groups_name_key" ON "muscle_groups"("name");

CREATE TABLE "mesocycles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "structure" "MesocycleStructure" NOT NULL,
  "weeks_total" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" "RecordSource" NOT NULL DEFAULT 'USER',
  CONSTRAINT "mesocycles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mesocycles_user_id_idx" ON "mesocycles"("user_id");
CREATE INDEX "mesocycles_active_idx" ON "mesocycles"("active");
CREATE INDEX "mesocycles_user_id_active_idx" ON "mesocycles"("user_id", "active");

CREATE TABLE "weeks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "mesocycle_id" UUID NOT NULL,
  "week_index" INTEGER NOT NULL,
  "is_deload" BOOLEAN NOT NULL,
  "rir_target" INTEGER NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "weeks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "weeks_mesocycle_id_idx" ON "weeks"("mesocycle_id");
CREATE INDEX "weeks_mesocycle_id_week_index_idx" ON "weeks"("mesocycle_id", "week_index");

CREATE TABLE "sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "mesocycle_id" UUID NOT NULL,
  "week_id" UUID NOT NULL,
  "day_of_week" INTEGER NOT NULL,
  "session_name" TEXT NOT NULL,
  "session_order_in_week" INTEGER NOT NULL,
  "scheduled_date" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "source" "RecordSource" NOT NULL DEFAULT 'USER',
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sessions_mesocycle_id_idx" ON "sessions"("mesocycle_id");
CREATE INDEX "sessions_week_id_idx" ON "sessions"("week_id");
CREATE INDEX "sessions_week_id_day_of_week_idx" ON "sessions"("week_id", "day_of_week");
CREATE INDEX "sessions_week_id_session_order_in_week_idx" ON "sessions"("week_id", "session_order_in_week");
CREATE INDEX "sessions_scheduled_date_idx" ON "sessions"("scheduled_date");

CREATE TABLE "exercises" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "tool_type" "ToolType" NOT NULL,
  "primary_muscle_group_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exercises_name_tool_type_key" ON "exercises"("name", "tool_type");
CREATE INDEX "exercises_primary_muscle_group_id_idx" ON "exercises"("primary_muscle_group_id");
CREATE INDEX "exercises_name_idx" ON "exercises"("name");

CREATE TABLE "session_exercises" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "exercise_id" UUID NOT NULL,
  "order_index" INTEGER NOT NULL,
  "sets_target" INTEGER NOT NULL,
  "mode" "SessionExerciseMode" NOT NULL,
  "load_target" DOUBLE PRECISION,
  "reps_target_hint" INTEGER,
  CONSTRAINT "session_exercises_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "session_exercises_session_id_order_index_key" ON "session_exercises"("session_id", "order_index");
CREATE INDEX "session_exercises_session_id_idx" ON "session_exercises"("session_id");
CREATE INDEX "session_exercises_exercise_id_idx" ON "session_exercises"("exercise_id");
CREATE INDEX "session_exercises_session_id_exercise_id_idx" ON "session_exercises"("session_id", "exercise_id");

CREATE TABLE "workout_sets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_exercise_id" UUID NOT NULL,
  "set_index" INTEGER NOT NULL,
  "load_used" DOUBLE PRECISION,
  "reps_done" INTEGER,
  CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workout_sets_session_exercise_id_set_index_key" ON "workout_sets"("session_exercise_id", "set_index");
CREATE INDEX "workout_sets_session_exercise_id_idx" ON "workout_sets"("session_exercise_id");

CREATE TABLE "exercise_results" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_exercise_id" UUID NOT NULL,
  "rir_last_set" INTEGER,
  "reps_ref" INTEGER,
  "notes" TEXT,
  CONSTRAINT "exercise_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exercise_results_session_exercise_id_key" ON "exercise_results"("session_exercise_id");

CREATE TABLE "session_muscle_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "muscle_group_id" UUID NOT NULL,
  "jl" INTEGER NOT NULL,
  "doms" INTEGER NOT NULL,
  "pump" INTEGER NOT NULL,
  "fat" INTEGER NOT NULL,
  "perf" INTEGER NOT NULL,
  "delta_sets" INTEGER NOT NULL,
  "sets_target_session" INTEGER NOT NULL,
  CONSTRAINT "session_muscle_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "session_muscle_groups_session_id_muscle_group_id_key" ON "session_muscle_groups"("session_id", "muscle_group_id");
CREATE INDEX "session_muscle_groups_session_id_idx" ON "session_muscle_groups"("session_id");
CREATE INDEX "session_muscle_groups_muscle_group_id_idx" ON "session_muscle_groups"("muscle_group_id");

CREATE TABLE "progression_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "mesocycle_id" UUID NOT NULL,
  "week_id" UUID NOT NULL,
  "session_id" UUID,
  "entity_type" "ProgressionEntityType" NOT NULL,
  "entity_id" TEXT NOT NULL,
  "prev_value" JSONB NOT NULL,
  "new_value" JSONB NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" "RecordSource" NOT NULL DEFAULT 'USER',
  CONSTRAINT "progression_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "progression_logs_user_id_idx" ON "progression_logs"("user_id");
CREATE INDEX "progression_logs_mesocycle_id_idx" ON "progression_logs"("mesocycle_id");
CREATE INDEX "progression_logs_week_id_idx" ON "progression_logs"("week_id");
CREATE INDEX "progression_logs_session_id_idx" ON "progression_logs"("session_id");
CREATE INDEX "progression_logs_entity_type_idx" ON "progression_logs"("entity_type");
CREATE INDEX "progression_logs_entity_type_entity_id_idx" ON "progression_logs"("entity_type", "entity_id");
CREATE INDEX "progression_logs_created_at_idx" ON "progression_logs"("created_at");
CREATE INDEX "progression_logs_user_id_created_at_idx" ON "progression_logs"("user_id", "created_at");

ALTER TABLE "mesocycles" ADD CONSTRAINT "mesocycles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "weeks" ADD CONSTRAINT "weeks_mesocycle_id_fkey"
  FOREIGN KEY ("mesocycle_id") REFERENCES "mesocycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_mesocycle_id_fkey"
  FOREIGN KEY ("mesocycle_id") REFERENCES "mesocycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_week_id_fkey"
  FOREIGN KEY ("week_id") REFERENCES "weeks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exercises" ADD CONSTRAINT "exercises_primary_muscle_group_id_fkey"
  FOREIGN KEY ("primary_muscle_group_id") REFERENCES "muscle_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_exercise_id_fkey"
  FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_session_exercise_id_fkey"
  FOREIGN KEY ("session_exercise_id") REFERENCES "session_exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exercise_results" ADD CONSTRAINT "exercise_results_session_exercise_id_fkey"
  FOREIGN KEY ("session_exercise_id") REFERENCES "session_exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "session_muscle_groups" ADD CONSTRAINT "session_muscle_groups_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "session_muscle_groups" ADD CONSTRAINT "session_muscle_groups_muscle_group_id_fkey"
  FOREIGN KEY ("muscle_group_id") REFERENCES "muscle_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "progression_logs" ADD CONSTRAINT "progression_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "progression_logs" ADD CONSTRAINT "progression_logs_mesocycle_id_fkey"
  FOREIGN KEY ("mesocycle_id") REFERENCES "mesocycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "progression_logs" ADD CONSTRAINT "progression_logs_week_id_fkey"
  FOREIGN KEY ("week_id") REFERENCES "weeks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "progression_logs" ADD CONSTRAINT "progression_logs_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_day_of_week_check"
  CHECK ("day_of_week" >= 0 AND "day_of_week" <= 6);

ALTER TABLE "session_muscle_groups" ADD CONSTRAINT "session_muscle_groups_jl_check"
  CHECK ("jl" >= 1 AND "jl" <= 5);

ALTER TABLE "session_muscle_groups" ADD CONSTRAINT "session_muscle_groups_doms_check"
  CHECK ("doms" >= 1 AND "doms" <= 5);

ALTER TABLE "session_muscle_groups" ADD CONSTRAINT "session_muscle_groups_pump_check"
  CHECK ("pump" >= 1 AND "pump" <= 5);

ALTER TABLE "session_muscle_groups" ADD CONSTRAINT "session_muscle_groups_fat_check"
  CHECK ("fat" >= 1 AND "fat" <= 5);

ALTER TABLE "session_muscle_groups" ADD CONSTRAINT "session_muscle_groups_perf_check"
  CHECK ("perf" >= 1 AND "perf" <= 5);

ALTER TABLE "session_muscle_groups" ADD CONSTRAINT "session_muscle_groups_delta_sets_check"
  CHECK ("delta_sets" >= -2 AND "delta_sets" <= 1);
