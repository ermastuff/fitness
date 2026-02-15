ALTER TYPE "ToolType" ADD VALUE IF NOT EXISTS 'BODYWEIGHT';

DO $$
BEGIN
  CREATE TYPE "ProgressionTag" AS ENUM ('DB_STD', 'BB_STD', 'MACH_STD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "exercises"
  ADD COLUMN IF NOT EXISTS "progression_tag" "ProgressionTag" NOT NULL DEFAULT 'DB_STD';

UPDATE "exercises"
SET "progression_tag" = CASE
  WHEN "tool_type" = 'BARBELL' THEN 'BB_STD'::"ProgressionTag"
  WHEN "tool_type" = 'MACHINE' THEN 'MACH_STD'::"ProgressionTag"
  ELSE 'DB_STD'::"ProgressionTag"
END
WHERE "progression_tag" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "exercises_progression_tag_idx"
  ON "exercises" ("progression_tag");
