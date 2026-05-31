import { Prisma, PrismaClient } from "@prisma/client";

export type RoutineChallenge = "normal" | "bonus";

export type RoutineTemplateRecord = {
  id: string;
  userId: string;
  challenge: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type RoutineCompletionRecord = {
  id: string;
  userId: string;
  routineId: string;
  targetDate: Date;
  isCompleted: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RoutineCreateInput = {
  userId: string;
  challenge: RoutineChallenge;
  startTime?: string | null;
  endTime?: string | null;
  title: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type RoutineUpdateInput = {
  challenge?: RoutineChallenge;
  startTime?: string | null;
  endTime?: string | null;
  title?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type RoutineCompletionUpsertInput = {
  userId: string;
  routineId: string;
  targetDate: Date;
  isCompleted: boolean;
};

export type RoutineStore = {
  ensureDefaults(userId: string): Promise<void>;
  listTemplates(userId: string, includeInactive?: boolean): Promise<RoutineTemplateRecord[]>;
  getTemplate(id: string, userId: string): Promise<RoutineTemplateRecord | null>;
  createTemplate(input: RoutineCreateInput): Promise<RoutineTemplateRecord>;
  updateTemplate(id: string, userId: string, input: RoutineUpdateInput): Promise<RoutineTemplateRecord | null>;
  removeTemplate(id: string, userId: string): Promise<RoutineTemplateRecord | null>;
  listCompletionsForRange(userId: string, startDate: Date, endExclusive: Date): Promise<RoutineCompletionRecord[]>;
  upsertCompletion(input: RoutineCompletionUpsertInput): Promise<RoutineCompletionRecord | null>;
  close?: () => Promise<void>;
};

type DefaultRoutineInput = Omit<RoutineCreateInput, "userId" | "sortOrder"> & { sortOrder: number };

export const DEFAULT_CEO_ROUTINES: ReadonlyArray<DefaultRoutineInput> = [
  { challenge: "normal", startTime: "05:00", endTime: null, title: "Réveil", sortOrder: 10 },
  {
    challenge: "normal",
    startTime: "05:00",
    endTime: "05:30",
    title: "Méditation · Affirmations · Visualisation (5 Étoiles)",
    sortOrder: 20,
  },
  { challenge: "normal", startTime: "05:30", endTime: "06:00", title: "Sport", sortOrder: 30 },
  { challenge: "normal", startTime: "06:00", endTime: "06:30", title: "Douche + préparation", sortOrder: 40 },
  { challenge: "normal", startTime: "06:30", endTime: "07:00", title: "Séance Okyome Mahikari", sortOrder: 50 },
  { challenge: "normal", startTime: "07:00", endTime: "17:00", title: "Mission client (facturation TJM)", sortOrder: 60 },
  {
    challenge: "normal",
    startTime: "17:00",
    endTime: "19:00",
    title: "Retour + veille IA / anglais (Audible) / prospection",
    sortOrder: 70,
  },
  {
    challenge: "normal",
    startTime: "19:30",
    endTime: "20:00",
    title: "Récupération enfant + transition famille",
    sortOrder: 80,
  },
  {
    challenge: "normal",
    startTime: "20:00",
    endTime: "21:00",
    title: "LinkedIn · Pipeline · Immo (actions soir)",
    sortOrder: 90,
  },
  {
    challenge: "normal",
    startTime: "21:00",
    endTime: "21:30",
    title: "Routine sommeil · Méditation · Bilan journée",
    sortOrder: 100,
  },
];

function templateOrderBy(): Prisma.RoutineTemplateOrderByWithRelationInput[] {
  return [{ sortOrder: "asc" }, { startTime: "asc" }, { createdAt: "asc" }];
}

export function createPrismaRoutineStore(prisma = new PrismaClient()): RoutineStore {
  return {
    async ensureDefaults(userId) {
      const existingCount = await prisma.routineTemplate.count({ where: { userId } });
      if (existingCount > 0) return;

      await prisma.routineTemplate.createMany({
        data: DEFAULT_CEO_ROUTINES.map((routine) => ({
          ...routine,
          userId,
          startTime: routine.startTime ?? null,
          endTime: routine.endTime ?? null,
          isActive: routine.isActive ?? true,
        })),
      });
    },

    async listTemplates(userId, includeInactive = false) {
      return prisma.routineTemplate.findMany({
        where: {
          userId,
          ...(includeInactive ? {} : { isActive: true }),
        },
        orderBy: templateOrderBy(),
      });
    },

    async getTemplate(id, userId) {
      return prisma.routineTemplate.findFirst({ where: { id, userId } });
    },

    async createTemplate(input) {
      const sortOrder =
        input.sortOrder ??
        ((await prisma.routineTemplate.aggregate({
          where: { userId: input.userId },
          _max: { sortOrder: true },
        }))._max.sortOrder ?? 0) + 10;

      return prisma.routineTemplate.create({
        data: {
          userId: input.userId,
          challenge: input.challenge,
          startTime: input.startTime ?? null,
          endTime: input.endTime ?? null,
          title: input.title,
          sortOrder,
          isActive: input.isActive ?? true,
        },
      });
    },

    async updateTemplate(id, userId, input) {
      const existing = await prisma.routineTemplate.findFirst({ where: { id, userId } });
      if (!existing) return null;

      return prisma.routineTemplate.update({
        where: { id },
        data: {
          ...(input.challenge !== undefined ? { challenge: input.challenge } : {}),
          ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
          ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    },

    async removeTemplate(id, userId) {
      const existing = await prisma.routineTemplate.findFirst({ where: { id, userId } });
      if (!existing) return null;

      return prisma.routineTemplate.update({
        where: { id },
        data: { isActive: false },
      });
    },

    async listCompletionsForRange(userId, startDate, endExclusive) {
      return prisma.routineCompletion.findMany({
        where: {
          userId,
          targetDate: {
            gte: startDate,
            lt: endExclusive,
          },
        },
        orderBy: [{ targetDate: "asc" }, { createdAt: "asc" }],
      });
    },

    async upsertCompletion(input) {
      const routine = await prisma.routineTemplate.findFirst({
        where: { id: input.routineId, userId: input.userId, isActive: true },
      });
      if (!routine) return null;

      const completedAt = input.isCompleted ? new Date() : null;
      return prisma.routineCompletion.upsert({
        where: {
          routineId_targetDate: {
            routineId: input.routineId,
            targetDate: input.targetDate,
          },
        },
        create: {
          userId: input.userId,
          routineId: input.routineId,
          targetDate: input.targetDate,
          isCompleted: input.isCompleted,
          completedAt,
        },
        update: {
          isCompleted: input.isCompleted,
          completedAt,
        },
      });
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
