import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as PrismaClientModule from '../src/generated/prisma/index.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set.');
}

const adapter = new PrismaPg({ connectionString });
const PrismaClientCtor =
  (PrismaClientModule as any).PrismaClient ??
  (PrismaClientModule as any).default?.PrismaClient;

if (!PrismaClientCtor) {
  throw new Error('PrismaClient export not found in generated client');
}

const prisma = new PrismaClientCtor({ adapter });

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
  'trapezi',
  'adduttori',
  'lombari',
  'full_body',
  'condizionamento',
];

const exercises = [
  { name: 'Back squat (high bar)', primary: 'quadricipiti', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Back squat (low bar)', primary: 'quadricipiti', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Front squat', primary: 'quadricipiti', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Box squat', primary: 'quadricipiti', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Pause squat', primary: 'quadricipiti', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Tempo squat', primary: 'quadricipiti', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Zercher squat', primary: 'quadricipiti', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Overhead squat', primary: 'quadricipiti', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Stacco da terra (convenzionale)', primary: 'femorali', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Stacco da terra (sumo)', primary: 'femorali', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Stacco con pausa', primary: 'femorali', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Stacco dai blocchi / Rack pull', primary: 'dorso', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Stacco rumeno (RDL)', primary: 'femorali', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Good morning', primary: 'femorali', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Hip thrust bilanciere', primary: 'glutei', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Glute bridge bilanciere', primary: 'glutei', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Split squat bilanciere', primary: 'quadricipiti', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Bulgarian split squat bilanciere', primary: 'quadricipiti', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Affondi in camminata bilanciere', primary: 'quadricipiti', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Panca piana bilanciere', primary: 'petto', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Panca inclinata bilanciere', primary: 'petto', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Panca declinata bilanciere', primary: 'petto', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Close grip bench press', primary: 'tricipiti', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Spoto press / Pause bench', primary: 'petto', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Military press / Overhead press', primary: 'spalle', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Push press', primary: 'spalle', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Behind-the-neck press', primary: 'spalle', toolType: 'BARBELL', progressionTag: 'DB_STD' },
  { name: 'Rematore bilanciere (classico)', primary: 'dorso', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Pendlay row', primary: 'dorso', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Yates row', primary: 'dorso', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Seal row (bilanciere)', primary: 'dorso', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Curl bilanciere', primary: 'bicipiti', toolType: 'BARBELL', progressionTag: 'DB_STD' },
  { name: 'Curl EZ (bilanciere)', primary: 'bicipiti', toolType: 'BARBELL', progressionTag: 'DB_STD' },
  { name: 'Drag curl', primary: 'bicipiti', toolType: 'BARBELL', progressionTag: 'DB_STD' },
  { name: 'Skull crusher / French press bilanciere/EZ', primary: 'tricipiti', toolType: 'BARBELL', progressionTag: 'DB_STD' },
  { name: 'JM press', primary: 'tricipiti', toolType: 'BARBELL', progressionTag: 'DB_STD' },
  { name: 'Power clean / Hang clean', primary: 'full_body', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Snatch / Hang snatch', primary: 'full_body', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'High pull', primary: 'full_body', toolType: 'BARBELL', progressionTag: 'BB_STD' },
  { name: 'Goblet squat', primary: 'quadricipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Front squat con manubri', primary: 'quadricipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Affondi in camminata (manubri)', primary: 'quadricipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Reverse lunge (manubri)', primary: 'quadricipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Lateral lunge (manubri)', primary: 'quadricipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Bulgarian split squat (manubri)', primary: 'quadricipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Step-up (manubri)', primary: 'quadricipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Stacco rumeno con manubri', primary: 'femorali', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Single-leg RDL (manubri)', primary: 'femorali', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Hip thrust con manubrio', primary: 'glutei', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Glute bridge con manubrio', primary: 'glutei', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Distensioni manubri panca piana', primary: 'petto', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Distensioni manubri panca inclinata', primary: 'petto', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Distensioni manubri panca declinata', primary: 'petto', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Squeeze press (manubri)', primary: 'petto', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Floor press (manubri)', primary: 'petto', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Croci manubri (panca piana)', primary: 'petto', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Croci manubri (panca inclinata)', primary: 'petto', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Shoulder press manubri', primary: 'spalle', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Arnold press', primary: 'spalle', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Alzate laterali', primary: 'spalle', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Alzate frontali', primary: 'spalle', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Rear delt fly (manubri)', primary: 'spalle', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Cuban rotation / Extrarotazioni manubri', primary: 'spalle', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Rematore 1 manubrio', primary: 'dorso', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Rematore 2 manubri', primary: 'dorso', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Chest-supported row (manubri)', primary: 'dorso', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Pullover con manubrio', primary: 'dorso', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Shrug (manubri)', primary: 'trapezi', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Curl alternato manubri', primary: 'bicipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Hammer curl', primary: 'bicipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Concentration curl', primary: 'bicipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Incline curl', primary: 'bicipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Spider curl', primary: 'bicipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Zottman curl', primary: 'bicipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'French press manubri', primary: 'tricipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Overhead triceps extension (manubri)', primary: 'tricipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Triceps kickback', primary: 'tricipiti', toolType: 'DUMBBELL', progressionTag: 'DB_STD' },
  { name: 'Farmer walk', primary: 'full_body', toolType: 'DUMBBELL', progressionTag: 'BB_STD' },
  { name: 'Suitcase carry', primary: 'full_body', toolType: 'DUMBBELL', progressionTag: 'BB_STD' },
  { name: 'Overhead carry', primary: 'full_body', toolType: 'DUMBBELL', progressionTag: 'BB_STD' },
  { name: 'Leg press', primary: 'quadricipiti', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Hack squat', primary: 'quadricipiti', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Pendulum squat', primary: 'quadricipiti', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Smith squat', primary: 'quadricipiti', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Smith lunge', primary: 'quadricipiti', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Leg extension', primary: 'quadricipiti', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Leg curl (lying)', primary: 'femorali', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Leg curl (seated)', primary: 'femorali', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Leg curl (standing)', primary: 'femorali', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Calf raise (standing machine)', primary: 'polpacci', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Calf raise (seated machine)', primary: 'polpacci', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Abductor machine', primary: 'glutei', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Adductor machine', primary: 'adduttori', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Glute kickback machine', primary: 'glutei', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Chest press machine (flat)', primary: 'petto', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Chest press machine (incline)', primary: 'petto', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Pec deck / Chest fly machine', primary: 'petto', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Cable fly (alto-basso)', primary: 'petto', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Cable fly (basso-alto)', primary: 'petto', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Cable fly (orizzontale)', primary: 'petto', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Shoulder press machine', primary: 'spalle', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Lateral raise machine', primary: 'spalle', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Reverse pec deck (rear delts)', primary: 'spalle', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Cable lateral raise (singolo)', primary: 'spalle', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Lat machine', primary: 'dorso', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Lat machine (presa stretta/neutral)', primary: 'dorso', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Lat machine single hand', primary: 'dorso', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Pulldown (vari attacchi)', primary: 'dorso', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Seated row machine', primary: 'dorso', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'High row machine', primary: 'dorso', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Chest-supported row machine', primary: 'dorso', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Cable row (bassa)', primary: 'dorso', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Cable row (alta)', primary: 'dorso', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Pullover machine', primary: 'dorso', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Straight-arm pulldown (cavo)', primary: 'dorso', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Face pull (cavo)', primary: 'spalle', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Pullover lat machine', primary: 'dorso', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Curl machine', primary: 'bicipiti', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Cable curl (barra)', primary: 'bicipiti', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Cable curl (corda)', primary: 'bicipiti', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Pushdown (corda)', primary: 'tricipiti', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Pushdown (barra/V-bar)', primary: 'tricipiti', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Overhead cable extension', primary: 'tricipiti', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Dip machine (assistita)', primary: 'tricipiti', toolType: 'MACHINE', progressionTag: 'MACH_STD' },
  { name: 'Cable crunch', primary: 'addome', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Ab crunch machine', primary: 'addome', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Rotary torso machine', primary: 'addome', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Back extension machine', primary: 'lombari', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Pallof press (cavo)', primary: 'addome', toolType: 'MACHINE', progressionTag: 'DB_STD' },
  { name: 'Push-up (varianti)', primary: 'petto', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Dip (parallele)', primary: 'tricipiti', toolType: 'BODYWEIGHT', progressionTag: 'BB_STD' },
  { name: 'Pike push-up / Handstand push-up', primary: 'spalle', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Pull-up / Chin-up', primary: 'dorso', toolType: 'BODYWEIGHT', progressionTag: 'BB_STD' },
  { name: 'Inverted row / Australian pull-up', primary: 'dorso', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Scapular pull-up', primary: 'dorso', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Squat a corpo libero', primary: 'quadricipiti', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Jump squat', primary: 'quadricipiti', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Pistol squat (progressioni)', primary: 'quadricipiti', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Shrimp squat', primary: 'quadricipiti', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Affondi (forward)', primary: 'quadricipiti', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Affondi (reverse)', primary: 'quadricipiti', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Affondi (lateral)', primary: 'quadricipiti', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Bulgarian split squat (BW)', primary: 'quadricipiti', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Step-up (BW)', primary: 'quadricipiti', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Hip thrust (BW)', primary: 'glutei', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Glute bridge (BW)', primary: 'glutei', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Nordic curl', primary: 'femorali', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Calf raise (BW)', primary: 'polpacci', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Plank', primary: 'addome', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Side plank', primary: 'addome', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Dead bug', primary: 'addome', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Hollow hold / Hollow rocks', primary: 'addome', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Leg raise (a terra)', primary: 'addome', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Leg raise (appeso)', primary: 'addome', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Crunch', primary: 'addome', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Reverse crunch', primary: 'addome', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Bicycle crunch', primary: 'addome', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Mountain climber', primary: 'addome', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Russian twist', primary: 'addome', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Superman / Back extension a terra', primary: 'lombari', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Burpees', primary: 'condizionamento', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Bear crawl', primary: 'condizionamento', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Sprint / Stairs', primary: 'condizionamento', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
  { name: 'Jump rope', primary: 'condizionamento', toolType: 'BODYWEIGHT', progressionTag: 'DB_STD' },
];

const weightedBodyweightExercises = new Set([
  'Dip (parallele)',
  'Pull-up / Chin-up',
]);

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

    const resistanceMode =
      exercise.toolType !== 'BODYWEIGHT'
        ? 'LOAD_AND_REPS'
        : weightedBodyweightExercises.has(exercise.name)
          ? 'BODYWEIGHT_OPTIONAL_LOAD'
          : 'REPS_ONLY';

    await prisma.exercise.upsert({
      where: {
        name_toolType: {
          name: exercise.name,
          toolType: exercise.toolType,
        },
      },
      update: {
        primaryMuscleGroupId,
        progressionTag: exercise.progressionTag,
        resistanceMode,
      },
      create: {
        name: exercise.name,
        toolType: exercise.toolType,
        progressionTag: exercise.progressionTag,
        resistanceMode,
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

