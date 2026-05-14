var app = document.getElementById("app");
var noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var whiteNotes = ["A2", "B2", "C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
var blackAfter = { A: true, C: true, D: true, F: true, G: true };
var storageKey = "shengyuebao-v3";
var oldStorageKey = "shengyuebao-v2";
var directions = [{ id: "up", label: "自动上行 ↑" }, { id: "down", label: "自动下行 ↓" }, { id: "repeat", label: "重复 ↻" }];
var solfege = [
  { label: "1", offset: 0 }, { label: "2", offset: 2 }, { label: "3", offset: 4 }, { label: "4", offset: 5 },
  { label: "5", offset: 7 }, { label: "6", offset: 9 }, { label: "7", offset: 11 }, { label: "0", offset: 0, rest: true }
];
var defaults = [
  { id: "scale-1", name: "音阶1", events: events(["1", "2", "3", "4", "5", "4", "3", "2", "1"], 0.5) },
  { id: "scale-2", name: "音阶2", events: events(["1", "3", "5", "i", "5", "3", "1"], 0.5) },
  { id: "scale-3", name: "音阶3", events: events(["1", "3", "2", "4", "3", "5", "4", "2", "1"], 0.5) },
  { id: "scale-4", name: "音阶4", events: events(["5", "4", "3", "2", "1"], 1) },
  { id: "scale-5", name: "音阶5", events: events(["5", "4", "3", "2", "1"], 0.5) },
  { id: "scale-6", name: "音阶6", events: events(["1", "2", "3", "2", "1"], 1) },
  { id: "scale-7", name: "音阶7", events: events(["1", "3", "5", "3", "1"], 1) },
  { id: "scale-8", name: "音阶8", events: events(["5", "3", "1", "0", "1", "2", "3", "2", "1"], 0.5) }
];
var pianoSamples = [
  { note: "A2", midi: 45, url: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/A2.mp3" },
  { note: "A#2", midi: 46, url: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/Bb2.mp3" },
  { note: "C3", midi: 48, url: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/C3.mp3" },
  { note: "D3", midi: 50, url: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/D3.mp3" },
  { note: "D#3", midi: 51, url: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/Eb3.mp3" },
  { note: "F3", midi: 53, url: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/F3.mp3" },
  { note: "F#3", midi: 54, url: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/Gb3.mp3" },
  { note: "A3", midi: 57, url: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/A3.mp3" },
  { note: "C4", midi: 60, url: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/C4.mp3" },
  { note: "D4", midi: 62, url: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/D4.mp3" },
  { note: "D#4", midi: 63, url: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/Eb4.mp3" },
  { note: "F4", midi: 65, url: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/F4.mp3" },
  { note: "F#4", midi: 66, url: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/Gb4.mp3" },
  { note: "A4", midi: 69, url: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/A4.mp3" },
  { note: "C5", midi: 72, url: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/C5.mp3" }
];
var saved = loadState();
var scales = saved.scales;
var selectedScaleId = saved.selectedScaleId || scales[0].id;
var editorDraft = cloneEvents(scale().events);
var editingScaleId = selectedScaleId;
var bpm = saved.bpm || 95;
var startNote = saved.startNote || "E3";
var direction = saved.direction || "up";
var selectedDuration = saved.selectedDuration || 0.5;
var inputOctaveShift = 0;
var isPlaying = false;
var activeNote = "";
var activeChord = [];
var activeEventIndex = -1;
var playStage = "";
var editorOpen = false;
var audioCtx = null;
var sampleCache = {};
var sampleLoading = {};
var sampleStatus = "idle";
var preloadPromise = null;
var timers = [];
var scrollRestore = null;

function render() {
  if (!app) return;
  var keyboard = document.querySelector("[data-keyboard]");
  if (keyboard) scrollRestore = keyboard.scrollLeft;
  app.innerHTML = editorOpen ? editorPage() : practicePage();
  bind();
  restoreScroll();
}

function practicePage() {
  return '<section class="phone-page practice-page">' +
    '<header class="topbar"><button class="icon-button" aria-label="返回"><span class="back-icon"></span></button><h1 class="title">音阶练习</h1><span></span></header>' +
    '<section class="panel melody-panel simple-panel current-card"><div class="scale-toolbar">' +
    '<button class="scale-select" data-action="open-editor"><span class="scale-name">' + scale().name + '</span><span class="edit-badge" aria-hidden="true">✎</span></button>' +
    '<div class="tempo"><span class="tempo-label">速度</span><button class="round-control" data-action="tempo-down">-</button><span class="bpm-value">' + bpm + 'BPM</span><button class="round-control" data-action="tempo-up">+</button></div>' +
    '</div><div class="score-frame"><div class="score-line">' + score(scale().events) + '</div></div><div class="sound-status">' + statusText() + '</div></section>' +
    piano() + '</section>';
}

function editorPage() {
  return '<section class="phone-page practice-page editor-page">' +
    '<header class="topbar editor-topbar"><button class="icon-button" data-action="close-editor"><span class="back-icon"></span></button><h1 class="title">编辑音阶</h1><button class="save-link" data-action="save-scale">保存</button></header>' +
    '<section class="panel editor-preview"><div class="editor-meter"><h2>2/4拍</h2><span>' + beats(editorDraft) + '/8</span></div><div class="score-frame editor-score-frame"><div class="score-line editor-score">' + score(editorDraft) + '</div></div></section>' +
    '<section class="panel scale-editor-panel"><div class="section-head"><h2 class="voice-title">音阶组</h2><div class="editor-tools"><button class="tool-icon" data-action="delete-scale">⌫</button><button class="tool-icon" data-action="clear-draft">清空</button></div></div><div class="scale-chip-grid">' + chips() + '</div></section>' +
    '<section class="edit-pad"><div class="pad-grid">' + pad() + '</div></section></section>';
}

function score(list) {
  if (!list.length) return '<span class="tonic-stack"><span>5</span><span>3</span><span>1</span></span><span class="notation empty-notation"><span class="bar">|</span><span class="empty-note">点击下方音符输入</span><span class="bar">||</span></span>';
  return '<span class="tonic-stack"><span>5</span><span>3</span><span>1</span></span><span class="notation"><span class="bar">|</span>' +
    list.map(function (e, i) {
      e = norm(e);
      var cls = i === activeEventIndex && playStage === "melody" ? " active-note" : "";
      return '<span class="note-token' + cls + '">' + noteView(e) + '</span>' + ((i + 1) % 2 === 0 && i !== list.length - 1 ? '<span class="bar">|</span>' : "");
    }).join("") + '<span class="bar">||</span></span>';
}

function noteView(e) {
  if (e.rest) return "－";
  var shift = e.offset - baseOffset(e.label);
  var dot = shift >= 12 ? '<span class="tone-dot top"></span>' : shift <= -12 ? '<span class="tone-dot bottom"></span>' : "";
  return '<span class="tone-note">' + (shift >= 12 ? dot : "") + '<span>' + e.label + '</span>' + (shift <= -12 ? dot : "") + '</span>';
}

function padNoteView(label) {
  if (label === "0") return label;
  var dot = inputOctaveShift > 0 ? '<span class="tone-dot top"></span>' : inputOctaveShift < 0 ? '<span class="tone-dot bottom"></span>' : "";
  return '<span class="tone-note">' + (inputOctaveShift > 0 ? dot : "") + '<span>' + label + '</span>' + (inputOctaveShift < 0 ? dot : "") + '</span>';
}

function piano() {
  var mini = "";
  for (var i = 0; i < 64; i += 1) mini += '<button class="mini-key ' + (i % 7 === 1 || i % 7 === 4 ? "black" : "") + '" data-track="' + i + '"></button>';
  var keys = "";
  var left = 82;
  whiteNotes.forEach(function (note, j) {
    var sharp = midiToNote(noteToMidi(note) + 1);
    if (blackAfter[note.charAt(0)] && j < whiteNotes.length - 1) keys += '<button class="black-key ' + (isKeyActive(sharp) ? "active" : "") + '" style="left:' + left + 'px" data-note="' + sharp + '"></button>';
    keys += '<button class="white-key ' + (isKeyActive(note) ? "active" : "") + '" data-note="' + note + '">' + note + '</button>';
    left += 82;
  });
  return '<section class="piano-dock"><div class="piano-action-row"><button class="loop-button" data-action="cycle-direction">' + dirLabel() + '</button></div><div class="piano-track-wrap"><div class="mini-piano">' + mini + '<span class="track-window"></span></div></div><div class="keyboard" data-keyboard>' + keys + '</div></section>';
}

function chips() {
  return scales.map(function (s) {
    return '<button class="scale-chip ' + (s.id === selectedScaleId ? "active" : "") + '" data-scale="' + s.id + '">' + s.name + '</button>';
  }).join("") + '<button class="scale-chip add-chip" data-action="add-scale">+</button>';
}

function pad() {
  var cells = ["1/2", "1", "2", "3", "八度+1", "1/4", "4", "5", "6", "八度-1", "1/8", "7", "0", "重置", "⌫"];
  return cells.map(function (label) {
    if (label === "1/2") return durationKey(0.5, label);
    if (label === "1/4") return durationKey(1, label);
    if (label === "1/8") return durationKey(0.25, label);
    if (label === "八度+1") return '<button class="pad-key ' + (inputOctaveShift > 0 ? "active" : "") + '" data-action="octave-up">' + label + '</button>';
    if (label === "八度-1") return '<button class="pad-key ' + (inputOctaveShift < 0 ? "active" : "") + '" data-action="octave-down">' + label + '</button>';
    if (label === "重置") return '<button class="pad-key" data-action="reset-draft">' + label + '</button>';
    if (label === "⌫") return '<button class="pad-key delete-key" data-action="delete-last">' + label + '</button>';
    return '<button class="pad-key note-key" data-add-note="' + label + '">' + padNoteView(label) + '<span></span></button>';
  }).join("");
}

function durationKey(beats, label) {
  return '<button class="pad-key duration-key ' + (selectedDuration === beats ? "active" : "") + '" data-duration="' + beats + '">' + label + '</button>';
}

function bind() {
  bindAll("[data-action]", "click", action);
  bindAll("[data-scale]", "click", selectScale);
  bindAll("[data-add-note]", "click", addNote);
  bindAll("[data-duration]", "click", duration);
  bindAll("[data-track]", "click", track);
  bindAll("[data-note]", "click", key);
  var kb = document.querySelector("[data-keyboard]");
  if (kb) kb.addEventListener("scroll", function () { scrollRestore = kb.scrollLeft; updateTrackWindow(); });
}

function bindAll(selector, eventName, handler) {
  var nodes = document.querySelectorAll(selector);
  for (var i = 0; i < nodes.length; i += 1) nodes[i].addEventListener(eventName, handler, false);
}

function action(e) {
  var a = e.currentTarget.getAttribute("data-action");
  if (a === "open-editor") { editorDraft = cloneEvents(scale().events); editingScaleId = selectedScaleId; editorOpen = true; stop(); }
  if (a === "close-editor") editorOpen = false;
  if (a === "save-scale") saveScale();
  if (a === "tempo-down") bpm = Math.max(50, bpm - 5);
  if (a === "tempo-up") bpm = Math.min(180, bpm + 5);
  if (a === "cycle-direction") direction = directions[(dirIndex() + 1) % directions.length].id;
  if (a === "clear-draft") editorDraft = [];
  if (a === "delete-last") editorDraft.pop();
  if (a === "reset-draft") editorDraft = cloneEvents(scale().events);
  if (a === "add-scale") addScale();
  if (a === "delete-scale") deleteScale();
  if (a === "octave-up") inputOctaveShift = inputOctaveShift === 12 ? 0 : 12;
  if (a === "octave-down") inputOctaveShift = inputOctaveShift === -12 ? 0 : -12;
  saveState();
  render();
}

function selectScale(e) {
  selectedScaleId = e.currentTarget.getAttribute("data-scale");
  editingScaleId = selectedScaleId;
  editorDraft = cloneEvents(scale().events);
  stop();
  saveState();
  render();
}

function addNote(e) {
  var note = solfegeByLabel(e.currentTarget.getAttribute("data-add-note"));
  if (!note || beats(editorDraft) + selectedDuration > 8) return;
  editorDraft.push({ label: note.rest ? "0" : note.label, offset: note.offset + (note.rest ? 0 : inputOctaveShift), beats: selectedDuration, rest: !!note.rest });
  render();
}

function duration(e) {
  selectedDuration = Number(e.currentTarget.getAttribute("data-duration"));
  saveState();
  render();
}

function key(e) {
  e.preventDefault();
  if (isPlaying) {
    stop();
    render();
    return;
  }
  startNote = e.currentTarget.getAttribute("data-note");
  stop();
  saveState();
  startFrom(startNote);
}

function track(e) {
  var kb = document.querySelector("[data-keyboard]");
  if (!kb) return;
  var max = Math.max(0, kb.scrollWidth - kb.clientWidth);
  kb.scrollLeft = max * (Number(e.currentTarget.getAttribute("data-track")) / 63);
  scrollRestore = kb.scrollLeft;
  updateTrackWindow();
}

function addScale() {
  var s = { id: "scale-" + Date.now(), name: "音阶" + (scales.length + 1), events: [] };
  scales.push(s);
  selectedScaleId = s.id;
  editingScaleId = s.id;
  editorDraft = cloneEvents(s.events);
}

function deleteScale() {
  if (scales.length <= 1) { editorDraft = []; return; }
  var i = scaleIndex(selectedScaleId);
  if (i >= 0) scales.splice(i, 1);
  selectedScaleId = scales[Math.max(0, i - 1)].id;
  editingScaleId = selectedScaleId;
  editorDraft = cloneEvents(scale().events);
}

function saveScale() {
  var i = scaleIndex(editingScaleId);
  if (i < 0) i = scaleIndex(selectedScaleId);
  scales[i].events = cloneEvents(editorDraft);
  selectedScaleId = scales[i].id;
  editorOpen = false;
  stop();
  saveState();
}

function startFrom(note) {
  if (!scale().events.length || sampleStatus === "loading") return;
  ensureAudio();
  if (!hasSamples()) {
    sampleStatus = "loading";
    render();
    preloadSamples().then(function () { if (sampleStatus === "ready") startFrom(note); else render(); });
    return;
  }
  isPlaying = true;
  scheduleRound(noteToMidi(note));
  render();
}

function scheduleRound(base) {
  if (!isPlaying) return;
  var list = scale().events;
  var beatMs = 60000 / bpm;
  var cursor = 0;
  var chord = [base, base + 4, base + 7];
  stage("prep", -1, chord, cursor);
  chordAt(chord, 1.15, cursor);
  cursor += 1150;
  stage("breath", -1, [], cursor);
  cursor += 1000;
  list.forEach(function (ev, i) {
    ev = norm(ev);
    timers.push(setTimeout(function () {
      if (!isPlaying) return;
      playStage = "melody";
      activeEventIndex = i;
      activeChord = [];
      activeNote = "";
      if (!ev.rest) {
        var midi = base + ev.offset;
        playNote(midi, ev.beats * beatMs / 1000, 0);
        activeNote = midiToNote(midi);
      }
      live();
    }, cursor));
    cursor += ev.beats * beatMs;
  });
  stage("closing", -1, chord, cursor);
  chordAt(chord, 1, cursor);
  cursor += 1000;
  stage("breath", -1, [], cursor);
  cursor += 1000;
  timers.push(setTimeout(function () {
    var next = nextBase(base);
    if (next === null) { stop(); render(); return; }
    scheduleRound(next);
  }, cursor));
}

function stage(name, index, chord, delay) {
  timers.push(setTimeout(function () {
    if (!isPlaying) return;
    playStage = name;
    activeEventIndex = index;
    activeChord = chord || [];
    activeNote = "";
    live();
  }, delay));
}

function chordAt(midis, duration, delay) {
  timers.push(setTimeout(function () { if (isPlaying) midis.forEach(function (m, i) { playNote(m, duration, i * 0.006); }); }, delay));
}

function nextBase(base) {
  var next = base;
  if (direction === "up") next += 1;
  if (direction === "down") next -= 1;
  if (next + maxOffset() > noteToMidi("C5") || next + minOffset() < noteToMidi("A2")) return null;
  return next;
}

function stop() {
  timers.forEach(clearTimeout);
  timers = [];
  isPlaying = false;
  activeNote = "";
  activeChord = [];
  activeEventIndex = -1;
  playStage = "";
}

function ensureAudio() {
  var AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended" && audioCtx.resume) audioCtx.resume();
  preloadSamples();
}

function preloadSamples() {
  if (!audioCtx) return Promise.resolve(false);
  if (hasSamples()) { sampleStatus = "ready"; return Promise.resolve(true); }
  if (preloadPromise) return preloadPromise;
  sampleStatus = "loading";
  preloadPromise = Promise.allSettled(pianoSamples.map(loadSample)).then(function () {
    sampleStatus = hasSamples() ? "ready" : "error";
    preloadPromise = null;
    render();
    return sampleStatus === "ready";
  });
  return preloadPromise;
}

function loadSample(s) {
  if (sampleCache[s.note]) return Promise.resolve(sampleCache[s.note]);
  if (sampleLoading[s.note]) return sampleLoading[s.note];
  sampleLoading[s.note] = fetch(s.url).then(function (r) { if (!r.ok) throw new Error("sample"); return r.arrayBuffer(); }).then(function (b) {
    return audioCtx.decodeAudioData(b);
  }).then(function (buffer) {
    sampleCache[s.note] = buffer;
    sampleLoading[s.note] = null;
    return buffer;
  }).catch(function () {
    sampleLoading[s.note] = null;
    return null;
  });
  return sampleLoading[s.note];
}

function playNote(midi, duration, delay) {
  ensureAudio();
  if (!audioCtx) return;
  var s = nearestSample(midi);
  if (!s) return;
  var source = audioCtx.createBufferSource();
  var gain = audioCtx.createGain();
  var filter = audioCtx.createBiquadFilter();
  var now = audioCtx.currentTime + (delay || 0);
  var release = Math.min(0.18, Math.max(0.06, duration * 0.22));
  source.buffer = sampleCache[s.note];
  source.playbackRate.setValueAtTime(Math.pow(2, (midi - s.midi) / 12), now);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(7600, now);
  filter.Q.setValueAtTime(0.2, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.86, now + 0.012);
  gain.gain.setValueAtTime(0.86, now + Math.max(0.03, duration - release));
  gain.gain.linearRampToValueAtTime(0.0001, now + duration + release);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  source.start(now);
  source.stop(now + duration + release + 0.05);
}

function nearestSample(midi) {
  var best = null, dist = Infinity;
  pianoSamples.forEach(function (s) {
    if (!sampleCache[s.note]) return;
    var d = Math.abs(s.midi - midi);
    if (d < dist) { best = s; dist = d; }
  });
  return best;
}

function hasSamples() {
  return pianoSamples.some(function (s) { return !!sampleCache[s.note]; });
}

function live() {
  document.querySelectorAll(".note-token").forEach(function (n, i) { n.classList.toggle("active-note", i === activeEventIndex && playStage === "melody"); });
  document.querySelectorAll("[data-note]").forEach(function (k) { k.classList.toggle("active", isKeyActive(k.getAttribute("data-note"))); });
}

function isKeyActive(note) {
  if (note === startNote || note === activeNote) return true;
  var midi = noteToMidi(note);
  return activeChord.indexOf(midi) >= 0;
}

function statusText() {
  if (sampleStatus === "loading") return "正在加载钢琴音色";
  if (sampleStatus === "error") return "钢琴采样加载失败，请换网络刷新";
  return isPlaying ? "再次点击琴键停止" : "点击任一琴键开始";
}

function loadState() {
  try {
    var saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && saved.scales && saved.scales.length) { saved.scales = migrate(saved.scales); return saved; }
  } catch (e) {}
  try {
    var old = JSON.parse(localStorage.getItem(oldStorageKey) || "null");
    if (old && old.melodies && old.melodies.length) return { scales: migrate(old.melodies), selectedScaleId: old.selectedMelodyId, bpm: old.bpm, startNote: old.startNote, direction: old.direction, selectedDuration: old.selectedDuration };
  } catch (e2) {}
  return { scales: cloneScales(defaults) };
}

function saveState() {
  try { localStorage.setItem(storageKey, JSON.stringify({ scales: scales, selectedScaleId: selectedScaleId, bpm: bpm, startNote: startNote, direction: direction, selectedDuration: selectedDuration })); } catch (e) {}
}

function migrate(list) {
  var output = list.map(function (s, i) { return { id: s.id || "scale-" + (i + 1), name: s.name || "音阶" + (i + 1), events: s.events ? cloneEvents(s.events) : [] }; });
  return output.length ? output : cloneScales(defaults);
}

function cloneScales(list) {
  return list.map(function (s) { return { id: s.id, name: s.name, events: cloneEvents(s.events) }; });
}

function cloneEvents(list) {
  return list.map(function (e) { e = norm(e); return { label: e.label, offset: e.offset, beats: e.beats, rest: e.rest }; });
}

function events(labels, beat) {
  return labels.map(function (label) {
    if (label === "i") return { label: "1", offset: 12, beats: beat, rest: false };
    var n = solfegeByLabel(label);
    return { label: n.rest ? "0" : n.label, offset: n.offset, beats: beat, rest: !!n.rest };
  });
}

function norm(e) {
  return { label: e.label || "1", offset: Number(e.offset || 0), beats: Number(e.beats || 0.5), rest: !!e.rest || e.label === "0" };
}

function scale() {
  return scales[scaleIndex(selectedScaleId)] || scales[0];
}

function scaleIndex(id) {
  for (var i = 0; i < scales.length; i += 1) if (scales[i].id === id) return i;
  return -1;
}

function solfegeByLabel(label) {
  for (var i = 0; i < solfege.length; i += 1) if (solfege[i].label === label) return solfege[i];
  return null;
}

function beats(list) {
  return list.reduce(function (sum, e) { return sum + norm(e).beats; }, 0);
}

function maxOffset() {
  return scale().events.reduce(function (m, e) { e = norm(e); return !e.rest && e.offset > m ? e.offset : m; }, 0);
}

function minOffset() {
  return scale().events.reduce(function (m, e) { e = norm(e); return !e.rest && e.offset < m ? e.offset : m; }, 0);
}

function dirIndex() {
  for (var i = 0; i < directions.length; i += 1) if (directions[i].id === direction) return i;
  return 0;
}

function dirLabel() {
  return directions[dirIndex()].label;
}

function noteToMidi(note) {
  var m = /^([A-G])(#?)(\d)$/.exec(note);
  if (!m) return 60;
  return (Number(m[3]) + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
}

function midiToNote(midi) {
  return noteNames[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

function restoreScroll() {
  var kb = document.querySelector("[data-keyboard]");
  if (!kb) return;
  if (scrollRestore !== null) kb.scrollLeft = scrollRestore;
  else {
    var keyNode = document.querySelector('[data-note="' + startNote + '"]');
    if (keyNode && keyNode.scrollIntoView) keyNode.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
  }
  updateTrackWindow();
}

function updateTrackWindow() {
  var kb = document.querySelector("[data-keyboard]");
  var win = document.querySelector(".track-window");
  if (!kb || !win) return;
  var max = Math.max(1, kb.scrollWidth - kb.clientWidth);
  var percent = kb.scrollLeft / max;
  var width = Math.max(38, Math.min(98, (kb.clientWidth / kb.scrollWidth) * 100));
  var left = Math.max(0, Math.min(100 - width, percent * (100 - width)));
  win.style.width = width + "%";
  win.style.left = left + "%";
}

function baseOffset(label) {
  var note = solfegeByLabel(label);
  return note ? note.offset : 0;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render, false);
else render();
