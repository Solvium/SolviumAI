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

  // Create default tasks (one-time seed)
  const tasks = [
    {
      name: "First Game Reward",
      points: 50,
      link: null as any,
      isCompleted: false,
    },
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
      points: 100,
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
    {
      name: "Like our pinned post",
      points: 75,
      link: "https://x.com/solvium",
      isCompleted: false,
    },
    {
      name: "Retweet the latest update",
      points: 80,
      link: "https://x.com/solvium",
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
