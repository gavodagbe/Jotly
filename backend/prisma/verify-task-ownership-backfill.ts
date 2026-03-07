import "dotenv/config";
import { PrismaClient } from "@prisma/client";

type CountRow = {
  count: bigint;
};

type ExistsRow = {
  exists: boolean;
};

type TasksByUserRow = {
  userId: string;
  email: string | null;
  taskCount: bigint;
};

const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/jotly";

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
  process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
}

function toNumber(value: bigint): number {
  return Number(value);
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const [hasTaskOwnerColumn] = await prisma.$queryRaw<ExistsRow[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Task'
          AND column_name = 'userId'
      ) AS "exists"
    `;

    if (!hasTaskOwnerColumn?.exists) {
      console.error(
        'Verification failed: column "Task"."userId" is missing. Apply migrations before running this check.'
      );
      process.exitCode = 1;
      return;
    }

    const [totalTasksRow] = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Task"
    `;

    const [orphanedTasksRow] = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Task" t
      LEFT JOIN "User" u ON u.id = t."userId"
      WHERE u.id IS NULL
    `;

    const tasksByUserRows = await prisma.$queryRaw<TasksByUserRow[]>`
      SELECT
        t."userId" AS "userId",
        u.email AS email,
        COUNT(*)::bigint AS "taskCount"
      FROM "Task" t
      LEFT JOIN "User" u ON u.id = t."userId"
      GROUP BY t."userId", u.email
      ORDER BY COUNT(*) DESC, t."userId" ASC
    `;

    const summary = {
      totalTasks: toNumber(totalTasksRow?.count ?? 0n),
      orphanedTasks: toNumber(orphanedTasksRow?.count ?? 0n),
      tasksByUser: tasksByUserRows.map((row) => ({
        userId: row.userId,
        email: row.email,
        taskCount: toNumber(row.taskCount),
      })),
    };

    console.log("Task ownership verification summary:");
    console.log(JSON.stringify(summary, null, 2));

    if (summary.orphanedTasks > 0) {
      console.error("Verification failed: orphaned tasks were found.");
      process.exitCode = 1;
      return;
    }

    console.log("Verification passed: every task has a valid owner.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Task ownership verification failed to run:", error);
  process.exit(1);
});
