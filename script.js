/* =========================
   WORD BANK (8 columns × 13 rows)
   noteIndex -> column:
   0=C,1=D,2=E,3=F,4=G,5=A,6=B,7=C(high)
========================= */
const WORDS = [
  ["I","world","spice","girl","zig","reason","nothin","talk","(hey)","sporty","fine","deceivin’","gotta"],
  ["infatuation","off","work","spice","girl","weave","ginger","name","my","spice","girl","need","zig"],
  ["a","freaky","don’t","banana","whole","weave","reason","schemin’","spice","girl","posh","time","align"],
  ["zig","ah","zig","ah","zig","spice","girl","ah","zig","ah","zig","ah","zig","ah","zig"],
  ["women","real","posh","so","world","ah","feel","B.S.","my","boujee","pavin’","ways","fuck"],
  ["down","spice","girl","fine","ah","fake","off","infatuation","like","mama","forever","world","nothin'"],
  ["reason","hit","I-5","come","Viva","B.S.","boujee","masters","really","spice","girl","go","aligned"],
  ["weave","want","(hey)","scary","spice","girl","a","need","like","studyin’","tell","fuck","always"],
];

const ROWS_PER_COL = 15;
const pointers = new Array(8).fill(0);

// Note-to-audio mapping (12 chromatic notes)
const NOTE_AUDIO = {
  'C': 'ineedaspicegirl.mp3',
  'C#': 'hey.mp3',
  'D': 'zigahzigah.mp3',
  'D#': 'bs.mp3',
  'E': 'infatuation.mp3',
  'F': 'sheonlyeatbananas.mp3',
  'F#': 'zoom.mp3',
  'G': 'herworldtomyworld.mp3',
  'G#': 'yeahyeah.mp3',
  'A': 'superthievin.mp3',
  'A#': 'spicegirl.mp3',
  'B': 'isthisrealorfake.mp3'
};

// Note-to-words mapping (syllables/words per note)
const NOTE_WORDS = {
  'C': ["I", "need", "a", "spice", "girl"],
  'C#': ["hey!"],
  'D': ["zig", "ah", "zig", "ah"],
  'D#': ["B.S."],
  'E': ["infatuation"],
  'F': ["she", "only", "eat", "bananas"],
  'F#': ["(zoom)"],
  'G': ["her", "world", "to", "my", "world"],
  'G#': ["yeah", "yeah"],
  'A': ["super", "thievin'"],
  'A#': ["spice", "girl"],
  'B': ["is", "this", "real", "or", "fake"]
};

/* =========================
   Octaves
========================= */
let baseOctave = 2;
const MIN_OCT = 1;
const MAX_OCT = 3;

/* =========================
   Mobile detection (matches CSS media query)
========================= */
const mobileMQ = window.matchMedia("(max-width: 600px)");
let isMobile = mobileMQ.matches;

const onMQChange = (e) => {
  isMobile = e.matches;
  buildPiano();
  computeLaneCenters();
};

if (mobileMQ.addEventListener) mobileMQ.addEventListener("change", onMQChange);
else if (mobileMQ.addListener) mobileMQ.addListener(onMQChange); // older Safari

/* =========================
   Keyboard mapping (desktop)
   baseOctave is shifted by Z / X
========================= */
const NOTE_KEYS = {
  a: { kind: "white", noteIndex: 0, octaveOffset: 0, note: 'C' },
  w: { kind: "black", noteIndex: 0, octaveOffset: 0, note: 'C#' },
  s: { kind: "white", noteIndex: 1, octaveOffset: 0, note: 'D' },
  e: { kind: "black", noteIndex: 1, octaveOffset: 0, note: 'D#' },
  d: { kind: "white", noteIndex: 2, octaveOffset: 0, note: 'E' },
  f: { kind: "white", noteIndex: 3, octaveOffset: 0, note: 'F' },
  t: { kind: "black", noteIndex: 3, octaveOffset: 0, note: 'F#' },
  g: { kind: "white", noteIndex: 4, octaveOffset: 0, note: 'G' },
  y: { kind: "black", noteIndex: 4, octaveOffset: 0, note: 'G#' },
  h: { kind: "white", noteIndex: 5, octaveOffset: 0, note: 'A' },
  u: { kind: "black", noteIndex: 5, octaveOffset: 0, note: 'A#' },
  j: { kind: "white", noteIndex: 6, octaveOffset: 0, note: 'B' },
  k: { kind: "white", noteIndex: 7, octaveOffset: 1, note: 'C' },
  o: { kind: "black", noteIndex: 7, octaveOffset: 1, note: 'C#' },
  l: { kind: "white", noteIndex: 8, octaveOffset: 1, note: 'D' },
  p: { kind: "black", noteIndex: 8, octaveOffset: 1, note: 'D#' },
};

/* =========================
   DOM
========================= */
const stage = document.getElementById("stage");
const activeLayer = document.getElementById("activeLayer");
const keyboard = document.getElementById("keyboard");

const startOverlay = document.getElementById("startOverlay");
const playBtn = document.getElementById("playBtn");

const helpOverlay = document.getElementById("helpOverlay");
const closeHelpBtn = document.getElementById("closeHelpBtn");
const infoBtn = document.getElementById("infoBtn");

const octDown = document.getElementById("octDown");
const octUp = document.getElementById("octUp");

const emojiRain = document.getElementById("emojiRain");

/* =========================
   Stage layout
========================= */
const TOP_START = 0;
let STACK_STEP = 38;
const CORNER_SHIFT = 8;
let laneCenters = [];
const colHeights = new Array(8).fill(0);

/* =========================
   State
========================= */
let isStarted = false;
let helpOpen = false;
let isMuted = false;
const held = new Map();

/* =========================
   "spice" → "girl" detector
========================= */
let phraseArmed = false;
let phraseTimer = null;

function normWord(w) {
  return (w || "")
    .toLowerCase()
    .trim()
    .replace(/[’']/g, "'")
    .replace(/[^a-z]/g, "");
}

function resetPhrase() {
  phraseArmed = false;
  if (phraseTimer) clearTimeout(phraseTimer);
  phraseTimer = null;
}

function onWordTriggered(word) {
  const w = normWord(word);

  if (!phraseArmed) {
    if (w === "spice") {
      phraseArmed = true;
      if (phraseTimer) clearTimeout(phraseTimer);
      phraseTimer = setTimeout(resetPhrase, 2200);
    }
    return;
  }

  if (w === "girl") {
    startEmojiRain(2600);
    resetPhrase();
    return;
  }

  if (w === "spice") {
    if (phraseTimer) clearTimeout(phraseTimer);
    phraseTimer = setTimeout(resetPhrase, 2200);
  } else {
    resetPhrase();
  }
}

/* =========================
   Emoji rain
========================= */
const RAIN_EMOJIS = ["🌶️","💅","🫦","⚡️","🙊"];
let rainInterval = null;
let rainStopTimer = null;

function spawnEmojiDrop() {
  if (!emojiRain) return;

  const span = document.createElement("span");
  span.className = "emojiDrop";
  span.textContent = RAIN_EMOJIS[randInt(0, RAIN_EMOJIS.length - 1)];

  span.style.left = `${Math.random() * 100}%`;
  span.style.fontSize = `${22 + Math.random() * 26}px`;
  span.style.setProperty("--dur", `${1.1 + Math.random() * 1.2}s`);
  span.style.setProperty("--drift", `${-40 + Math.random() * 80}px`);

  span.addEventListener("animationend", () => span.remove());
  emojiRain.appendChild(span);
}

function startEmojiRain(durationMs = 2600) {
  if (!emojiRain) return;

  if (rainInterval) clearInterval(rainInterval);
  if (rainStopTimer) clearTimeout(rainStopTimer);
  emojiRain.replaceChildren();

  rainInterval = setInterval(spawnEmojiDrop, 70);

  rainStopTimer = setTimeout(() => {
    if (rainInterval) clearInterval(rainInterval);
    rainInterval = null;
    setTimeout(() => emojiRain.replaceChildren(), 1600);
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
playBtn?.addEventListener("click", () => {
  isStarted = true;
  document.body.classList.add("started");
  updateOctaveUI();
  hideOverlay(startOverlay);
  setTimeout(openHelp, 350);
});

infoBtn?.addEventListener("click", () => {
  if (!isStarted) return;
  toggleHelp();
});

closeHelpBtn?.addEventListener("click", closeHelp);

helpOverlay?.addEventListener("click", (e) => {
  if (e.target === helpOverlay) closeHelp();
});

/* Mobile -1/+1 octave buttons */
octDown?.addEventListener("click", (e) => {
  if (!isStarted) return;
  if (baseOctave === MIN_OCT) return;

  e.target.classList.add("btn-pressed");
  baseOctave = clamp(baseOctave - 1, MIN_OCT, MAX_OCT);
  if (isMobile) buildPiano();

  setTimeout(() => {
    e.target.classList.remove("btn-pressed");
    updateOctaveUI();
  }, 400);
});

octUp?.addEventListener("click", (e) => {
  if (!isStarted) return;
  if (baseOctave === MAX_OCT) return;

  e.target.classList.add("btn-pressed");
  baseOctave = clamp(baseOctave + 1, MIN_OCT, MAX_OCT);
  if (isMobile) buildPiano();

  setTimeout(() => {
    e.target.classList.remove("btn-pressed");
    updateOctaveUI();
  }, 400);
});

/* =========================
   Keyboard events (desktop)
========================= */
window.addEventListener("keydown", (e) => {
  if (!isStarted) return;
  if (e.repeat) return;

  const k = normalizeKey(e);

  if (k === "escape") {
    if (helpOpen) closeHelp();
    return;
  }

  if (k === "m") {
    isMuted = !isMuted;
    return;
  }

  // Z/X octave shift stays desktop-only
  if (!isMobile && (k === "z" || k === "x")) {
    handleOctaveKey(k);
    return;
  }

  if (helpOpen) return;

  const map = NOTE_KEYS[k];
  if (!map) return;

  const octave = clamp(baseOctave + (map.octaveOffset || 0), MIN_OCT, MAX_OCT);

  const pressInfo = map.kind === "white"
    ? { kind: "white", octave, noteIndex: map.noteIndex, wordColNoteIndex: map.noteIndex }
    : { kind: "black", octave, acc: map.acc, wordColNoteIndex: map.wordColNoteIndex };

  held.set(k, pressInfo);
  pressVisual(pressInfo);
  triggerWordAndAudio(pressInfo.wordColNoteIndex, map.note, octave);
});

window.addEventListener("keyup", (e) => {
  if (!isStarted) return;

  const k = normalizeKey(e);
  const info = held.get(k);
  if (!info) return;

  releaseVisual(info);
  held.delete(k);
});

/* =========================
   Build piano
   Desktop: 3 octaves (24 white)
   Phone: 1 octave (8 white) using baseOctave
========================= */
function buildPiano() {
  if (!keyboard) return;

  keyboard.innerHTML = "";

 const octavesToBuild = isMobile ? 1 : 3;
  const totalWhite = octavesToBuild * 7;

  for (let o = 0; o < octavesToBuild; o++) {
    const octave = isMobile ? baseOctave : (o + 1);

    for (let noteIndex = 0; noteIndex < 7; noteIndex++) {
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

  const blackSpecs = [
    { after: 0, acc: "cs", wordColNoteIndex: 0, note: 'C#' },
    { after: 1, acc: "ds", wordColNoteIndex: 1, note: 'D#' },
    { after: 3, acc: "fs", wordColNoteIndex: 3, note: 'F#' },
    { after: 4, acc: "gs", wordColNoteIndex: 4, note: 'G#' },
    { after: 5, acc: "as", wordColNoteIndex: 5, note: 'A#' },
  ];

  for (let o = 0; o < octavesToBuild; o++) {
    const octave = isMobile ? baseOctave : (o + 1);

    blackSpecs.forEach((b) => {
      const bk = document.createElement("button");
      bk.type = "button";
      bk.className = "blackKey";
      bk.dataset.octave = String(octave);
      bk.dataset.acc = b.acc;

      const boundary = o * 7 + (b.after + 1);
      bk.style.left = `${(boundary / totalWhite) * 100}%`;

      attachPointerKey(bk, {
        kind: "black",
        octave,
        acc: b.acc,
        wordColNoteIndex: b.wordColNoteIndex,
        note: b.note,
      });

      keyboard.appendChild(bk);
    });
  }
}

/* =========================
   Pointer play
========================= */
function attachPointerKey(el, info) {
  let isDown = false;

  el.addEventListener("pointerdown", (e) => {
    if (!canPlay()) return;
    e.preventDefault();
    isDown = true;
    el.setPointerCapture?.(e.pointerId);

    pressVisual(info);
    
    // Get the note - for black keys it's already in info, for white keys look it up
    let note = info.note;
    if (!note && info.kind === "white") {
      const noteKey = Object.values(NOTE_KEYS).find(k => 
        k.kind === "white" && k.noteIndex === info.wordColNoteIndex && k.octaveOffset === 0
      );
      note = noteKey?.note;
    }
    
    if (note) {
      triggerWordAndAudio(info.wordColNoteIndex, note, info.octave);
    }
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

  el.addEventListener("lostpointercapture", () => {
    if (!isDown) return;
    isDown = false;
    releaseVisual(info);
  });
}

function canPlay() {
  return isStarted && !helpOpen;
}

/* =========================
   Visual press / release
========================= */
function getWhiteKeyEl(octave, noteIndex) {
  return document.querySelector(`.whiteKey[data-octave="${octave}"][data-note="${noteIndex}"]`);
}

function getBlackKeyEl(octave, acc) {
  return document.querySelector(`.blackKey[data-octave="${octave}"][data-acc="${acc}"]`);
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
   Words + audio
========================= */
function nextWordForColumn(noteIndex) {
  const col = clamp(noteIndex, 0, 7);
  const colNum = col + 1;
  const list = WORDS[col];

  for (let tries = 0; tries < ROWS_PER_COL; tries++) {
    const idx = pointers[col];
    const word = list[idx] ?? "";
    pointers[col] = (pointers[col] + 1) % ROWS_PER_COL;

    if (word && word.trim() !== "") return { word, rowNum: idx + 1, colNum };
  }

  return { word: "", rowNum: 1, colNum };
}

function triggerWordAndAudio(wordColNoteIndex, note, octave) {
  if (!note) return;
  
  const words = NOTE_WORDS[note];
  if (!words) return;
  
  // Spawn all textboxes for this note
  words.forEach((word, index) => {
    setTimeout(() => {
      onWordTriggered(word);
      spawnWord(word, wordColNoteIndex, octave);
    }, index * 120);
  });
  
  // Play audio
  playAudio(note, octave);
}

function spawnWord(word, noteIndex, octave) {
  if (!stage || !activeLayer) return;

  const col = clamp(noteIndex, 0, 7);
  const maxRows = Math.max(1, Math.floor(stage.clientHeight / STACK_STEP));
  const rowIndex = colHeights[col] % maxRows;
  colHeights[col] += 1;

  const xBase = laneCenters[col] ?? (stage.clientWidth * 0.5);
  const xStagger = (rowIndex % 2 === 0 ? -CORNER_SHIFT : CORNER_SHIFT);

  const randX = (Math.random() - 0.5) * 24;

  // Pin last row flush to piano top; only apply vertical drift to other rows
  const isLastRow = rowIndex === maxRows - 1;
  const isFirstRow = rowIndex === 0;

  // No vertical drift on first or last row — pin them to top and bottom
  const randY = (isFirstRow || isLastRow) ? 0 : (Math.random() - 0.5) * 10;

  const x = xBase + xStagger + randX;
  const y = isLastRow
    ? stage.clientHeight - STACK_STEP
    : isFirstRow
      ? 0
      : TOP_START + rowIndex * STACK_STEP + randY;

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

function playAudio(note, octave) {
  if (isMuted) return;
  
  const filename = NOTE_AUDIO[note];
  if (!filename) return;
  
  const src = `./audio/${filename}`;
  const audio = new Audio(src);
  
  // Pitch shift by ±5 semitones based on octave (octave 2 = normal pitch)
  // Octave 1 (blue) = -5 semitones, Octave 2 (yellow) = normal, Octave 3 (pink) = +5 semitones
  const semitoneOffset = (octave - 3) * 5; // -5, 0, or +5
  audio.playbackRate = Math.pow(2, semitoneOffset / 12);
  
  audio.play().catch(() => {});
}

/* =========================
   Lane centers
   Desktop: 8 columns
   Phone: group into 3 stacks like your screenshot
========================= */
function computeLaneCenters() {
  if (!stage) return;

  const w = stage.clientWidth;
  if (!w) return;

  // Divide stage height into exact equal rows — no gap at top or bottom
  const stageH = stage.clientHeight;
  const maxRows = Math.max(1, Math.floor(stageH / (isMobile ? 36 : 44)));
  STACK_STEP = stageH / maxRows;

  // Sync word box height to row height so boxes tile perfectly top-to-bottom
  document.documentElement.style.setProperty('--word-box-h', `${STACK_STEP}px`);

  if (isMobile) {
    const laneW = w / 3;
    const left = 0.5 * laneW;
    const mid = 1.5 * laneW;
    const right = 2.5 * laneW;
    laneCenters = [left, left, left, mid, mid, right, right, right];
  } else {
    const laneW = w / 8;
    laneCenters = Array.from({ length: 8 }, (_, i) => (i + 0.5) * laneW);
  }
}

/* =========================
   Octave shift (desktop)
========================= */
function handleOctaveKey(k) {
  if (k === "z") baseOctave = clamp(baseOctave - 1, MIN_OCT, MAX_OCT);
  if (k === "x") baseOctave = clamp(baseOctave + 1, MIN_OCT, MAX_OCT);
}

/* =========================
   Help overlay
========================= */
function openHelp() {
  releaseAllPressed();
  helpOpen = true;
  showOverlay(helpOverlay);
}

function closeHelp() {
  releaseAllPressed();
  helpOpen = false;
  hideOverlay(helpOverlay);
}

function toggleHelp() {
  if (helpOpen) closeHelp();
  else openHelp();
}

function showOverlay(el) {
  if (!el) return;
  el.classList.add("overlay--show");
  el.setAttribute("aria-hidden", "false");
}

function hideOverlay(el) {
  if (!el) return;
  el.classList.remove("overlay--show");
  el.setAttribute("aria-hidden", "true");
}

/* =========================
   Update octave UI
========================= */
function updateOctaveUI() {
  // Remove all octave classes
  document.body.classList.remove("octave-1", "octave-2", "octave-3");
  // Add current octave class
  document.body.classList.add(`octave-${baseOctave}`);
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

function releaseAllPressed() {
  document.querySelectorAll(".whiteKey.pressed, .blackKey.pressed")
    .forEach((el) => el.classList.remove("pressed"));
  held.clear();
}
