import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ToolType } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set.');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const muscleGroups = [
  'petto',
  'dorso',
  'spalle',
  'quadricipiti',
  'femorali',
  'glutei',
  'bicipiti',
  'tricipiti',
  'polpacci',
  'addome',
];

const exercises = [
  { name: 'Panca piana', toolType: ToolType.BARBELL, primary: 'petto' },
  { name: 'Distensioni manubri panca inclinata', toolType: ToolType.DUMBBELL, primary: 'petto' },
  { name: 'Panca inclinata', toolType: ToolType.BARBELL, primary: 'petto' },
  { name: 'Pec Flyes', toolType: ToolType.DUMBBELL, primary: 'petto' },
  { name: 'Lat machine', toolType: ToolType.MACHINE, primary: 'dorso' },
  // Kept as DUMBBELL to enforce dumbbell progression ranges.
  { name: 'Lat machine single hand', toolType: ToolType.DUMBBELL, primary: 'dorso' },
  // Kept as DUMBBELL to enforce dumbbell progression ranges.
  { name: 'Pullover lat machine', toolType: ToolType.DUMBBELL, primary: 'dorso' },
  { name: 'Rematore bilanciere', toolType: ToolType.BARBELL, primary: 'dorso' },
  { name: 'Rematore con manubri', toolType: ToolType.DUMBBELL, primary: 'dorso' },
  { name: 'Military press', toolType: ToolType.BARBELL, primary: 'spalle' },
  { name: 'Distensioni manubri (spalle)', toolType: ToolType.DUMBBELL, primary: 'spalle' },
  { name: 'Alzate laterali', toolType: ToolType.DUMBBELL, primary: 'spalle' },
  { name: 'Squat', toolType: ToolType.BARBELL, primary: 'quadricipiti' },
  { name: 'Squat single leg', toolType: ToolType.BARBELL, primary: 'quadricipiti' },
  { name: 'Lunges', toolType: ToolType.DUMBBELL, primary: 'quadricipiti' },
  { name: 'Leg press', toolType: ToolType.MACHINE, primary: 'quadricipiti' },
  { name: 'Stacco rumeno', toolType: ToolType.BARBELL, primary: 'femorali' },
  { name: 'Stacco rumeno con manubri', toolType: ToolType.DUMBBELL, primary: 'femorali' },
  { name: 'Leg curl', toolType: ToolType.MACHINE, primary: 'femorali' },
  { name: 'Hip thrust', toolType: ToolType.BARBELL, primary: 'glutei' },
  { name: 'Curl manubri', toolType: ToolType.DUMBBELL, primary: 'bicipiti' },
  { name: 'Hammer curl', toolType: ToolType.DUMBBELL, primary: 'bicipiti' },
  { name: 'Spider curl', toolType: ToolType.DUMBBELL, primary: 'bicipiti' },
  { name: 'Curl bilanciere', toolType: ToolType.BARBELL, primary: 'bicipiti' },
  { name: 'French press con manubri', toolType: ToolType.DUMBBELL, primary: 'tricipiti' },
  { name: 'Pushdown cavo', toolType: ToolType.MACHINE, primary: 'tricipiti' },
  { name: 'Calf raise', toolType: ToolType.MACHINE, primary: 'polpacci' },
  { name: 'Crunch cavo', toolType: ToolType.MACHINE, primary: 'addome' },
];

async function main() {
  const muscleGroupRecords = await Promise.all(
    muscleGroups.map((name) =>
      prisma.muscleGroup.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  const muscleGroupByName = new Map(
    muscleGroupRecords.map((muscleGroup) => [muscleGroup.name, muscleGroup.id]),
  );

  for (const exercise of exercises) {
    const primaryMuscleGroupId = muscleGroupByName.get(exercise.primary);
    if (!primaryMuscleGroupId) {
      throw new Error(`Missing muscle group for exercise: ${exercise.name}`);
    }

    await prisma.exercise.upsert({
      where: {
        name_toolType: {
          name: exercise.name,
          toolType: exercise.toolType,
        },
      },
      update: {
        primaryMuscleGroupId,
      },
      create: {
        name: exercise.name,
        toolType: exercise.toolType,
        primaryMuscleGroupId,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
