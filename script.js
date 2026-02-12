/* =========================
   1) WORD BANK (8 columns × 13 rows)
   noteIndex -> column:
   0=C,1=D,2=E,3=F,4=G,5=A,6=B,7=C(high)
========================= */
const WORDS = [
  // col 1 (C)
  ["I","when","spice","girl","zig","real","nothin","talk","is","sporty","fine","deceivin’","gotta"],
  // col 2 (D)
  ["infatuat","fine","aligned","spice","girl","weave","ginger","name","my","spice","gril","need","zig"],
  // col 3 (E)
  ["a","freaky","don’t","banana","whole","weave","reason","schemin’","spice","girl","posh","woah","fuck"],
  // col 4 (F) — zig/ah pattern
  ["zig","ah","zig","ah","zig","ah","zig","ah","zig","ah","zig","ah","zig","ah","zig"],
  // col 5 (G)
  ["ah","real","posh","so","world","ah","feel","girl","in","away","pavin’","masters","fuck"],
  // col 6 (A)
  ["fuck","spice","girl","fine","no","fake","off","feelings","look","mama","together","world","tryna"],
  // col 7 (B)
  ["reason","hit","I-5","come","Viva","know","boujee","tell","really","spice","girl","go","aligned"],
  // col 8 (C high)
  ["wanna","list","(hey)","scary","spice","girl","a","need","like","studyin’","put","fuck","old"],
];

const pointers = new Array(8).fill(0);
const ROWS_PER_COL = 13;

/* =========================
   2) Keyboard mapping (v3)
   baseOctave is shifted by Z / X
========================= */
let baseOctave = 2;
const MIN_OCT = 1;
const MAX_OCT = 3;

/* White noteIndex: 0=C,1=D,2=E,3=F,4=G,5=A,6=B,7=C(high) */
const NOTE_KEYS = {
  // white keys (base octave)
  a: { kind: "white", noteIndex: 0, octaveOffset: 0 }, // C
  s: { kind: "white", noteIndex: 1, octaveOffset: 0 }, // D
  d: { kind: "white", noteIndex: 2, octaveOffset: 0 }, // E
  f: { kind: "white", noteIndex: 3, octaveOffset: 0 }, // F
  g: { kind: "white", noteIndex: 4, octaveOffset: 0 }, // G
  h: { kind: "white", noteIndex: 5, octaveOffset: 0 }, // A
  j: { kind: "white", noteIndex: 6, octaveOffset: 0 }, // B
  k: { kind: "white", noteIndex: 7, octaveOffset: 0 }, // C (high)

  // reaches into the next octave
  l: { kind: "white", noteIndex: 1, octaveOffset: 1 }, // D (next octave)

  // sharps (mapped to nearest natural column for words/audio)
  w: { kind: "black", acc: "cs", wordColNoteIndex: 0, octaveOffset: 0 }, // C# -> C column
  e: { kind: "black", acc: "ds", wordColNoteIndex: 1, octaveOffset: 0 }, // D# -> D column
  t: { kind: "black", acc: "fs", wordColNoteIndex: 3, octaveOffset: 0 }, // F# -> F column
  y: { kind: "black", acc: "gs", wordColNoteIndex: 4, octaveOffset: 0 }, // G# -> G column
  u: { kind: "black", acc: "as", wordColNoteIndex: 5, octaveOffset: 0 }, // A# -> A column

  // sharps in the next octave
  o: { kind: "black", acc: "cs", wordColNoteIndex: 0, octaveOffset: 1 }, // C# next
  p: { kind: "black", acc: "ds", wordColNoteIndex: 1, octaveOffset: 1 }, // D# next
};

/* =========================
   3) DOM
========================= */
const stage = document.getElementById("stage");
const activeLayer = document.getElementById("activeLayer");
const piano = document.getElementById("piano");

const startOverlay = document.getElementById("startOverlay");
const playBtn = document.getElementById("playBtn");

const helpOverlay = document.getElementById("helpOverlay");
const closeHelpBtn = document.getElementById("closeHelpBtn");
const infoBtn = document.getElementById("infoBtn");

const keyboard = document.getElementById("keyboard");

/* =========================
   4) Stage layout (top→bottom stream)
========================= */
const TOP_START = 0;
const ROW_GAP = 54;
let spawnIndex = 0;
let laneCenters = [];

const BOX_H = 44;          // must match CSS height
const STACK_STEP = 38;     // smaller than BOX_H => slight vertical overlap
const CORNER_SHIFT = 8;    // horizontal stagger for “corner overlap”
const colHeights = new Array(8).fill(0); // stack counter per columnß

/* =========================
   5) State
========================= */
let isStarted = false;
let helpOpen = false;

/* held computer keys -> resolved press info (so release is correct) */
const held = new Map();

/* =========================
   "spice" → "girl" detector
========================= */
let _phraseArmed = false;
let _phraseTimer = null;

function _normWord(w) {
  return (w || "")
    .toLowerCase()
    .trim()
    .replace(/[’']/g, "'")
    .replace(/[^a-z]/g, "");
}

function _resetPhrase() {
  _phraseArmed = false;
  if (_phraseTimer) clearTimeout(_phraseTimer);
  _phraseTimer = null;
}

function onWordTriggered(word) {
  const w = _normWord(word);

  // arm on "spice"
  if (!_phraseArmed) {
    if (w === "spice") {
      _phraseArmed = true;
      if (_phraseTimer) clearTimeout(_phraseTimer);
      _phraseTimer = setTimeout(_resetPhrase, 2200); // "together" window
    }
    return;
  }

  // already armed (we just saw "spice")
  if (w === "girl") {
    startEmojiRain(2600);
    _resetPhrase();
    return;
  }

  // allow "spice" to re-arm if repeated; otherwise reset
  if (w === "spice") {
    if (_phraseTimer) clearTimeout(_phraseTimer);
    _phraseTimer = setTimeout(_resetPhrase, 2200);
  } else {
    _resetPhrase();
  }
}

/* =========================
   Emoji rain
========================= */
const RAIN_EMOJIS = ["🌶️", "💅", "🫦", "⚡️", "🙊"];
let _rainInterval = null;
let _rainStopTimer = null;

function getEmojiRainLayer() {
  return document.getElementById("emojiRain");
}

function spawnEmojiDrop(layer) {
  const span = document.createElement("span");
  span.className = "emojiDrop";
  span.textContent = RAIN_EMOJIS[randInt(0, RAIN_EMOJIS.length - 1)];

  span.style.left = `${Math.random() * 100}%`;
  span.style.fontSize = `${22 + Math.random() * 26}px`;
  span.style.setProperty("--dur", `${1.1 + Math.random() * 1.2}s`);
  span.style.setProperty("--drift", `${-40 + Math.random() * 80}px`);

  span.addEventListener("animationend", () => span.remove());
  layer.appendChild(span);
}

function startEmojiRain(durationMs = 2600) {
  const layer = getEmojiRainLayer();
  if (!layer) return;

  // restart cleanly if it triggers again
  if (_rainInterval) clearInterval(_rainInterval);
  if (_rainStopTimer) clearTimeout(_rainStopTimer);
  layer.replaceChildren();

  _rainInterval = setInterval(() => spawnEmojiDrop(layer), 70);
  _rainStopTimer = setTimeout(() => {
    if (_rainInterval) clearInterval(_rainInterval);
    _rainInterval = null;

    // let remaining drops finish their animations, then clear
    setTimeout(() => layer.replaceChildren(), 1600);
  }, durationMs);
}

/* =========================
   Init
========================= */
buildPiano();
computeLaneCenters();
window.addEventListener("resize", computeLaneCenters);

window.addEventListener("blur", releaseAllPressed);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseAllPressed();
});

/* =========================
   Start / Help UI
========================= */

// 1) Play starts the experience
playBtn.addEventListener("click", () => {
  isStarted = true;
  document.body.classList.add("started");

  hideOverlay(startOverlay);

  setTimeout(() => {
    openHelp();
  }, 350);
});

// 2) Top-right i button toggles instructions (ONLY this button)
infoBtn.addEventListener("click", () => {
  if (!isStarted) return;
  toggleHelp();
});


// 3) X button closes help
closeHelpBtn.addEventListener("click", closeHelp);

// 4) Clicking outside the image closes help
helpOverlay.addEventListener("click", (e) => {
  if (e.target === helpOverlay) closeHelp();
});


/* =========================
   Keyboard events
========================= */
window.addEventListener("keydown", (e) => {
  if (!isStarted) return;
  if (e.repeat) return;

  const k = normalizeKey(e);

  // Esc closes help
  if (k === "escape") {
    if (helpOpen) closeHelp();
    return;
  }

  // octave shift controls
  if (k === "z" || k === "x") {
    handleOctaveKey(k);
    return;
  }

  // while help is open, ignore playing keys
  if (helpOpen) return;

  const map = NOTE_KEYS[k];
  if (!map) return;

  // resolve octave at press time
  const octave = clamp(baseOctave + (map.octaveOffset || 0), MIN_OCT, MAX_OCT);

  // create pressInfo FIRST
  const pressInfo = map.kind === "white"
    ? { kind: "white", octave, noteIndex: map.noteIndex, wordColNoteIndex: map.noteIndex }
    : { kind: "black", octave, acc: map.acc, wordColNoteIndex: map.wordColNoteIndex };

  // NOW you can log it safely
  console.log("key:", k);

  held.set(k, pressInfo);

  pressVisual(pressInfo);
  triggerWordAndAudio(pressInfo.wordColNoteIndex);
});

// newly added 

window.addEventListener("keyup", (e) => {
  if (!isStarted) return;

  const k = normalizeKey(e);
  const info = held.get(k);
  if (!info) return;

  releaseVisual(info);
  held.delete(k);
});


/* =========================
   Piano building (24 white keys + black sharps)
========================= */
function buildPiano() {
  keyboard.innerHTML = "";

  // 24 white keys
  for (let octave = 1; octave <= 3; octave++) {
    for (let noteIndex = 0; noteIndex < 8; noteIndex++) {
      const key = document.createElement("button");
      key.type = "button";
      key.className = "whiteKey";
      key.dataset.octave = String(octave);
      key.dataset.note = String(noteIndex);

      attachPointerKey(key, {
        kind: "white",
        octave,
        noteIndex,
        wordColNoteIndex: noteIndex,
      });

      keyboard.appendChild(key);
    }
  }

  // black keys
  const blackSpecs = [
    { after: 0, acc: "cs", wordColNoteIndex: 0 },
    { after: 1, acc: "ds", wordColNoteIndex: 1 },
    { after: 3, acc: "fs", wordColNoteIndex: 3 },
    { after: 4, acc: "gs", wordColNoteIndex: 4 },
    { after: 5, acc: "as", wordColNoteIndex: 5 },
  ];

  for (let octave = 1; octave <= 3; octave++) {
    blackSpecs.forEach((b) => {
      const bk = document.createElement("button");
      bk.type = "button";
      bk.className = "blackKey";
      bk.dataset.octave = String(octave);
      bk.dataset.acc = b.acc;

      const boundary = (octave - 1) * 8 + (b.after + 1);
      bk.style.left = `${(boundary / 24) * 100}%`;

      attachPointerKey(bk, {
        kind: "black",
        octave,
        acc: b.acc,
        wordColNoteIndex: b.wordColNoteIndex,
      });

      keyboard.appendChild(bk);
    });
  }
}

/* =========================
   Pointer (mouse/trackpad/touch) play
========================= */
function attachPointerKey(el, info) {
  let isDown = false;

  el.addEventListener("pointerdown", (e) => {
    if (!canPlay()) return;
    e.preventDefault();
    isDown = true;
    el.setPointerCapture?.(e.pointerId);

    pressVisual(info);
    triggerWordAndAudio(info.wordColNoteIndex);
  });

  el.addEventListener("pointerup", () => {
    if (!isDown) return;
    isDown = false;
    releaseVisual(info);
  });

  el.addEventListener("pointercancel", () => {
    if (!isDown) return;
    isDown = false;
    releaseVisual(info);
  });

  el.addEventListener("pointerleave", () => {
    if (!isDown) return;
    isDown = false;
    releaseVisual(info);
  });
}

function canPlay() {
  return isStarted && !helpOpen;
}

el.addEventListener("lostpointercapture", () => {
  if (!isDown) return;
  isDown = false;
  releaseVisual(info);
});


/* =========================
   Visual press / release
========================= */
function getWhiteKeyEl(octave, noteIndex) {
  return document.querySelector(
    `.whiteKey[data-octave="${octave}"][data-note="${noteIndex}"]`
  );
}

function getBlackKeyEl(octave, acc) {
  return document.querySelector(
    `.blackKey[data-octave="${octave}"][data-acc="${acc}"]`
  );
}

function pressVisual(info) {
  const el = info.kind === "white"
    ? getWhiteKeyEl(info.octave, info.noteIndex)
    : getBlackKeyEl(info.octave, info.acc);

  if (el) el.classList.add("pressed");
}

function releaseVisual(info) {
  const el = info.kind === "white"
    ? getWhiteKeyEl(info.octave, info.noteIndex)
    : getBlackKeyEl(info.octave, info.acc);

  if (el) el.classList.remove("pressed");
}

/* =========================
   Word selection + spawn
========================= */
function nextWordForColumn(noteIndex) {
  const col = clamp(noteIndex, 0, 7);    // 0..7
  const colNum = col + 1;               // 1..8
  const list = WORDS[col];

  // try up to ROWS_PER_COL times to skip empties
  for (let tries = 0; tries < ROWS_PER_COL; tries++) {
    const idx = pointers[col];
    const word = list[idx] ?? "";
    pointers[col] = (pointers[col] + 1) % ROWS_PER_COL;

    if (word && word.trim() !== "") {
      return { word, rowNum: idx + 1, colNum };
    }
  }

  return { word: "", rowNum: 1, colNum };
}

function triggerWordAndAudio(wordColNoteIndex) {
  const { word, rowNum, colNum } = nextWordForColumn(wordColNoteIndex);
  if (!word) return;

  onWordTriggered(word);

  spawnWord(colNum, word);
  playAudio(colNum, rowNum);
}


function spawnWord(colNum, word) {
  const col = clamp(colNum - 1, 0, 7);

  // how many rows can fit (stable, based on step)
  const maxRows = Math.max(1, Math.floor(stage.clientHeight / STACK_STEP));

  // next row in THIS column (always increases top → bottom)
  const rowIndex = colHeights[col] % maxRows;
  colHeights[col] += 1;

  // fixed x center for the column
  const xBase = laneCenters[col] ?? (stage.clientWidth * 0.5);

  // alternate left/right for corner overlap
  const xStagger = (rowIndex % 2 === 0 ? -CORNER_SHIFT : CORNER_SHIFT);

  // stack starts at the very top (TOP_START = 0)
  const x = xBase + xStagger;
  const y = TOP_START + rowIndex * STACK_STEP;

  const box = document.createElement("div");
  box.className = "wordBox";
  box.textContent = word;
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;

  activeLayer.appendChild(box);

  requestAnimationFrame(() => box.classList.add("show"));

  setTimeout(() => {
    box.classList.add("fadeOut");
    setTimeout(() => box.remove(), 520);
  }, 6000);
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
   Lane centers (8 columns)
========================= */
function computeLaneCenters() {
  const w = stage.clientWidth;
  const laneW = w / 8;
  laneCenters = Array.from({ length: 8 }, (_, i) => (i + 0.5) * laneW);
}

/* =========================
   Octave shift + help indicator
========================= */
function handleOctaveKey(k) {
  if (k === "z") baseOctave = clamp(baseOctave - 1, MIN_OCT, MAX_OCT);
  if (k === "x") baseOctave = clamp(baseOctave + 1, MIN_OCT, MAX_OCT);
}

function updateHelpBase() {
  helpOverlay.dataset.base = String(baseOctave);
}

/* =========================
   Help overlay open/close
========================= */
function openHelp() {
  releaseAllPressed(); 
  helpOpen = true;
  showOverlay(helpOverlay);
  helpOverlay.setAttribute("aria-hidden", "false");
}

function closeHelp() {
  releaseAllPressed(); 
  helpOpen = false;
  hideOverlay(helpOverlay);
  helpOverlay.setAttribute("aria-hidden", "true");
}

function toggleHelp() {
  if (helpOpen) closeHelp();
  else openHelp();
}

/* =========================
   Overlay helpers
========================= */
function showOverlay(el) {
  el.classList.add("overlay--show");
}

function hideOverlay(el) {
  el.classList.remove("overlay--show");
  el.setAttribute("aria-hidden", "true");
}

/* =========================
   Helpers
========================= */
function normalizeKey(e) {
  return (e.key || "").toLowerCase();
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getInfoButtonRectInStage() {
  // stage coordinates (we spawn relative to stage)
  const stageRect = stage.getBoundingClientRect();
  const infoRect = infoBtn.getBoundingClientRect();

  return {
    left: infoRect.left - stageRect.left,
    right: infoRect.right - stageRect.left,
    top: infoRect.top - stageRect.top,
    bottom: infoRect.bottom - stageRect.top,
  };
}

function intersects(a, b) {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

function releaseAllPressed() {
  // clear pressed class on every key
  document.querySelectorAll(".whiteKey.pressed, .blackKey.pressed")
    .forEach((el) => el.classList.remove("pressed"));

  // clear held keyboard map so keyup doesn't get confused
  held.clear();
}
