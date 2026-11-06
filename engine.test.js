import assert from "node:assert/strict";
import test from "node:test";
import { DURATION, HOUR, reminderSlot, snapshot } from "./dist/engine.js";

const start = Date.parse("2026-11-06T00:00:00Z");
const session = {
  sessionId: "test", dischargeTimestamp: new Date(start).toISOString(),
  weightKg: 11.5, targetFluidPerIntervalMl: 150, status: "ACTIVE",
};
const event = (hour, type, details = {}) =>
  ({ sessionId: "test", timestamp: new Date(start + hour * HOUR).toISOString(), type, ...details });
const watery = hour => event(hour, "STOOL", { stoolType: "WATERY" });
const intake = (hour, fluidMlRetained) => event(hour, "INTAKE", { fluidMlRetained });
const check = (events, hour = 5) => snapshot(session, events, start + hour * HOUR);

test("four-hour totals exclude old, future, and unrelated events", () => {
  const result = check([intake(1, 500), intake(2, 100), watery(3),
    event(4, "STOOL", { stoolType: "FORMED" }), event(4, "VOMIT"), intake(5.1, 50),
    { ...intake(5, 100), sessionId: "other" }]);
  assert.equal(result.retained, 100);
  assert.equal(result.replacement, 138);
  assert.equal(result.target, 738);
});

test("three consecutive vomiting events must occur inside the rolling hour", () => {
  const vomit = hour => event(hour, "VOMIT");
  assert.equal(check([vomit(4.1), vomit(4.5), vomit(5)]).status, "REFERRED_TO_ER");
  assert.equal(check([vomit(4), vomit(4.5), vomit(5)]).status, "ACTIVE");
  assert.equal(check([vomit(4.1), intake(4.2, 50), vomit(4.5), vomit(5)]).status, "ACTIVE");
});

test("severe fluid loss requires more than four watery stools and under half of goal", () => {
  const stools = [2, 2.5, 3, 4, 5].map(watery);
  assert.equal(check(stools.slice(1)).status, "ACTIVE");
  assert.equal(check([...stools, intake(5, 587)]).status, "REFERRED_TO_ER");
  assert.equal(check([...stools, intake(5, 587.5)]).status, "ACTIVE");
});

test("missing and unknown urine entries differ from a negative six-hour report", () => {
  assert.equal(check([], 10).status, "ACTIVE");
  assert.equal(check([event(8, "CHECKPOINT", { passedUrine: null })], 10).status, "ACTIVE");
  assert.equal(check([event(8, "CHECKPOINT", { passedUrine: false })], 10).status, "REFERRED_TO_ER");
});

test("each positive red flag independently escalates", () => {
  for (const flag of ["blood", "fever", "lethargy"]) {
    assert.equal(check([event(5, "CHECKPOINT", { [flag]: true })]).status, "REFERRED_TO_ER");
  }
});

test("referrals persist and the 48-hour window ends on schedule", () => {
  assert.equal(check([], 47.9).status, "ACTIVE");
  assert.equal(check([], 48).status, "COMPLETED");
  assert.equal(snapshot({ ...session, status: "REFERRED_TO_ER" }, [], start + DURATION).status,
    "REFERRED_TO_ER");
  assert.equal(reminderSlot(session, start + 2 * HOUR - 1), 0);
  assert.equal(reminderSlot(session, start + 2 * HOUR), 1);
});
