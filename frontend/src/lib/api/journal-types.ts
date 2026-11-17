export type DayAffirmation = {
  id: string;
  targetDate: string;
  text: string;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DayAffirmationInput = { date: string; text: string; isCompleted: boolean };

export type DayBilan = {
  id: string;
  targetDate: string;
  mood: number | null;
  wins: string | null;
  blockers: string | null;
  lessonsLearned: string | null;
  tomorrowTop3: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DayBilanMutationInput = {
  date: string;
  mood: number | null;
  wins: string | null;
  blockers: string | null;
  lessonsLearned: string | null;
  tomorrowTop3: string | null;
};

export type WeeklyEntry = {
  id: string;
  year: number;
  isoWeek: number;
  objective: string | null;
  review: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WeeklyEntryInput = { year: number; week: number; objective?: string | null; review?: string | null };

export type MonthlyEntry = {
  id: string;
  year: number;
  month: number;
  objective: string | null;
  review: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyEntryInput = { year: number; month: number; objective?: string | null; review?: string | null };
