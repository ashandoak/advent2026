"use strict";

const CONFIG = {
  year: 2026,
  month: 12,
  days: 24,
  timezone: "America/Vancouver",
  qrDirectory: "./qr/",
  title: "Christmas Advent Calendar"
};

const monthName = new Intl.DateTimeFormat("en", {
  month: "long", timeZone: "UTC"
}).format(new Date(Date.UTC(CONFIG.year, CONFIG.month - 1, 1)));

// Vancouver moved to year-round UTC−7 in March 2026. Use that offset
// after the transition even on devices with older IANA time zone data.
const permanentPacificStart = Date.UTC(2026, 2, 8, 10);
const permanentPacificZone = "Etc/GMT+7";

function timeZoneAt(instant) {
  return CONFIG.timezone === "America/Vancouver" && instant >= permanentPacificStart
    ? permanentPacificZone
    : CONFIG.timezone;
}

const dateOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
const configuredDate = new Intl.DateTimeFormat("en-CA", {
  ...dateOptions, timeZone: CONFIG.timezone
});
const permanentPacificDate = new Intl.DateTimeFormat("en-CA", {
  ...dateOptions, timeZone: permanentPacificZone
});

const storageKey = `advent-calendar:${CONFIG.year}:opened`;
const opened = readOpened();
const previewDate = getPreviewDate();
const startDate = dateKey(CONFIG.year, CONFIG.month, 1);
const endDate = dateKey(CONFIG.year, CONFIG.month, CONFIG.days);

// At UTC noon the Pacific calendar is on the same date. Subtract its
// local clock reading to get the UTC instant of midnight on that date.
const utcNoon = Date.UTC(CONFIG.year, CONFIG.month - 1, 1, 12);
const unlockClock = new Intl.DateTimeFormat("en", {
  timeZone: timeZoneAt(utcNoon), hourCycle: "h23", hour: "numeric", minute: "numeric"
});
const localNoon = dateParts(unlockClock, utcNoon);
const firstUnlock = utcNoon - (Number(localNoon.hour) * 60 + Number(localNoon.minute)) * 60_000;

const grid = document.querySelector("#doors");
const seasonMessage = document.querySelector("#season-message");
const dialog = document.querySelector("#surprise");
const surpriseTitle = document.querySelector("#surprise-title");
const surpriseMessage = document.querySelector("#surprise-message");
const qrFrame = document.querySelector("#qr-frame");
const listeningDuration = document.querySelector("#listening-duration");
const pieceDetails = document.querySelector("#piece-details");
const pieceContent = document.querySelector("#piece-content");

let opening = false;
let refreshTimer;
let tracksRequest;

document.title = CONFIG.title;
document.querySelector("h1").textContent = CONFIG.title;
document.querySelector("#edition").textContent = `${monthName} ${CONFIG.year}`;
const doors = Array.from({ length: CONFIG.days }, (_, index) => createDoor(index + 1));

refreshCalendar();
window.addEventListener("focus", refreshCalendar);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshCalendar();
});

dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) {
    dialog.close();
  }
});

function dateKey(year, month, day) {
  return [year, month, day].map((part) => String(part).padStart(2, "0")).join("-");
}

function dateParts(formatter, instant) {
  return Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
}

function getPreviewDate() {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return null;

  const value = new URLSearchParams(location.search).get("date");
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function availability(now) {
  const formatter = timeZoneAt(now) === permanentPacificZone ? permanentPacificDate : configuredDate;
  const { year, month, day } = dateParts(formatter, now);
  const date = previewDate || dateKey(year, month, day);
  const today = date >= startDate && date <= endDate ? Number(date.slice(-2)) : 0;
  return { date, today, unlocked: date > endDate ? CONFIG.days : today };
}

function readOpened() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) {
      return new Set(saved.filter((day) => Number.isInteger(day) && day >= 1 && day <= CONFIG.days));
    }
  } catch {
    // Storage may be disabled or contain invalid data.
  }
  return new Set();
}

function createDoor(day) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "door";
  const ornaments = ["✧", "❋", "✦", "❄"];
  button.innerHTML = `
    <span class="door-face" aria-hidden="true">
      <span class="ornament">${ornaments[(day - 1) % ornaments.length]}</span>
      <span class="number">${String(day).padStart(2, "0")}</span>
      <span class="door-status"></span>
    </span>`;
  button.addEventListener("click", () => openDoor(day, button));
  item.append(button);
  grid.append(item);
  return button;
}

function renderCalendar(now = Date.now()) {
  const { date, today, unlocked } = availability(now);
  doors.forEach((button, index) => {
    const day = index + 1;
    const locked = day > unlocked;
    const wasOpened = !locked && opened.has(day);
    button.disabled = locked;
    button.classList.toggle("today", day === today);
    button.classList.toggle("opened", wasOpened);
    button.setAttribute("aria-label", `${monthName} ${day}, ${[
      day === today && "today",
      locked ? "locked" : wasOpened ? "opened" : "available"
    ].filter(Boolean).join(", ")}`);
  });

  let message = "";
  if (date < startDate) {
    const remaining = previewDate
      ? (Date.parse(startDate) - Date.parse(date)) / 60_000
      : Math.max(1, Math.ceil((firstUnlock - now) / 60_000));
    const days = Math.floor(remaining / 1440);
    const hours = Math.floor(remaining / 60) % 24;
    const minutes = remaining % 60;
    const countdown = [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`]
      .filter(Boolean).join(" ");
    message = `First door opens in ${countdown}`;
  } else if (date > endDate) {
    message = "Merry Christmas!";
  }
  if (seasonMessage.textContent !== message) seasonMessage.textContent = message;
}

function refreshCalendar() {
  clearTimeout(refreshTimer);
  const now = Date.now();
  renderCalendar(now);
  refreshTimer = setTimeout(refreshCalendar, 60_000 - now % 60_000);
}

function loadTracks() {
  tracksRequest ??= fetch("./tracks.json")
    .then((response) => {
      if (!response.ok) throw new Error("Track details unavailable");
      return response.json();
    })
    .then((tracks) => {
      if (!Array.isArray(tracks)) throw new Error("Invalid track list");
      return tracks;
    })
    .catch(() => {
      tracksRequest = undefined;
      return [];
    });
  return tracksRequest;
}

function showTrack(track) {
  const heading = document.createElement("h3");
  heading.textContent = `${track.composer} · ${track.title}`;
  const credits = document.createElement("dl");
  for (const [label, value] of [
    ["Composed", track.year],
    ["Period", track.period],
    ["Instrumentation", track.instrumentation],
    ["Performed by", track.performer]
  ]) {
    if (!value) continue;
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    credits.append(term, description);
  }
  const rationale = document.createElement("p");
  rationale.textContent = track.rationale;
  pieceContent.append(heading, credits, rationale);
  if (track.listenFor) {
    const observation = document.createElement("p");
    const label = document.createElement("strong");
    label.textContent = "Listen for ";
    observation.append(label, track.listenFor);
    pieceContent.append(observation);
  }
  listeningDuration.textContent = `About ${Math.round(track.durationMinutes)} min of listening`;
  listeningDuration.hidden = false;
  pieceDetails.hidden = false;
}

async function openDoor(day, button) {
  if (opening || dialog.open || day > availability(Date.now()).unlocked) return;
  opening = true;
  button.classList.add("opening");
  const face = button.querySelector(".door-face");
  const [swing] = face.getAnimations();
  if (swing) {
    const duration = swing.effect.getComputedTiming().endTime;
    let fallback;
    await Promise.race([
      swing.finished.catch(() => {}),
      new Promise((resolve) => { fallback = setTimeout(resolve, duration + 50); })
    ]);
    clearTimeout(fallback);
  }
  button.classList.remove("opening");
  opening = false;
  if (day > availability(Date.now()).unlocked) return;

  const image = new Image();
  image.alt = `QR code for ${monthName} ${day}`;
  image.hidden = true;
  surpriseTitle.textContent = `${monthName} ${day}`;
  surpriseMessage.textContent = "Scan to discover today's music.";
  listeningDuration.hidden = true;
  pieceDetails.open = false;
  pieceDetails.hidden = true;
  pieceContent.replaceChildren();
  qrFrame.classList.remove("celebrate");
  qrFrame.replaceChildren(image);
  dialog.showModal();
  loadTracks().then((tracks) => {
    if (!dialog.open || image.parentNode !== qrFrame) return;
    const track = tracks.find((entry) => entry.day === day);
    if (track) showTrack(track);
  });

  image.addEventListener("load", () => {
    if (!dialog.open || image.parentNode !== qrFrame) return;

    image.hidden = false;
    if (!opened.has(day)) {
      opened.add(day);
      for (const savedDay of readOpened()) opened.add(savedDay);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...opened]));
      } catch {
        // The in-memory state remains available for this visit.
      }
      qrFrame.classList.add("celebrate");
      renderCalendar();
    }
  }, { once: true });
  image.addEventListener("error", () => {
    if (!dialog.open || image.parentNode !== qrFrame) return;
    image.remove();
    surpriseMessage.textContent = "Today's surprise isn't quite ready yet. Check back soon!";
  }, { once: true });
  image.src = `${CONFIG.qrDirectory}${String(day).padStart(2, "0")}.png`;
}
