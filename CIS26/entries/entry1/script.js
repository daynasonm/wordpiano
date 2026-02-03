/* =========================
   1) WORD BANK (8 columns × 13 rows)
========================= */
const WORDS = [
  ["I","when","spice","🌶️","zig","a","real","nothin","talk","is","sporty","⚽️","fine","deceivin’","gotta"],
  ["infatuat","fine","aligned","spice","🌶️","posh","weave","ginger","name","my","🙊","girl","like","💛"],
  ["a","freaky","don’t","banana","🍌","whole","weave","🧶","reason","schemin’","go","🌶️","spice","girl","🫦"],
  ["zig","ah","⚡️","ah","zig","🐒","ah","zig","ah","zig","ah","zig","ah","zig","zig","ah"],
  ["ah","real","posh","💍","so","world","🌍","ah","feel","girl","in","away","pavin’","masters","🎓","🤫","fuck"],
  ["🙊","fuck","spice","🌶️","old","up","no","fake","off","feelings","👀","look","mama","together","world","🌍","tryna"],
  ["reason","hit","🚦","I-5","come","Viva","know","boujee","💅","tell","really","spice","🌶️","woah","go","aligned"],
  ["wanna","list","(hey)","scary","🌶️","Spice","fine","a","need","like","studyin’","put","💛","fuck","🙊","fuck"],
];

const pointers = new Array(8).fill(0);

/* noteIndex: 0=C(low),1=D,2=E,3=F,4=G,5=A,6=B,7=C(high) */
const KEYMAP = {
  // octave 1
  "z": { octave: 1, noteIndex: 0 },
  "x": { octave: 1, noteIndex: 1 },
  "c": { octave: 1, noteIndex: 2 },
  "v": { octave: 1, noteIndex: 3 },
  "n": { octave: 1, noteIndex: 4 },
  "m": { octave: 1, noteIndex: 5 },
  ",": { octave: 1, noteIndex: 6 },
  "/": { octave: 1, noteIndex: 7 },

  // octave 2
  "a": { octave: 2, noteIndex: 0 },
  "s": { octave: 2, noteIndex: 1 },
  "d": { octave: 2, noteIndex: 2 },
  "f": { octave: 2, noteIndex: 3 },
  "j": { octave: 2, noteIndex: 4 },
  "k": { octave: 2, noteIndex: 5 },
  "l": { octave: 2, noteIndex: 6 },
  ".": { octave: 2, noteIndex: 0 }, // overlap with 'a'

  // octave 3
  "q": { octave: 3, noteIndex: 0 },
  "w": { octave: 3, noteIndex: 1 },
  "e": { octave: 3, noteIndex: 2 },
  "r": { octave: 3, noteIndex: 3 },
  "u": { octave: 3, noteIndex: 4 },
  "i": { octave: 3, noteIndex: 5 },
  "o": { octave: 3, noteIndex: 6 },
  "p": { octave: 3, noteIndex: 7 },
  ";": { octave: 3, noteIndex: 7 }, // overlap with 'p'

  // shift-robust punctuation
  "<": { octave: 1, noteIndex: 6 },
  "?": { octave: 1, noteIndex: 7 },
  ">": { octave: 2, noteIndex: 0 },
  ":": { octave: 3, noteIndex: 7 },
};

const heldKeys = new Set();    // prevent repeat spam
const pressCount = new Map();  // overlap-safe (two computer keys -> same piano key)

const stage = document.getElementById("stage");
const activeLayer = document.getElementById("activeLayer");
const piano = document.getElementById("piano");

/* =========================
   2) TOP→BOTTOM FEED LAYOUT SETTINGS
========================= */
const TOP_START = 18;
const ROW_GAP = 54;          // increase/decrease for vertical spacing
let spawnIndex = 0;          // global counter (controls Y)
let laneCenters = [];        // 8 lane x-centers (controls X)

/* Build UI */
buildPiano();
computeLaneCenters();
window.addEventListener("resize", computeLaneCenters);

/* =========================
   Keyboard events
========================= */
window.addEventListener("keydown", (e) => {
  const k = normalizeKey(e);
  const info = KEYMAP[k];
  if (!info) return;

  if (isPunctuation(k)) e.preventDefault();
  if (heldKeys.has(k)) return;

  heldKeys.add(k);

  pressPianoKey(info.octave, info.noteIndex);

  const { word, rowNum, colNum } = nextWordForColumn(info.noteIndex);
  spawnWord(colNum, word);        // ✅ placement ignores row now
  playAudio(colNum, rowNum);      // ✅ audio still uses the correct row
});

window.addEventListener("keyup", (e) => {
  const k = normalizeKey(e);
  const info = KEYMAP[k];
  if (!info) return;

  if (isPunctuation(k)) e.preventDefault();

  heldKeys.delete(k);
  releasePianoKey(info.octave, info.noteIndex);
});

/* =========================
   Piano (continuous 24 keys)
========================= */
function buildPiano() {
  piano.innerHTML = "";

  const keyboard = document.createElement("div");
  keyboard.className = "keyboard";

  for (let octave = 1; octave <= 3; octave++) {
    for (let noteIndex = 0; noteIndex < 8; noteIndex++) {
      const key = document.createElement("div");
      key.className = "whiteKey";
      key.dataset.octave = String(octave);
      key.dataset.note = String(noteIndex);
      keyboard.appendChild(key);
    }
  }

  // black keys (visual only)
  const blackBetween = [0, 1, 3, 4, 5];
  for (let octave = 1; octave <= 3; octave++) {
    blackBetween.forEach((i) => {
      const bk = document.createElement("div");
      bk.className = "blackKey";
      const globalBoundary = (octave - 1) * 8 + (i + 1);
      bk.style.left = `${(globalBoundary / 24) * 100}%`;
      keyboard.appendChild(bk);
    });
  }

  piano.appendChild(keyboard);
}

function keyId(octave, noteIndex) {
  return `${octave}-${noteIndex}`;
}

function getKeyEl(octave, noteIndex) {
  return document.querySelector(
    `.whiteKey[data-octave="${octave}"][data-note="${noteIndex}"]`
  );
}

function pressPianoKey(octave, noteIndex) {
  const id = keyId(octave, noteIndex);
  pressCount.set(id, (pressCount.get(id) || 0) + 1);
  const el = getKeyEl(octave, noteIndex);
  if (el) el.classList.add("pressed");
}

function releasePianoKey(octave, noteIndex) {
  const id = keyId(octave, noteIndex);
  const n = (pressCount.get(id) || 0) - 1;
  pressCount.set(id, Math.max(0, n));
  if (n <= 0) {
    const el = getKeyEl(octave, noteIndex);
    if (el) el.classList.remove("pressed");
  }
}

/* =========================
   Compute lane centers (X positions)
========================= */
function computeLaneCenters() {
  const w = stage.clientWidth;
  const laneW = w / 8;
  laneCenters = Array.from({ length: 8 }, (_, i) => (i + 0.5) * laneW);
}

/* =========================
   Word selection (skip empties)
========================= */
function nextWordForColumn(noteIndex) {
  const colNum = noteIndex + 1; // 1..8
  const col = noteIndex;        // 0..7

  for (let tries = 0; tries < 13; tries++) {
    const idx = pointers[col];
    const word = WORDS[col][idx];
    pointers[col] = (pointers[col] + 1) % 13;

    if (word && word !== "") {
      return { word, rowNum: idx + 1, colNum };
    }
  }

  return { word: "", rowNum: 1, colNum };
}

/* =========================
   Spawn word: TOP→BOTTOM order (global)
========================= */
function spawnWord(colNum, word) {
  if (!word) return;

  // How many “rows” fit on screen?
  const usableH = stage.clientHeight - TOP_START - 30;
  const maxRows = Math.max(1, Math.floor(usableH / ROW_GAP));

  // global top→bottom index (wrap when it reaches bottom)
  const rowSlot = spawnIndex % maxRows;
  spawnIndex += 1;

  const xBase = laneCenters[colNum - 1] ?? (stage.clientWidth * 0.5);
  const yBase = TOP_START + rowSlot * ROW_GAP;

  // slight collage jitter
  const x = xBase + randInt(-26, 26);
  const y = yBase + randInt(-10, 10);

  const box = document.createElement("div");
  box.className = "wordBox";
  box.textContent = word;
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;

  activeLayer.appendChild(box);

  // fade in
  requestAnimationFrame(() => box.classList.add("show"));

  // dissolve after 3 seconds (same behavior as before)
  setTimeout(() => {
    box.classList.add("fadeOut");
    setTimeout(() => box.remove(), 520);
  }, 5000);
}

/* =========================
   Audio: ./audio/colX_rowY.mp3
========================= */
function playAudio(colNum, rowNum) {
  const src = `./audio/col${colNum}_row${rowNum}.mp3`;
  const audio = new Audio(src);
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

/* =========================
   Helpers
========================= */
function normalizeKey(e) {
  return (e.key || "").toLowerCase();
}

function isPunctuation(k) {
  return [",", ".", ";", "/", "<", ">", ":", "?"].includes(k);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* =========================
   Cursor
========================= */

const pepperCursor = document.getElementById("pepperCursor");
let isPepper = true; // starts as 🌶️

window.addEventListener("mousemove", (e) => {
  if (!pepperCursor) return;
  pepperCursor.style.left = `${e.clientX}px`;
  pepperCursor.style.top = `${e.clientY}px`;
});

window.addEventListener("click", () => {
  if (!pepperCursor) return;
  isPepper = !isPepper;
  pepperCursor.textContent = isPepper ? "🌶️" : "⚡️";
});
