-- Rename feedback fields
ALTER TABLE "session_muscle_groups"
  RENAME COLUMN "jl" TO "fatigue";

ALTER TABLE "session_muscle_groups"
  RENAME COLUMN "fat" TO "tendon_pain";

-- Auto volume smoothing state per mesocycle + muscle group
CREATE TABLE "muscle_group_auto_volume_states" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "mesocycle_id" UUID NOT NULL,
  "muscle_group_id" UUID NOT NULL,
  "last_delta_sign" INTEGER NOT NULL DEFAULT 0,
  "consecutive_count" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "muscle_group_auto_volume_states_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "muscle_group_auto_volume_states_unique" UNIQUE ("mesocycle_id", "muscle_group_id"),
  CONSTRAINT "muscle_group_auto_volume_states_delta_check" CHECK ("last_delta_sign" IN (-1, 0, 1)),
  CONSTRAINT "muscle_group_auto_volume_states_count_check" CHECK ("consecutive_count" >= 0),
  CONSTRAINT "muscle_group_auto_volume_states_mesocycle_fkey" FOREIGN KEY ("mesocycle_id") REFERENCES "mesocycles"("id") ON DELETE CASCADE,
  CONSTRAINT "muscle_group_auto_volume_states_muscle_group_fkey" FOREIGN KEY ("muscle_group_id") REFERENCES "muscle_groups"("id") ON DELETE CASCADE
);

CREATE INDEX "muscle_group_auto_volume_states_mesocycle_idx"
  ON "muscle_group_auto_volume_states" ("mesocycle_id");

CREATE INDEX "muscle_group_auto_volume_states_muscle_group_idx"
  ON "muscle_group_auto_volume_states" ("muscle_group_id");
