// Run with: npm run test:offline (same runner)
import assert from "node:assert/strict";
import test from "node:test";
import {
  createActionForScreen,
  hashForScreen,
  MOBILE_SCREENS,
  screenForSection,
  screenFromHash,
  SECTION_SCREEN,
} from "./mobile-screens";

test("every dashboard section belongs to a screen", () => {
  for (const id of ["overview", "dailyControls", "routine", "board", "affirmation", "bilan", "notes", "reminders", "gaming"]) {
    assert.ok(screenForSection(id), `${id} has no screen`);
  }
  assert.equal(screenForSection("board"), "tasks");
  assert.equal(screenForSection("weeklyReview"), "journal");
  assert.equal(screenForSection("reminders"), "notes");
  assert.equal(screenForSection("unknown"), null);
});

test("every screen except More has at least one section", () => {
  const used = new Set(Object.values(SECTION_SCREEN));
  for (const screen of MOBILE_SCREENS) {
    assert.ok(used.has(screen), `${screen} is empty`);
  }
});

test("screen is read from the URL hash, including legacy section anchors", () => {
  assert.equal(screenFromHash("#tasks"), "tasks");
  assert.equal(screenFromHash("#journal"), "journal");
  assert.equal(screenFromHash("#board"), "tasks");
  assert.equal(screenFromHash("#notes"), "notes");
  assert.equal(screenFromHash(""), "today");
  assert.equal(screenFromHash("#nonsense"), "today");
  assert.equal(hashForScreen("more"), "#more");
});

test("the + button creates what fits the screen", () => {
  assert.equal(createActionForScreen("today"), "task");
  assert.equal(createActionForScreen("tasks"), "task");
  assert.equal(createActionForScreen("notes"), "noteOrReminder");
  assert.equal(createActionForScreen("journal"), null);
  assert.equal(createActionForScreen("more"), null);
});
