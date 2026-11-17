export type LinkedCalendarEvent = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  htmlLink: string | null;
};

export type Note = {
  id: string;
  title: string | null;
  body: string;
  color: string | null;
  targetDate: string | null;
  calendarEventId: string | null;
  linkedCalendarEvent: LinkedCalendarEvent | null;
  createdAt: string;
  updatedAt: string;
};

export type NoteInput = {
  title?: string | null;
  body: string;
  color?: string | null;
  targetDate?: string | null;
  calendarEventId?: string | null;
};

export type NotePatch = Partial<NoteInput>;
