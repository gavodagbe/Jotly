import assert from "node:assert/strict";
import test from "node:test";

import { shouldCreateOccurrence } from "./recurrence-service";

type RuleShape = {
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  interval: number;
  weekdays: number[];
  endsOn: Date | null;
};

function rule(partial: Partial<RuleShape>): RuleShape {
  return { frequency: "daily", interval: 1, weekdays: [], endsOn: null, ...partial };
}

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

test("daily recurrence fires on the interval and not between", () => {
  const start = d("2026-03-01");
  assert.equal(shouldCreateOccurrence(start, d("2026-03-01"), rule({})), false, "start day never repeats");
  assert.equal(shouldCreateOccurrence(start, d("2026-03-03"), rule({ interval: 2 })), true);
  assert.equal(shouldCreateOccurrence(start, d("2026-03-04"), rule({ interval: 2 })), false);
  assert.equal(shouldCreateOccurrence(start, d("2026-03-07"), rule({ interval: 2 })), true);
});

test("monthly recurrence keeps the source day and clamps to month end", () => {
  const start = d("2026-01-31");
  assert.equal(shouldCreateOccurrence(start, d("2026-02-28"), rule({ frequency: "monthly" })), true, "Jan 31 -> Feb 28");
  assert.equal(shouldCreateOccurrence(start, d("2026-02-27"), rule({ frequency: "monthly" })), false);
  assert.equal(shouldCreateOccurrence(start, d("2026-03-31"), rule({ frequency: "monthly" })), true);
  assert.equal(shouldCreateOccurrence(start, d("2026-04-30"), rule({ frequency: "monthly" })), true, "Apr has 30 days");
  assert.equal(
    shouldCreateOccurrence(start, d("2026-03-31"), rule({ frequency: "monthly", interval: 2 })),
    true,
    "every 2 months from January -> March"
  );
  assert.equal(
    shouldCreateOccurrence(start, d("2026-02-28"), rule({ frequency: "monthly", interval: 2 })),
    false
  );
});

test("quarterly recurrence fires only in calendar-quarter months", () => {
  const start = d("2026-02-10");
  const q = rule({ frequency: "quarterly" });
  assert.equal(shouldCreateOccurrence(start, d("2026-04-10"), q), true, "first occurrence starts next quarter");
  assert.equal(shouldCreateOccurrence(start, d("2026-07-10"), q), true);
  assert.equal(shouldCreateOccurrence(start, d("2026-10-10"), q), true);
  assert.equal(shouldCreateOccurrence(start, d("2027-01-10"), q), true);
  assert.equal(shouldCreateOccurrence(start, d("2026-05-10"), q), false, "May is not a quarter-start month");
  assert.equal(shouldCreateOccurrence(start, d("2026-04-11"), q), false, "wrong day of month");
});

test("quarterly recurrence honours the interval", () => {
  const start = d("2026-02-10");
  const everyTwoQuarters = rule({ frequency: "quarterly", interval: 2 });
  assert.equal(shouldCreateOccurrence(start, d("2026-04-10"), everyTwoQuarters), false);
  assert.equal(shouldCreateOccurrence(start, d("2026-07-10"), everyTwoQuarters), true);
  assert.equal(shouldCreateOccurrence(start, d("2026-10-10"), everyTwoQuarters), false);
  assert.equal(shouldCreateOccurrence(start, d("2027-01-10"), everyTwoQuarters), true);
});

test("quarterly recurrence clamps the day of month", () => {
  const start = d("2026-01-31");
  const q = rule({ frequency: "quarterly" });
  assert.equal(shouldCreateOccurrence(start, d("2026-04-30"), q), true, "Jan 31 -> Apr 30");
  assert.equal(shouldCreateOccurrence(start, d("2026-07-31"), q), true);
});

test("yearly recurrence fires on the anniversary and handles Feb 29", () => {
  const leapStart = d("2024-02-29");
  const yearly = rule({ frequency: "yearly" });
  assert.equal(shouldCreateOccurrence(leapStart, d("2025-02-28"), yearly), true, "Feb 29 -> Feb 28 in a common year");
  assert.equal(shouldCreateOccurrence(leapStart, d("2028-02-29"), yearly), true, "back to Feb 29 on the next leap year");
  assert.equal(shouldCreateOccurrence(leapStart, d("2025-03-01"), yearly), false);

  const start = d("2026-06-15");
  assert.equal(shouldCreateOccurrence(start, d("2027-06-15"), yearly), true);
  assert.equal(shouldCreateOccurrence(start, d("2026-06-15"), yearly), false, "same year never repeats");
  assert.equal(
    shouldCreateOccurrence(start, d("2027-06-15"), rule({ frequency: "yearly", interval: 2 })),
    false
  );
  assert.equal(
    shouldCreateOccurrence(start, d("2028-06-15"), rule({ frequency: "yearly", interval: 2 })),
    true
  );
});

test("endsOn stops every frequency", () => {
  const start = d("2026-01-10");
  assert.equal(
    shouldCreateOccurrence(start, d("2026-04-10"), rule({ frequency: "quarterly", endsOn: d("2026-03-31") })),
    false
  );
  assert.equal(
    shouldCreateOccurrence(start, d("2027-01-10"), rule({ frequency: "yearly", endsOn: d("2026-12-31") })),
    false
  );
});
