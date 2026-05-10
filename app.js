var app = document.getElementById("app");

var noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var whiteNotes = ["A2", "B2", "C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4", "B4"];
var blackAfter = { A: true, C: true, D: true, F: true, G: true };
var storageKey = "shengyuebao-v2";

var directionOptions = [
  { id: "up", label: "上行" },
  { id: "down", label: "下行" },
  { id: "repeat", label: "重复" }
];

var meterOptions = [
  { beats: 4, label: "4/4" },
  { beats: 3, label: "3/4" },
  { beats: 2, label: "2/4" }
];

var durationOptions = [
  { beats: 0.5, label: "♪", name: "八分" },
  { beats: 1, label: "♩", name: "四分" },
  { beats: 2, label: "𝅗𝅥", name: "二分" },
  { beats: 4, label: "𝅝", name: "全音" }
];

var solfege = [
  { label: "1", offset: 0 },
  { label: "2", offset: 2 },
  { label: "3", offset: 4 },
  { label: "4", offset: 5 },
  { label: "5", offset: 7 },
  { label: "6", offset: 9 },
  { label: "7", offset: 11 },
  { label: "i", offset: 12 }
];

var defaultMelodies = [
  {
    id: "classic",
    name: "开嗓上行",
    events: buildEvents(["1", "2", "3", "4", "5", "4", "3", "2", "1"], 0.5)
  },
  {
    id: "triad",
    name: "三和弦",
    events: buildEvents(["1", "3", "5", "i", "5", "3", "1"], 1)
  },
  {
    id: "hum",
    name: "轻哼鸣",
    events: buildEvents(["1", "3", "2", "4", "3", "5", "4", "2", "1"], 0.5)
  }
];

var state = loadState();
var melodies = state.melodies;
var selectedMelodyId = state.selectedMelodyId || melodies[0].id;
var editorDraft = cloneEvents(selectedMelody().events);
var bpm = state.bpm || 130;
var beatsPerBar = state.beatsPerBar || 4;
var startNote = state.startNote || "C3";
var direction = state.direction || "up";
var selectedDuration = state.selectedDuration || 0.5;
var isPlaying = false;
var activeNote = "";
var activeChord = [];
var activeEventIndex = -1;
var playStage = "";
var melodySheetOpen = false;
var editorOpen = false;
var audioCtx = null;
var sampleCache = {};
var sampleLoading = {};
var sampleStatus = "idle";
var preloadPromise = null;
var playTimers = [];
var pianoSamples = [
  { note: "A2", midi: 45, url: "https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/piano/A2.mp3" },
  { note: "C3", midi: 48, url: "https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/piano/C3.mp3" },
  { note: "D#3", midi: 51, url: "https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/piano/Ds3.mp3" },
  { note: "F#3", midi: 54, url: "https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/piano/Fs3.mp3" },
  { note: "A3", midi: 57, url: "https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/piano/A3.mp3" },
  { note: "C4", midi: 60, url: "https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/piano/C4.mp3" },
  { note: "D#4", midi: 63, url: "https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/piano/Ds4.mp3" },
  { note: "F#4", midi: 66, url: "https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/piano/Fs4.mp3" },
  { note: "A4", midi: 69, url: "https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/piano/A4.mp3" },
  { note: "C5", midi: 72, url: "https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/piano/C5.mp3" },
  { note: "D#5", midi: 75, url: "https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/piano/Ds5.mp3" },
  { note: "F#5", midi: 78, url: "https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/piano/Fs5.mp3" }
];

function render() {
  if (!app) return;
  app.innerHTML = practiceTemplate();
  bindEvents();
  scrollStartNoteIntoView();
}

function practiceTemplate() {
  var melody = selectedMelody();
  var summary = melodySummary(melody.events);

  return '' +
    '<section class="phone-page practice-page">' +
      '<header class="topbar"><span></span><h1 class="title">声乐宝</h1><span></span></header>' +
      '<section class="panel melody-panel">' +
        '<div class="scale-toolbar">' +
          '<button class="scale-select" data-action="open-melodies">' + melody.name + '<span class="chevron-dot"></span></button>' +
          '<div class="tempo">' +
            '<span>速度</span>' +
            '<button class="round-control" data-action="tempo-down" aria-label="减慢">-</button>' +
            '<span>' + bpm + 'BPM</span>' +
            '<button class="round-control" data-action="tempo-up" aria-label="加快">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="status-strip">' +
          '<span class="' + (playStage === "prep" ? "active" : "") + '">预备I级和弦</span>' +
          '<span class="' + (playStage === "melody" ? "active" : "") + '">4小节旋律</span>' +
          '<span class="' + (playStage === "closing" ? "active" : "") + '">收尾和弦</span>' +
          '<span class="' + (playStage === "breath" ? "active" : "") + '">换气2小节</span>' +
        '</div>' +
        '<div class="score-grid" aria-label="当前练声旋律">' + scoreTemplate(melody.events, false) + '</div>' +
        '<div class="practice-meta"><span>起唱音 ' + startNote + '</span><span>' + meterLabel() + ' · ' + directionLabel() + '练习</span></div>' +
      '</section>' +
      '<section class="panel compact-panel">' +
        '<div class="section-head"><h2 class="voice-title">练声曲编辑</h2><button class="text-action" data-action="open-editor">编辑旋律</button></div>' +
        '<div class="preview-row"><span>' + sampleStatusText() + ' · 预备和弦自动加入</span><strong>' + summary + '</strong></div>' +
      '</section>' +
      '<section class="panel settings-panel">' +
        '<div class="segmented" aria-label="拍号">' + meterButtonsTemplate() + '</div>' +
        '<div class="rest-note">每轮自动加入：前置1小节I级大三和弦，结束2拍I级和弦，之后2小节休止换气。当前为开放钢琴采样；若需严格Kawai SK-EX，可替换授权采样。</div>' +
      '</section>' +
      '<div class="play-controls">' +
        '<button class="primary-action" data-action="toggle-play">' + playButtonLabel() + '</button>' +
        '<button class="secondary-action" data-action="open-editor">编辑</button>' +
      '</div>' +
      pianoTemplate() +
      (melodySheetOpen ? melodySheetTemplate() : "") +
      (editorOpen ? editorTemplate() : "") +
    '</section>';
}

function meterButtonsTemplate() {
  var html = "";
  for (var i = 0; i < meterOptions.length; i += 1) {
    html += '<button class="' + (meterOptions[i].beats === beatsPerBar ? "active" : "") + '" data-meter="' + meterOptions[i].beats + '">' + meterOptions[i].label + '</button>';
  }
  return html;
}

function scoreTemplate(events, editable) {
  var maxSlots = beatsPerBar * 4 * 2;
  var html = "";
  var slot = 0;
  for (var i = 0; i < events.length; i += 1) {
    if (slot >= maxSlots) break;
    var event = normalizeEvent(events[i]);
    var slots = Math.max(1, Math.round(event.beats * 2));
    var label = event.rest ? restLabel(event.beats) : event.label;
    var classes = "score-cell span-" + slots + (event.rest ? " rest" : "") + (i === activeEventIndex ? " active" : "");
    var attr = editable ? ' data-remove-note="' + i + '"' : "";
    html += '<button class="' + classes + '"' + attr + ' style="grid-column: span ' + slots + '">' + label + '</button>';
    slot += slots;
  }
  while (slot < maxSlots) {
    html += '<span class="score-cell empty"></span>';
    slot += 1;
  }
  return html;
}

function pianoTemplate() {
  var mini = "";
  for (var i = 0; i < 52; i += 1) {
    mini += '<span class="mini-key ' + (i % 7 === 1 || i % 7 === 4 ? "black" : "") + '"></span>';
  }

  var left = 78;
  var keys = "";
  for (var j = 0; j < whiteNotes.length; j += 1) {
    var note = whiteNotes[j];
    var letter = note.charAt(0);
    var sharpNote = sharpName(note);
    if (blackAfter[letter] && j < whiteNotes.length - 1) {
      keys += '<button class="black-key ' + (isKeyActive(sharpNote) ? "active" : "") + '" style="left:' + left + 'px" data-note="' + sharpNote + '" aria-label="' + sharpNote + '"></button>';
    }
    keys += '<button class="white-key ' + (isKeyActive(note) ? "active" : "") + '" data-note="' + note + '">' + note + '</button>';
    left += 78;
  }

  return '' +
    '<section class="piano-dock" aria-label="钢琴键盘">' +
      '<div class="mini-piano">' + mini + '</div>' +
      '<button class="loop-button" data-action="cycle-direction">' + directionLabel() + '</button>' +
      '<div class="keyboard">' + keys + '</div>' +
    '</section>';
}

function melodySheetTemplate() {
  var rows = "";
  for (var i = 0; i < melodies.length; i += 1) {
    var melody = melodies[i];
    rows += '' +
      '<button class="scale-row melody-row ' + (melody.id === selectedMelodyId ? "active" : "") + '" data-melody="' + melody.id + '">' +
        '<span class="scale-name">' + melody.name + '</span>' +
        '<span class="mini-melody">' + melodyPreview(melody.events) + '</span>' +
      '</button>';
  }

  return '' +
    '<div class="modal-backdrop" data-action="close-sheet">' +
      '<section class="scale-sheet" role="dialog" aria-modal="true" aria-label="练声曲">' +
        '<header class="sheet-header"><span></span><h2 class="sheet-title">选择练声曲</h2><button class="icon-button" data-action="close-sheet" aria-label="关闭"><span class="close-icon"></span></button></header>' +
        '<div class="scale-list">' + rows + '</div>' +
        '<footer class="sheet-footer" data-action="open-editor"><span class="edit-icon"></span>编辑当前旋律</footer>' +
      '</section>' +
    '</div>';
}

function editorTemplate() {
  var durationButtons = "";
  for (var i = 0; i < durationOptions.length; i += 1) {
    var item = durationOptions[i];
    durationButtons += '<button class="' + (Number(selectedDuration) === item.beats ? "active" : "") + '" data-duration="' + item.beats + '">' + item.label + '<small>' + item.name + '</small></button>';
  }

  var pad = "";
  for (var j = 0; j < solfege.length; j += 1) {
    pad += '<button class="note-chip" data-add-note="' + solfege[j].label + '">' + solfege[j].label + '</button>';
  }

  var used = totalBeats(editorDraft);
  var max = beatsPerBar * 4;

  return '' +
    '<div class="modal-backdrop" data-action="close-editor">' +
      '<section class="editor-sheet" role="dialog" aria-modal="true" aria-label="编辑旋律">' +
        '<header class="sheet-header"><button class="text-action" data-action="clear-draft">清空</button><h2 class="sheet-title">4小节编辑</h2><button class="icon-button" data-action="close-editor" aria-label="关闭"><span class="close-icon"></span></button></header>' +
        '<div class="editor-body">' +
          '<div class="editor-meter"><span>' + meterLabel() + '</span><span>' + formatBeat(used) + ' / ' + formatBeat(max) + ' 拍</span></div>' +
          '<div class="score-grid editor-grid">' + scoreTemplate(editorDraft, true) + '</div>' +
          '<div class="duration-row">' + durationButtons + '</div>' +
          '<div class="note-pad">' + pad + '<button class="note-chip rest-chip" data-add-rest="1">休止</button></div>' +
          '<div class="rest-row"><span>休止符会按当前时值加入，例如 ♪休止、♩休止、𝅗𝅥休止。</span></div>' +
          '<div class="editor-actions"><button class="secondary-action wide" data-action="delete-last">删除一个</button><button class="primary-action" data-action="save-melody">保存旋律</button></div>' +
        '</div>' +
      '</section>' +
    '</div>';
}

function bindEvents() {
  bindAll("[data-action]", "click", onActionClick);
  bindAll("[data-melody]", "click", onMelodyClick);
  bindAll("[data-add-note]", "click", onAddNote);
  bindAll("[data-add-rest]", "click", onAddRest);
  bindAll("[data-remove-note]", "click", onRemoveNote);
  bindAll("[data-duration]", "click", onDurationClick);
  bindAll("[data-meter]", "click", onMeterClick);

  var noteNodes = document.querySelectorAll("[data-note]");
  for (var n = 0; n < noteNodes.length; n += 1) {
    noteNodes[n].addEventListener("click", onPianoNote, false);
    if (window.PointerEvent) noteNodes[n].addEventListener("pointerdown", onPianoNote, false);
  }
}

function bindAll(selector, eventName, handler) {
  var nodes = document.querySelectorAll(selector);
  for (var i = 0; i < nodes.length; i += 1) nodes[i].addEventListener(eventName, handler, false);
}

function onActionClick(event) {
  var node = event.currentTarget;
  var action = node.getAttribute("data-action");

  if (action === "open-melodies") {
    melodySheetOpen = true;
    render();
  } else if (action === "close-sheet" && (event.target === node || hasClass(node, "icon-button"))) {
    melodySheetOpen = false;
    render();
  } else if (action === "open-editor") {
    melodySheetOpen = false;
    editorDraft = cloneEvents(selectedMelody().events);
    editorOpen = true;
    render();
  } else if (action === "close-editor" && (event.target === node || hasClass(node, "icon-button"))) {
    editorOpen = false;
    render();
  } else if (action === "tempo-down") {
    bpm = Math.max(50, bpm - 5);
    saveState();
    render();
  } else if (action === "tempo-up") {
    bpm = Math.min(180, bpm + 5);
    saveState();
    render();
  } else if (action === "cycle-direction") {
    var index = directionIndex();
    direction = directionOptions[(index + 1) % directionOptions.length].id;
    saveState();
    render();
  } else if (action === "toggle-play") {
    togglePractice();
  } else if (action === "clear-draft") {
    editorDraft = [];
    render();
  } else if (action === "delete-last") {
    editorDraft.pop();
    render();
  } else if (action === "save-melody") {
    saveDraftMelody();
  }
}

function onMelodyClick(event) {
  selectedMelodyId = event.currentTarget.getAttribute("data-melody");
  melodySheetOpen = false;
  stopPlayback();
  saveState();
  render();
}

function onAddNote(event) {
  var label = event.currentTarget.getAttribute("data-add-note");
  var note = solfegeByLabel(label);
  if (note) addDraftEvent({ label: note.label, offset: note.offset, beats: Number(selectedDuration), rest: false });
  render();
}

function onAddRest() {
  addDraftEvent({ label: "休", offset: 0, beats: Number(selectedDuration), rest: true });
  render();
}

function onRemoveNote(event) {
  editorDraft.splice(Number(event.currentTarget.getAttribute("data-remove-note")), 1);
  render();
}

function onDurationClick(event) {
  selectedDuration = Number(event.currentTarget.getAttribute("data-duration"));
  saveState();
  render();
}

function onMeterClick(event) {
  beatsPerBar = Number(event.currentTarget.getAttribute("data-meter"));
  trimDraftToGrid();
  saveState();
  render();
}

function onPianoNote(event) {
  event.preventDefault();
  startNote = event.currentTarget.getAttribute("data-note");
  stopPlayback();
  ensureAudio();
  if (hasLoadedSamples()) {
    playPianoNote(noteToMidi(startNote), 0.45, 0);
  } else {
    sampleStatus = "loading";
    preloadPianoSamples().then(function () {
      if (sampleStatus === "ready") playPianoNote(noteToMidi(startNote), 0.45, 0);
      render();
    });
  }
  saveState();
  render();
}

function addDraftEvent(item) {
  var max = beatsPerBar * 4;
  if (totalBeats(editorDraft) + item.beats <= max) editorDraft.push(item);
}

function trimDraftToGrid() {
  var max = beatsPerBar * 4;
  while (totalBeats(editorDraft) > max) editorDraft.pop();
}

function togglePractice() {
  if (sampleStatus === "loading") return;
  if (isPlaying) {
    stopPlayback();
    render();
  } else {
    startPractice();
  }
}

function startPractice() {
  var melody = selectedMelody();
  if (!melody.events.length) return;
  ensureAudio();
  if (!hasLoadedSamples()) {
    sampleStatus = "loading";
    render();
    preloadPianoSamples().then(function () {
      if (sampleStatus === "ready") startPractice();
      else render();
    });
    return;
  }
  clearTimers();
  isPlaying = true;
  var baseMidi = noteToMidi(startNote);
  scheduleRound(baseMidi);
  render();
}

function scheduleRound(baseMidi) {
  if (!isPlaying) return;
  var melody = selectedMelody();
  var beatMs = 60000 / bpm;
  var cursor = 0;
  var chord = majorTriad(baseMidi);

  setStageAt("prep", -1, chord, cursor);
  scheduleChord(chord, beatsPerBar * beatMs, cursor);
  cursor += beatsPerBar * beatMs;

  for (var i = 0; i < melody.events.length; i += 1) {
    scheduleEvent(melody.events[i], i, baseMidi, cursor);
    cursor += normalizeEvent(melody.events[i]).beats * beatMs;
  }

  setStageAt("closing", -1, chord, cursor);
  scheduleChord(chord, 2 * beatMs, cursor);
  cursor += 2 * beatMs;

  setStageAt("breath", -1, [], cursor);
  cursor += beatsPerBar * 2 * beatMs;

  playTimers.push(window.setTimeout(function () {
    var nextBase = nextBaseMidi(baseMidi, melody);
    if (nextBase === null) {
      stopPlayback();
      render();
      return;
    }
    scheduleRound(nextBase);
  }, cursor));
}

function scheduleEvent(event, index, baseMidi, delayMs) {
  var normalized = normalizeEvent(event);
  var beatMs = 60000 / bpm;
  playTimers.push(window.setTimeout(function () {
    if (!isPlaying) return;
    playStage = "melody";
    activeEventIndex = index;
    activeChord = [];
    if (normalized.rest) {
      activeNote = "";
      updateLiveState();
      return;
    }
    var midi = baseMidi + normalized.offset;
    playPianoNote(midi, normalized.beats * beatMs / 1000, 0);
    activeNote = midiToNote(midi);
    updateLiveState();
  }, delayMs));
}

function setStageAt(stage, eventIndex, chord, delayMs) {
  playTimers.push(window.setTimeout(function () {
    if (!isPlaying) return;
    playStage = stage;
    activeEventIndex = eventIndex;
    activeChord = chord || [];
    activeNote = "";
    updateLiveState();
  }, delayMs));
}

function scheduleChord(midis, durationMs, delayMs) {
  playTimers.push(window.setTimeout(function () {
    if (!isPlaying) return;
    playChord(midis, durationMs / 1000);
  }, delayMs));
}

function nextBaseMidi(baseMidi, melody) {
  var next = baseMidi;
  if (direction === "up") next += 1;
  if (direction === "down") next -= 1;
  if (next + maxOffset(melody) > noteToMidi("B4") || next < noteToMidi("A2")) return null;
  return next;
}

function stopPlayback() {
  clearTimers();
  isPlaying = false;
  activeNote = "";
  activeChord = [];
  activeEventIndex = -1;
  playStage = "";
}

function clearTimers() {
  for (var i = 0; i < playTimers.length; i += 1) window.clearTimeout(playTimers[i]);
  playTimers = [];
}

function saveDraftMelody() {
  if (!editorDraft.length) return;
  var edited = { id: "custom", name: "我的练声曲", events: cloneEvents(editorDraft) };
  var index = melodyIndexById("custom");
  if (index >= 0) melodies[index] = edited;
  else melodies.unshift(edited);
  selectedMelodyId = "custom";
  editorOpen = false;
  stopPlayback();
  saveState();
  render();
}

function selectedMelody() {
  var index = melodyIndexById(selectedMelodyId);
  return index >= 0 ? melodies[index] : melodies[0];
}

function loadState() {
  try {
    var savedText = window.localStorage ? window.localStorage.getItem(storageKey) : null;
    var saved = savedText ? JSON.parse(savedText) : null;
    if (saved && saved.melodies && saved.melodies.length) {
      saved.melodies = migrateMelodies(saved.melodies);
      return saved;
    }
  } catch (error) {}

  try {
    var oldText = window.localStorage ? window.localStorage.getItem("vocal-melodies") : null;
    var oldMelodies = oldText ? JSON.parse(oldText) : null;
    if (oldMelodies && oldMelodies.length) return { melodies: migrateMelodies(oldMelodies) };
  } catch (error2) {}

  return { melodies: defaultMelodies };
}

function saveState() {
  try {
    if (window.localStorage) {
      window.localStorage.setItem(storageKey, JSON.stringify({
        melodies: melodies,
        selectedMelodyId: selectedMelodyId,
        bpm: bpm,
        beatsPerBar: beatsPerBar,
        startNote: startNote,
        direction: direction,
        selectedDuration: selectedDuration
      }));
    }
  } catch (error) {}
}

function migrateMelodies(list) {
  var output = [];
  for (var i = 0; i < list.length; i += 1) {
    if (list[i].events) output.push({ id: list[i].id, name: list[i].name, events: cloneEvents(list[i].events) });
    else output.push({ id: list[i].id, name: list[i].name, events: cloneLegacyNotes(list[i].notes || []) });
  }
  return output.length ? output : defaultMelodies;
}

function cloneLegacyNotes(notes) {
  var events = [];
  for (var i = 0; i < notes.length; i += 1) {
    events.push({ label: notes[i].label, offset: notes[i].offset, beats: 0.5, rest: false });
  }
  return events;
}

function cloneEvents(events) {
  var copy = [];
  for (var i = 0; i < events.length; i += 1) {
    var item = normalizeEvent(events[i]);
    copy.push({ label: item.label, offset: item.offset, beats: item.beats, rest: item.rest });
  }
  return copy;
}

function buildEvents(labels, beats) {
  var events = [];
  for (var i = 0; i < labels.length; i += 1) {
    var note = solfegeByLabel(labels[i]);
    if (note) events.push({ label: note.label, offset: note.offset, beats: beats, rest: false });
  }
  return events;
}

function normalizeEvent(event) {
  return {
    label: event.label || "1",
    offset: Number(event.offset || 0),
    beats: Number(event.beats || 0.5),
    rest: !!event.rest
  };
}

function directionLabel() {
  return directionOptions[directionIndex()].label;
}

function directionIndex() {
  for (var i = 0; i < directionOptions.length; i += 1) {
    if (directionOptions[i].id === direction) return i;
  }
  return 0;
}

function meterLabel() {
  return beatsPerBar + "/4";
}

function solfegeByLabel(label) {
  for (var i = 0; i < solfege.length; i += 1) {
    if (solfege[i].label === label) return solfege[i];
  }
  return null;
}

function melodyIndexById(id) {
  for (var i = 0; i < melodies.length; i += 1) {
    if (melodies[i].id === id) return i;
  }
  return -1;
}

function melodyPreview(events) {
  var labels = [];
  for (var i = 0; i < events.length; i += 1) {
    var item = normalizeEvent(events[i]);
    labels.push(item.rest ? restLabel(item.beats) : item.label);
  }
  return labels.join(" ");
}

function melodySummary(events) {
  return formatBeat(totalBeats(events)) + " 拍";
}

function totalBeats(events) {
  var total = 0;
  for (var i = 0; i < events.length; i += 1) total += normalizeEvent(events[i]).beats;
  return total;
}

function formatBeat(value) {
  return value % 1 === 0 ? String(value) : String(value).replace(".5", "½");
}

function restLabel(beats) {
  if (beats === 0.5) return "♪休";
  if (beats === 1) return "♩休";
  if (beats === 2) return "𝅗𝅥休";
  if (beats === 4) return "𝅝休";
  return "休";
}

function sharpName(note) {
  return midiToNote(noteToMidi(note) + 1);
}

function maxOffset(melody) {
  var max = 0;
  for (var i = 0; i < melody.events.length; i += 1) {
    var item = normalizeEvent(melody.events[i]);
    if (!item.rest && item.offset > max) max = item.offset;
  }
  return max;
}

function ensureAudio() {
  var AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended" && audioCtx.resume) audioCtx.resume();
  preloadPianoSamples();
}

function playPianoNote(midi, duration, delay) {
  ensureAudio();
  if (!audioCtx) return;
  if (playSampledPiano(midi, duration, delay)) return;
}

function preloadPianoSamples() {
  if (!audioCtx) return Promise.resolve(false);
  if (hasLoadedSamples()) {
    sampleStatus = "ready";
    return Promise.resolve(true);
  }
  if (preloadPromise) return preloadPromise;
  sampleStatus = "loading";
  preloadPromise = Promise.allSettled(pianoSamples.map(loadPianoSample)).then(function () {
    sampleStatus = hasLoadedSamples() ? "ready" : "error";
    preloadPromise = null;
    render();
    return sampleStatus === "ready";
  });
  return preloadPromise;
}

function loadPianoSample(sample) {
  if (!audioCtx || sampleCache[sample.note]) return Promise.resolve(sampleCache[sample.note]);
  if (sampleLoading[sample.note]) return sampleLoading[sample.note];
  sampleLoading[sample.note] = window.fetch(sample.url)
    .then(function (response) {
      if (!response.ok) throw new Error("sample");
      return response.arrayBuffer();
    })
    .then(function (arrayBuffer) {
      return audioCtx.decodeAudioData(arrayBuffer);
    })
    .then(function (buffer) {
      sampleCache[sample.note] = buffer;
      sampleLoading[sample.note] = null;
      return buffer;
    })
    .catch(function () {
      sampleLoading[sample.note] = null;
      return null;
    });
  return sampleLoading[sample.note];
}

function hasLoadedSamples() {
  for (var i = 0; i < pianoSamples.length; i += 1) {
    if (sampleCache[pianoSamples[i].note]) return true;
  }
  return false;
}

function sampleStatusText() {
  if (sampleStatus === "loading") return "正在加载真实钢琴音色";
  if (sampleStatus === "error") return "钢琴采样加载失败，请换网络刷新";
  if (sampleStatus === "ready") return "真实干声三角钢琴采样";
  return "真实干声三角钢琴采样";
}

function playButtonLabel() {
  if (isPlaying) return "停止练声";
  if (sampleStatus === "loading") return "加载钢琴音色...";
  return "开始练声";
}

function playSampledPiano(midi, duration, delay) {
  var sample = nearestLoadedSample(midi);
  if (!sample) return false;
  var buffer = sampleCache[sample.note];
  if (!buffer) return false;
  var now = audioCtx.currentTime + (delay || 0);
  var source = audioCtx.createBufferSource();
  var gain = audioCtx.createGain();
  var filter = audioCtx.createBiquadFilter();
  var release = Math.min(0.18, Math.max(0.06, duration * 0.22));

  source.buffer = buffer;
  source.playbackRate.setValueAtTime(Math.pow(2, (midi - sample.midi) / 12), now);
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
  return true;
}

function nearestLoadedSample(midi) {
  var best = null;
  var bestDistance = Infinity;
  for (var i = 0; i < pianoSamples.length; i += 1) {
    var item = pianoSamples[i];
    if (!sampleCache[item.note]) continue;
    var distance = Math.abs(item.midi - midi);
    if (distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best;
}

function playChord(midis, duration) {
  for (var i = 0; i < midis.length; i += 1) playPianoNote(midis[i], duration, i * 0.006);
}

function majorTriad(rootMidi) {
  return [rootMidi, rootMidi + 4, rootMidi + 7];
}

function updateLiveState() {
  var noteNodes = document.querySelectorAll(".score-cell");
  for (var i = 0; i < noteNodes.length; i += 1) {
    toggleClass(noteNodes[i], "active", i === activeEventIndex && playStage === "melody");
  }
  highlightActiveKey();
  updateStatusStrip();
}

function updateStatusStrip() {
  var nodes = document.querySelectorAll(".status-strip span");
  var stages = ["prep", "melody", "closing", "breath"];
  for (var i = 0; i < nodes.length; i += 1) toggleClass(nodes[i], "active", stages[i] === playStage);
}

function highlightActiveKey() {
  var nodes = document.querySelectorAll("[data-note]");
  for (var i = 0; i < nodes.length; i += 1) {
    var note = nodes[i].getAttribute("data-note");
    toggleClass(nodes[i], "active", isKeyActive(note));
  }
}

function isKeyActive(note) {
  if (note === startNote || note === activeNote) return true;
  var midi = noteToMidi(note);
  for (var i = 0; i < activeChord.length; i += 1) {
    if (activeChord[i] === midi) return true;
  }
  return false;
}

function noteToMidi(note) {
  var match = /^([A-G])(#?)(\d)$/.exec(note);
  if (!match) return 60;
  var offsets = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return (Number(match[3]) + 1) * 12 + offsets[match[1]] + (match[2] ? 1 : 0);
}

function midiToNote(midi) {
  var octave = Math.floor(midi / 12) - 1;
  var name = noteNames[((midi % 12) + 12) % 12];
  return name + octave;
}

function scrollStartNoteIntoView() {
  var key = document.querySelector('[data-note="' + startNote + '"]');
  if (!key) return;
  try {
    key.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
  } catch (error) {
    try {
      key.scrollIntoView(false);
    } catch (innerError) {}
  }
}

function hasClass(node, className) {
  return (" " + node.className + " ").indexOf(" " + className + " ") >= 0;
}

function toggleClass(node, className, enabled) {
  if (node.classList) {
    node.classList.toggle(className, enabled);
    return;
  }
  var exists = hasClass(node, className);
  if (enabled && !exists) node.className += " " + className;
  if (!enabled && exists) node.className = (" " + node.className + " ").replace(" " + className + " ", " ").replace(/^\s+|\s+$/g, "");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", render, false);
} else {
  render();
}
