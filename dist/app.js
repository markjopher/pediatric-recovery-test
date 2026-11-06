import { DURATION, HOUR, localDay, reminderSlot, snapshot } from "./engine.js";

const key = "little-steps-recovery-v1";
const el = id => document.getElementById(id);
const profile = el("profile");
const entry = el("entry");
const emergency = el("emergency");
let state;
let saveFailed = false;
let entryType;
let lastAlert;
let reminderStatus = "";
let registration;

function read() {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    saveFailed = true;
    return null;
  }
}

function save(next) {
  try {
    if (next) localStorage.setItem(key, JSON.stringify(next));
    else localStorage.removeItem(key);
    state = next;
    saveFailed = false;
    return true;
  } catch {
    saveFailed = true;
    el("storage-error").hidden = false;
    return false;
  }
}

function showEmergency(reasons) {
  el("reasons").replaceChildren(...reasons.map(reason => {
    const item = document.createElement("li");
    item.textContent = reason;
    return item;
  }));
  if (entry.open) entry.close();
  if (!emergency.open) emergency.showModal();
}

function describe(event) {
  switch (event.type) {
    case "INTAKE": return event.fluidMlRetained + " mL " + event.fluidKind + " retained";
    case "STOOL": return event.stoolType === "WATERY" ? "Watery stool" : "Formed stool";
    case "VOMIT": return "Vomiting episode";
    case "CHECKPOINT": return "Safety checkpoint recorded";
  }
}

function syncStatus(now) {
  const { session, events } = state;
  const current = snapshot(session, events, now);
  if (current.status !== session.status) {
    const changes = { status: current.status };
    if (current.status === "REFERRED_TO_ER") changes.referralReasons = current.reasons;
    save({ ...state, session: { ...session, ...changes } });
  }
  return current;
}

function render() {
  el("storage-error").hidden = !saveFailed;
  el("setup").hidden = Boolean(state);
  el("dashboard").hidden = !state;
  if (!state) return;

  const now = Date.now();
  const balance = syncStatus(now);
  const { session, events } = state;
  const active = balance.status === "ACTIVE";
  const referred = balance.status === "REFERRED_TO_ER";
  const reasons = session.referralReasons ?? balance.reasons;
  el("child").textContent = session.childName + " · " + session.weightKg + " kg";
  el("status").textContent = referred ? "Emergency care advised" :
    active ? "Monitoring in progress" : "48-hour tracking ended";
  const minutes = Math.ceil(balance.hoursLeft * 60);
  el("time-left").textContent = active ?
    Math.floor(minutes / 60) + "h " + minutes % 60 + "m left" :
    referred ? "Urgent" : "Ended";
  el("retained").textContent = balance.retained + " mL";
  el("target").textContent = balance.target + " mL";
  const percent = Math.round(100 * balance.retained / balance.target);
  el("progress").value = Math.min(100, percent);
  el("breakdown").textContent = percent + "% logged · " + balance.base +
    " mL baseline + " + balance.replacement + " mL estimated replacement";

  const latest = events.findLast(event => event.type === "CHECKPOINT");
  const urine = latest?.passedUrine;
  el("check-summary").textContent = latest ?
    "Last check at " + timeLabel(latest.timestamp) + " · Urine in prior 6 hours: " +
      (urine === true ? "yes" : urine === false ? "no" : "unsure") : "No checkpoint recorded.";
  const zincToday = events.some(event => event.zincGiven &&
    localDay(event.timestamp) === localDay(now));
  el("zinc-summary").textContent = session.zincDosageMg === null ? "No zinc dose entered." :
    "Prescribed zinc: " + session.zincDosageMg + " mg · " +
    (zincToday ? "recorded today" : "no dose logged today");

  el("history").replaceChildren(...(events.length ? events.slice(-5).reverse().map(event =>
    timeLabel(event.timestamp) + " · " + describe(event)) : ["No events recorded."]).map(label => {
    const item = document.createElement("li");
    item.textContent = label;
    return item;
  }));
  document.querySelectorAll(".active-only").forEach(element => { element.hidden = !active; });

  const start = Date.parse(session.dischargeTimestamp);
  const slot = reminderSlot(session, now);
  const slotStart = start + slot * 2 * HOUR;
  const nextCheck = slotStart + 2 * HOUR;
  const due = active && slot >= 1 && (!latest || Date.parse(latest.timestamp) < slotStart);
  el("next-check").textContent = due ? "Fluid and safety checkpoint due." :
    active && nextCheck < start + DURATION ?
      "Next fluid and safety reminder at " + timeLabel(nextCheck) + "." :
      "No further reminders scheduled.";
  el("notify-status").textContent = reminderStatus;
  if (referred && lastAlert !== session.sessionId) {
    lastAlert = session.sessionId;
    showEmergency(reasons);
  }
  if (active) void remind(session, now, zincToday);
}

function timeLabel(time) {
  return new Date(time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function setDefaultDischarge() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  profile.elements.discharge.value = local.toISOString().slice(0, 16);
}

profile.addEventListener("submit", event => {
  event.preventDefault();
  if (state) return;
  const data = new FormData(profile);
  const name = data.get("child").trim();
  const discharge = new Date(data.get("discharge"));
  const now = Date.now();
  const valid = name && Number.isFinite(+discharge) && +discharge <= now &&
    now - +discharge < DURATION;
  el("profile-error").hidden = Boolean(valid);
  if (!valid) {
    el("profile-error").textContent = "Enter a name and a discharge time within the last 48 hours.";
    return;
  }

  const session = {
    sessionId: crypto.randomUUID(),
    childName: name,
    weightKg: Number(data.get("weight")),
    targetFluidPerIntervalMl: Number(data.get("fluid")),
    zincDosageMg: data.get("zinc") ? Number(data.get("zinc")) : null,
    dischargeTimestamp: discharge.toISOString(),
    status: "ACTIVE",
  };
  if (save({ session, events: [], lastReminder: reminderSlot(session, now) })) render();
});

function log(type, details = {}) {
  if (!state || syncStatus(Date.now()).status !== "ACTIVE") {
    render();
    return false;
  }
  const { session, events } = state;
  const now = Date.now();
  const event = {
    eventId: crypto.randomUUID(), sessionId: session.sessionId,
    timestamp: new Date(now).toISOString(), type, ...details,
  };
  const nextEvents = [...events, event];
  const result = snapshot(session, nextEvents, now);
  const nextSession = result.status === "REFERRED_TO_ER" ?
    { ...session, status: result.status, referralReasons: result.reasons } : session;
  if (!save({ ...state, session: nextSession, events: nextEvents })) {
    if (result.reasons.length) showEmergency(result.reasons);
    return false;
  }
  el("logged").textContent = describe(event);
  if (entry.open) entry.close();
  render();
  return true;
}

document.querySelectorAll("[data-intake]").forEach(button => {
  button.onclick = () => log("INTAKE", { fluidMlRetained: Number(button.dataset.intake), fluidKind: "ORS" });
});
el("vomit").onclick = () => log("VOMIT");

function openEntry(type, title, fields) {
  if (!state || syncStatus(Date.now()).status !== "ACTIVE") return render();
  entryType = type;
  el("entry-title").textContent = title;
  el("entry-fields").innerHTML = fields;
  entry.showModal();
}
el("stool").onclick = () => openEntry("STOOL", "Log stool",
  '<label>Stool type<select name="stool" required><option value="">Choose type</option><option value="WATERY">Watery or loose</option><option value="FORMED">Formed</option></select></label>');
el("custom-fluid").onclick = () => openEntry("INTAKE", "Log retained fluid",
  '<label>Fluid type<select name="kind"><option>ORS</option><option>Water</option><option>Other</option></select></label><label>Amount retained (mL)<input name="amount" type="number" min="1" max="10000" required></label>');
el("open-check").onclick = () => openEntry("CHECKPOINT", "Safety checkpoint",
  '<label>Urine in the last 6 hours?<select name="urine" required><option value="">Choose an answer</option><option value="yes">Yes</option><option value="no">No urine for 6 hours</option><option value="unsure">Unsure</option></select></label>' +
  '<fieldset><legend>Symptoms observed now</legend><label><input name="blood" type="checkbox"> Blood in stool</label><label><input name="fever" type="checkbox"> Temperature above 38.5°C</label><label><input name="lethargy" type="checkbox"> Unusually lethargic or unresponsive</label></fieldset>' +
  (state.session.zincDosageMg === null ? "" : '<label><input name="zinc" type="checkbox"> Prescribed zinc was given today</label>'));
el("entry-form").onsubmit = event => {
  event.preventDefault();
  const fields = new FormData(event.currentTarget);
  if (entryType === "STOOL") log(entryType, { stoolType: fields.get("stool") });
  if (entryType === "INTAKE") log(entryType, {
    fluidKind: fields.get("kind"), fluidMlRetained: Number(fields.get("amount")),
  });
  if (entryType === "CHECKPOINT") log(entryType, {
    passedUrine: fields.get("urine") === "unsure" ? null : fields.get("urine") === "yes",
    blood: fields.has("blood"), fever: fields.has("fever"),
    lethargy: fields.has("lethargy"), zincGiven: fields.has("zinc"),
  });
};
el("cancel").onclick = () => entry.close();
el("acknowledge").onclick = () => emergency.close();
emergency.addEventListener("cancel", event => event.preventDefault());
el("danger").onclick = () => {
  const reasons = state.session.referralReasons ?? ["Emergency guidance requested by caregiver."];
  if (state.session.status === "ACTIVE") {
    save({ ...state, session: { ...state.session, status: "REFERRED_TO_ER", referralReasons: reasons } });
    lastAlert = state.session.sessionId;
    render();
  }
  showEmergency(reasons);
};

el("reset").onclick = () => {
  if (confirm("Delete the recovery session and its events from this device?") && save(null)) {
    lastAlert = undefined;
    reminderStatus = "";
    el("logged").textContent = "";
    profile.reset();
    setDefaultDischarge();
    render();
  }
};

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(worker => { registration = worker; render(); })
    .catch(() => {
      reminderStatus = "Offline installation is unavailable in this browser session.";
      render();
    });
}
el("notify").onclick = async () => {
  try {
    if (!registration || !("Notification" in window)) {
      reminderStatus = "Browser notifications are unavailable on this device.";
    } else {
      const permission = await Notification.requestPermission();
      reminderStatus = permission === "granted" ? "Browser notifications enabled." :
        "Notifications are off. Check your browser permissions to enable them.";
    }
  } catch {
    reminderStatus = "Browser notifications could not be enabled.";
  }
  render();
};

async function remind(session, now, zincToday) {
  const slot = reminderSlot(session, now);
  if (slot <= state.lastReminder || slot < 1 || slot >= 24) return;
  if (!save({ ...state, lastReminder: slot })) return;
  const body = session.zincDosageMg !== null && !zincToday ?
    "Review fluids and symptoms. Check today’s prescribed zinc in the discharge plan." :
    "Review fluids and record a safety checkpoint.";
  if (registration && globalThis.Notification?.permission === "granted") {
    try {
      await registration.showNotification("Recovery checkpoint", { body, tag: "recovery-checkpoint" });
    } catch {
      // The due notice remains visible in the dashboard.
    }
  }
}

state = read();
setDefaultDischarge();
render();
setInterval(render, 15000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
window.addEventListener("storage", event => {
  if (event.key === key || event.key === null) {
    state = read();
    if (entry.open) entry.close();
    if (!state && emergency.open) emergency.close();
    render();
  }
});
