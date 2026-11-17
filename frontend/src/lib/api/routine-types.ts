export type RoutineChallenge = "normal" | "bonus";

export type RoutineTemplate = {
  id: string;
  challenge: RoutineChallenge;
  startTime: string | null;
  endTime: string | null;
  title: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RoutineCompletion = {
  id: string;
  routineId: string;
  targetDate: string;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RoutineMonthlySummary = {
  month: string;
  days: string[];
  routines: RoutineTemplate[];
  completions: RoutineCompletion[];
  dailyPercentages: Array<{ date: string; percentage: number }>;
  monthPercentage: number;
};

export type RoutineFormValues = {
  challenge: RoutineChallenge;
  startTime: string;
  endTime: string;
  title: string;
};

/** Body sent to POST / PATCH /routines. */
export type RoutineInput = {
  challenge: RoutineChallenge;
  startTime: string | null;
  endTime: string | null;
  title: string;
};

export type RoutineCompletionInput = { routineId: string; targetDate: string; isCompleted: boolean };
