export const HOUR = 3600000;
export const DURATION = 48 * HOUR;

export function snapshot(session, events, now) {
  const start = Date.parse(session.dischargeTimestamp);
  const end = start + DURATION;
  const asOf = Math.min(now, end);
  const recent = (hours) => events.filter(event => {
    const time = Date.parse(event.timestamp);
    return event.sessionId === session.sessionId && time >= start &&
      time <= asOf && time > asOf - hours * HOUR;
  });
  const fourHours = recent(4);
  const loose = fourHours.filter(event => event.type === "STOOL" && event.stoolType === "WATERY").length;
  const vomits = fourHours.filter(event => event.type === "VOMIT").length;
  const retained = fourHours.reduce((total, event) =>
    total + (event.type === "INTAKE" ? event.fluidMlRetained : 0), 0);
  const replacement = Math.round(session.weightKg * (loose * 10 + vomits * 2));
  const base = session.targetFluidPerIntervalMl * 4;
  const target = base + replacement;

  let vomitingRun = 0;
  let repeatedVomiting = false;
  for (const event of recent(1)) {
    // Safety checks and stools do not interrupt a sequence of failed intake.
    if (event.type === "INTAKE") vomitingRun = 0;
    if (event.type === "VOMIT" && ++vomitingRun >= 3) repeatedVomiting = true;
  }

  const latestUrineAnswer = recent(6).findLast(event =>
    event.type === "CHECKPOINT" && typeof event.passedUrine === "boolean");
  const latestCheck = recent(48).findLast(event => event.type === "CHECKPOINT");
  const reasons = [];
  if (repeatedVomiting) reasons.push("Three consecutive vomiting episodes within one hour.");
  if (latestUrineAnswer?.passedUrine === false) reasons.push("No urine in the last six hours was reported.");
  if (loose > 4 && retained < target / 2) reasons.push("More than four watery stools in four hours with less than half the estimated fluid goal logged.");
  if (latestCheck?.blood) reasons.push("Blood in stool was reported.");
  if (latestCheck?.fever) reasons.push("A temperature above 38.5°C was reported.");
  if (latestCheck?.lethargy) reasons.push("Unusual lethargy or unresponsiveness was reported.");
  const hoursLeft = Math.max(0, (end - now) / HOUR);
  return { base, replacement, target, retained, hoursLeft, reasons,
    status: session.status !== "ACTIVE" ? session.status :
      reasons.length ? "REFERRED_TO_ER" : hoursLeft === 0 ? "COMPLETED" : "ACTIVE" };
}

export function reminderSlot(session, now) {
  return Math.floor((now - Date.parse(session.dischargeTimestamp)) / (2 * HOUR));
}

export function localDay(time) {
  const date = new Date(time);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
}
