import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create level configuration
  const levelConfigs = [
    { level: 1, points_required: 0, rewards: { title: "Beginner" } },
    { level: 2, points_required: 1000, rewards: { title: "Explorer" } },
    { level: 3, points_required: 2500, rewards: { title: "Adventurer" } },
    { level: 4, points_required: 5000, rewards: { title: "Champion" } },
    { level: 5, points_required: 10000, rewards: { title: "Master" } },
    { level: 6, points_required: 20000, rewards: { title: "Legend" } },
  ];

  for (const config of levelConfigs) {
    await prisma.levelConfig.upsert({
      where: { level: config.level },
      update: {},
      create: config,
    });
  }

  // Create default tasks
  const tasks = [
    {
      name: "Join Solvium Telegram Group",
      points: 50,
      link: "https://t.me/solvium_group",
      isCompleted: false,
    },
    {
      name: "Join Solvium Chat",
      points: 30,
      link: "https://t.me/solvium_chat",
      isCompleted: false,
    },
    {
      name: "Follow X",
      points: 25,
      link: "https://x.com/solvium",
      isCompleted: false,
    },
    {
      name: "Follow Facebook",
      points: 20,
      link: "https://facebook.com/solvium",
      isCompleted: false,
    },
    {
      name: "Subscribe to Youtube",
      points: 35,
      link: "https://youtube.com/@solvium",
      isCompleted: false,
    },
    {
      name: "Connect Wallet",
      points: 100,
      link: "",
      isCompleted: false,
    },
  ];

  for (const task of tasks) {
    const result = await prisma.task.upsert({
      where: { name: task.name },
      update: {},
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
