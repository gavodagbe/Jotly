import { PrismaClient, TaskPriority, TaskStatus } from "@prisma/client";

const prisma = new PrismaClient();

const seedTasks = [
  {
    id: "seed-task-1",
    title: "Plan weekly priorities",
    description: "Define the top three goals for the selected date.",
    status: TaskStatus.todo,
    targetDate: new Date("2026-03-06T00:00:00.000Z"),
    priority: TaskPriority.high,
    project: "Operations",
    plannedTime: 45,
    completedAt: null,
    cancelledAt: null
  },
  {
    id: "seed-task-2",
    title: "Implement API validation",
    description: "Add Zod validation for task payloads.",
    status: TaskStatus.in_progress,
    targetDate: new Date("2026-03-06T00:00:00.000Z"),
    priority: TaskPriority.medium,
    project: "Backend",
    plannedTime: 120,
    completedAt: null,
    cancelledAt: null
  },
  {
    id: "seed-task-3",
    title: "Review completed work",
    description: "Check tasks moved to done and capture outcomes.",
    status: TaskStatus.done,
    targetDate: new Date("2026-03-05T00:00:00.000Z"),
    priority: TaskPriority.low,
    project: null,
    plannedTime: 30,
    completedAt: new Date("2026-03-05T17:30:00.000Z"),
    cancelledAt: null
  },
  {
    id: "seed-task-4",
    title: "Archive outdated checklist",
    description: "Remove stale planning checklist from active board.",
    status: TaskStatus.cancelled,
    targetDate: new Date("2026-03-04T00:00:00.000Z"),
    priority: TaskPriority.low,
    project: null,
    plannedTime: null,
    completedAt: null,
    cancelledAt: new Date("2026-03-04T09:15:00.000Z")
  }
];

async function main() {
  for (const task of seedTasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      create: task,
      update: task
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
