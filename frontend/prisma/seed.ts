import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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

  console.log("Start seeding tasks...");

  for (const task of tasks) {
    const result = await prisma.task.upsert({
      where: { name: task.name },
      update: {},
      create: task,
    });
    console.log(`Created task: ${result.name} (${result.points} points)`);
  }

  console.log("Seeding finished.");
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
