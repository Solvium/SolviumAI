import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create level configuration
  const levelConfigs = [
    { level: 1, points_required: 0, rewards: { title: "Beginner" } },
    { level: 2, points_required: 200, rewards: { title: "Explorer" } },
    { level: 3, points_required: 500, rewards: { title: "Adventurer" } },
    { level: 4, points_required: 1000, rewards: { title: "Champion" } },
    { level: 5, points_required: 2000, rewards: { title: "Master" } },
    { level: 6, points_required: 3500, rewards: { title: "Legend" } },
    { level: 7, points_required: 5500, rewards: { title: "Hero" } },
    { level: 8, points_required: 8000, rewards: { title: "Guardian" } },
    { level: 9, points_required: 12000, rewards: { title: "Warrior" } },
    { level: 10, points_required: 17000, rewards: { title: "Elite" } },
    { level: 11, points_required: 23000, rewards: { title: "Expert" } },
    { level: 12, points_required: 30000, rewards: { title: "Specialist" } },
    { level: 13, points_required: 38000, rewards: { title: "Professional" } },
    { level: 14, points_required: 47000, rewards: { title: "Veteran" } },
    { level: 15, points_required: 57000, rewards: { title: "Commander" } },
    { level: 16, points_required: 68000, rewards: { title: "General" } },
    { level: 17, points_required: 80000, rewards: { title: "Supreme" } },
    { level: 18, points_required: 93000, rewards: { title: "Ultimate" } },
    { level: 19, points_required: 107000, rewards: { title: "Transcendent" } },
    { level: 20, points_required: 122000, rewards: { title: "Immortal" } },
  ];

  for (const config of levelConfigs) {
    await prisma.levelConfig.upsert({
      where: { level: config.level },
      update: {},
      create: config,
    });
  }

  // Create default tasks (aligned with provided social links)
  // 1) Remove all existing social tasks (tasks with a non-null link)
  const existingSocialTasks = await prisma.task.findMany({
    where: { NOT: { link: null as any } },
    select: { id: true },
  });

  if (existingSocialTasks.length > 0) {
    const socialTaskIds = existingSocialTasks.map((t) => t.id);
    // Remove user-task relations first to avoid FK issues
    await prisma.userTask.deleteMany({
      where: { taskId: { in: socialTaskIds } },
    });
    // Now remove the tasks
    await prisma.task.deleteMany({ where: { id: { in: socialTaskIds } } });
  }

  // 2) Create the canonical set of tasks
  const tasks = [
    {
      name: "First Game Reward",
      points: 50,
      link: null as any,
      isCompleted: false,
    },
    {
      name: "Subscribe to YouTube",
      points: 10,
      link: "https://www.youtube.com/@solvium_puzzle",
      isCompleted: false,
    },
    {
      name: "Follow X",
      points: 10,
      link: "https://x.com/Solvium_game",
      isCompleted: false,
    },
    {
      name: "Join Solvium Telegram Group",
      points: 10,
      link: "https://t.me/solvium_puzzle",
      isCompleted: false,
    },
    {
      name: "Join Announcement Channel",
      points: 10,
      link: "https://t.me/solviumupdate",
      isCompleted: false,
    },
    {
      name: "Follow Facebook",
      points: 10,
      link: "https://www.facebook.com/profile.php?id=61566560151625&mibextid=LQQJ4d",
      isCompleted: false,
    },
  ];

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { name: task.name },
      update: { points: task.points, link: task.link },
      create: task,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
