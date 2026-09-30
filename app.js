/* ============================================================
   Tab It — a grid-based guitar tab editor.
   Data model: state.items is a flat list of "note" and "bar" slots.
   Each slot has a fixed on-screen width, so typing into one slot
   never reflows/shifts any other slot. Structural changes (insert/
   delete a slot) are explicit user actions, not side effects of typing.
   ============================================================ */

const TUNING_PRESETS = {
  standard: ['e', 'B', 'G', 'D', 'A', 'E'],
  dropD:    ['e', 'B', 'G', 'D', 'A', 'D'],
  halfDown: ['e\u266d', 'B\u266d', 'G\u266d', 'D\u266d', 'A\u266d', 'E\u266d'],
  dadgad:   ['D', 'A', 'G', 'D', 'A', 'D'],
  bass4:    ['G', 'D', 'A', 'E'],
};

let uidCounter = 1;
function uid() { return 'id' + (uidCounter++); }

function newNoteItem(numStrings) {
  return { id: uid(), type: 'note', frets: new Array(numStrings).fill(null) };
}
function newBarItem() {
  return { id: uid(), type: 'bar' };
}

function defaultState() {
  return {
    title: 'Untitled Tab',
    tuningPreset: 'standard',
    strings: TUNING_PRESETS.standard.slice(),
    columnsPerLine: 16,
    items: [
      newBarItem(),
      newNoteItem(6), newNoteItem(6), newNoteItem(6), newNoteItem(6),
      newNoteItem(6), newNoteItem(6), newNoteItem(6), newNoteItem(6),
      newBarItem(),
    ],
  };
}

function practiceNote(stringIndex, fret) {
  const item = newNoteItem(6);
  item.frets[stringIndex] = fret;
  return item;
}

function pickingPracticeState() {
  return {
    title: 'Picking Pattern Practice',
    tuningPreset: 'standard',
    strings: TUNING_PRESETS.standard.slice(),
    columnsPerLine: 16,
    items: [
      newBarItem(),
      practiceNote(4, 3), practiceNote(1, 0), practiceNote(3, 2), practiceNote(0, 0),
      practiceNote(4, 3), practiceNote(2, 0), practiceNote(3, 2), practiceNote(1, 1),
      practiceNote(4, 3), practiceNote(1, 0), practiceNote(3, 2), practiceNote(0, 0),
      practiceNote(4, 3), practiceNote(2, 0), practiceNote(3, 2), practiceNote(1, 1),
      newBarItem(),
    ],
  };
}

const AUTOSAVE_KEY = 'tabit_autosave_v1';
function autosave() {
  try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}
function loadAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

let state = loadAutosave() || defaultState();
let selection = null; // { itemIndex, stringIndex }
let undoStack = [];
let redoStack = [];
let typedBuffer = '';
let lastEditKey = null;

function pushHistory() {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(state));
  state = JSON.parse(undoStack.pop());
  selection = null;
  render(); autosave();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(state));
  state = JSON.parse(redoStack.pop());
  selection = null;
  render(); autosave();
}

/* ---------- selection / navigation ---------- */

function selectCell(itemIndex, stringIndex) {
  selection = { itemIndex, stringIndex };
  typedBuffer = '';
  lastEditKey = null;
  render();
  document.getElementById('tabSheet').focus({ preventScroll: true });
}

function isSelected(index, stringIndex) {
  if (!selection || selection.itemIndex !== index) return false;
  return stringIndex === undefined || selection.stringIndex === stringIndex;
}

function moveSelection(dRow, dCol) {
  if (!state.items.length) return;
  if (!selection) { selectCell(0, 0); return; }
  let idx = selection.itemIndex;
  if (dCol !== 0) {
    idx += dCol;
    if (idx < 0) idx = 0;
    if (idx > state.items.length - 1) {
      if (dCol > 0) {
        pushHistory();
        state.items.push(newNoteItem(state.strings.length));
        idx = state.items.length - 1;
      } else {
        idx = 0;
      }
    }
  }
  const s = Math.max(0, Math.min(state.strings.length - 1, selection.stringIndex + dRow));
  selectCell(idx, s);
}

function advanceToNextNote() {
  if (!selection) {
    const firstNote = state.items.findIndex(it => it.type === 'note');
    if (firstNote >= 0) selectCell(firstNote, 0);
    return;
  }
  let idx = selection.itemIndex + 1;
  while (idx < state.items.length && state.items[idx].type !== 'note') idx++;
  if (idx >= state.items.length) {
    pushHistory();
    state.items.push(newNoteItem(state.strings.length));
    idx = state.items.length - 1;
  }
  selectCell(idx, selection.stringIndex);
}

/* ---------- editing ---------- */

function handleDigit(d) {
  if (!selection) return;
  const item = state.items[selection.itemIndex];
  if (item.type !== 'note') return;
  const key = selection.itemIndex + ':' + selection.stringIndex;
  if (lastEditKey !== key) { typedBuffer = ''; }
  if (typedBuffer === '') pushHistory();
  typedBuffer += d;
  let num = parseInt(typedBuffer, 10);
  if (num > 24 || typedBuffer.length > 2) {
    typedBuffer = d;
    num = parseInt(typedBuffer, 10);
  }
  item.frets[selection.stringIndex] = num;
  lastEditKey = key;
  render(); autosave();
}

function setMuteCurrent() {
  if (!selection) return;
  const item = state.items[selection.itemIndex];
  if (item.type !== 'note') return;
  pushHistory();
  item.frets[selection.stringIndex] = 'x';
  typedBuffer = ''; lastEditKey = null;
  render(); autosave();
}

function clearCurrentFret() {
  if (!selection) return;
  const item = state.items[selection.itemIndex];
  if (item.type !== 'note') return;
  pushHistory();
  item.frets[selection.stringIndex] = null;
  typedBuffer = ''; lastEditKey = null;
  render(); autosave();
}

function insertNoteAfterSelection() {
  pushHistory();
  const item = newNoteItem(state.strings.length);
  if (selection) {
    state.items.splice(selection.itemIndex + 1, 0, item);
    selection = { itemIndex: selection.itemIndex + 1, stringIndex: selection.stringIndex };
  } else {
    state.items.push(item);
    selection = { itemIndex: state.items.length - 1, stringIndex: 0 };
  }
  render(); autosave();
}

function insertBarAfterSelection() {
  pushHistory();
  const bar = newBarItem();
  if (selection) {
    state.items.splice(selection.itemIndex + 1, 0, bar);
  } else {
    state.items.push(bar);
  }
  render(); autosave();
}

function deleteSelected() {
  if (!selection) return;
  pushHistory();
  state.items.splice(selection.itemIndex, 1);
  if (state.items.length === 0) {
    selection = null;
  } else {
    selection = {
      itemIndex: Math.min(selection.itemIndex, state.items.length - 1),
      stringIndex: selection.stringIndex,
    };
  }
  render(); autosave();
}

function deleteSelectedBarline() {
  if (!selection || state.items[selection.itemIndex].type !== 'bar') return;
  deleteSelected();
}

/* ---------- strings / tuning ---------- */

function addString() {
  pushHistory();
  state.strings.push('B');
  state.items.forEach(it => { if (it.type === 'note') it.frets.push(null); });
  render(); autosave();
}

function removeString() {
  if (state.strings.length <= 1) return;
  pushHistory();
  state.strings.pop();
  state.items.forEach(it => { if (it.type === 'note') it.frets.pop(); });
  if (selection && selection.stringIndex >= state.strings.length) {
    selection.stringIndex = state.strings.length - 1;
  }
  render(); autosave();
}

function applyTuningPreset(name) {
  if (name === 'custom') { state.tuningPreset = 'custom'; return; }
  const labels = TUNING_PRESETS[name];
  if (!labels) return;
  pushHistory();
  const oldCount = state.strings.length;
  const newCount = labels.length;
  state.strings = labels.slice();
  state.tuningPreset = name;
  if (newCount !== oldCount) {
    state.items.forEach(it => {
      if (it.type !== 'note') return;
      if (newCount > oldCount) {
        while (it.frets.length < newCount) it.frets.push(null);
      } else {
        it.frets.length = newCount;
      }
    });
    if (selection && selection.stringIndex >= newCount) selection.stringIndex = newCount - 1;
  }
  render(); autosave();
}

function onLabelBlur(e) {
  const idx = parseInt(e.target.dataset.stringIndex, 10);
  const text = e.target.textContent.trim() || state.strings[idx];
  if (text !== state.strings[idx]) {
    state.strings[idx] = text;
    state.tuningPreset = 'custom';
    autosave();
  }
  render();
}

/* ---------- line wrapping ---------- */

function computeLinesWithIndex() {
  const lines = [];
  let current = [];
  let noteCount = 0;
  const limit = state.columnsPerLine;
  state.items.forEach((item, index) => {
    current.push({ item, index });
    if (item.type === 'note') noteCount++;
    if (noteCount >= limit && (item.type === 'bar' || noteCount >= limit + 4)) {
      lines.push(current);
      current = [];
      noteCount = 0;
    }
  });
  if (current.length) lines.push(current);
  if (lines.length === 0) lines.push([]);
  return lines;
}

/* ---------- rendering ---------- */

function render() {
  document.getElementById('songTitle').value = state.title;
  document.getElementById('tuningPreset').value = state.tuningPreset;

  const root = document.getElementById('tabSheet');
  root.innerHTML = '';
  const numStrings = state.strings.length;
  const lines = computeLinesWithIndex();

  for (const line of lines) {
    const lineEl = document.createElement('div');
    lineEl.className = 'tab-line';

    const labelsEl = document.createElement('div');
    labelsEl.className = 'string-labels';
    labelsEl.style.gridTemplateRows = `repeat(${numStrings}, var(--row-h))`;
    for (let s = 0; s < numStrings; s++) {
      const lc = document.createElement('div');
      lc.className = 'label-cell';
      lc.contentEditable = 'true';
      lc.spellcheck = false;
      lc.dataset.stringIndex = String(s);
      lc.textContent = state.strings[s];
      lc.addEventListener('blur', onLabelBlur);
      lc.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); lc.blur(); } });
      labelsEl.appendChild(lc);
    }
    lineEl.appendChild(labelsEl);

    const gridEl = document.createElement('div');
    gridEl.className = 'tab-grid';
    gridEl.style.gridTemplateRows = `repeat(${numStrings}, var(--row-h))`;
    gridEl.style.gridTemplateColumns = line.length
      ? line.map(({ item }) => item.type === 'bar' ? 'var(--bar-w)' : 'var(--cell-w)').join(' ')
      : 'var(--cell-w)';

    for (let s = 0; s < numStrings; s++) {
      const sl = document.createElement('div');
      sl.className = 'string-line';
      sl.style.top = `calc(var(--row-h) * ${s} + var(--row-h) / 2)`;
      gridEl.appendChild(sl);
    }

    line.forEach(({ item, index }, colPos) => {
      if (item.type === 'bar') {
        const bEl = document.createElement('div');
        bEl.className = 'barline' + (isSelected(index) ? ' selected' : '');
        bEl.style.gridColumn = String(colPos + 1);
        bEl.style.gridRow = `1 / span ${numStrings}`;
        bEl.dataset.itemIndex = String(index);
        bEl.addEventListener('click', () => selectCell(index, selection ? selection.stringIndex : 0));
        gridEl.appendChild(bEl);
      } else {
        for (let s = 0; s < numStrings; s++) {
          const val = item.frets[s];
          const cEl = document.createElement('div');
          let cls = 'cell';
          if (val !== null && val !== undefined) cls += ' has-value';
          if (val === 'x') cls += ' mute';
          if (isSelected(index, s)) cls += ' selected';
          cEl.className = cls;
          cEl.style.gridColumn = String(colPos + 1);
          cEl.style.gridRow = String(s + 1);
          cEl.textContent = (val === null || val === undefined) ? '' : String(val);
          cEl.dataset.itemIndex = String(index);
          cEl.dataset.stringIndex = String(s);
          cEl.addEventListener('click', () => selectCell(index, s));
          gridEl.appendChild(cEl);
        }
      }
    });

    lineEl.appendChild(gridEl);
    root.appendChild(lineEl);
  }
}

/* ---------- import / export ---------- */

function exportProjectFile() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (state.title || 'tab').replace(/[^\w\-]+/g, '_') + '.tabit.json';
  a.click();
  URL.revokeObjectURL(url);
}

function exportTxtString() {
  const lines = computeLinesWithIndex();
  const numStrings = state.strings.length;
  let out = (state.title || 'Untitled') + '\n\n';
  for (const line of lines) {
    const rows = [];
    for (let s = 0; s < numStrings; s++) rows.push(state.strings[s].padEnd(2, ' ') + '|');
    for (const { item } of line) {
      if (item.type === 'bar') {
        for (let s = 0; s < numStrings; s++) rows[s] += '|';
      } else {
        for (let s = 0; s < numStrings; s++) {
          const v = item.frets[s];
          let tok;
          if (v === null || v === undefined) tok = '---';
          else if (v === 'x') tok = '-x-';
          else tok = String(v).padStart(2, '-') + '-';
          rows[s] += tok;
        }
      }
    }
    for (let s = 0; s < numStrings; s++) rows[s] += '|';
    out += rows.join('\n') + '\n\n';
  }
  return out;
}

function exportTxtFile() {
  const blob = new Blob([exportTxtString()], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (state.title || 'tab').replace(/[^\w\-]+/g, '_') + '.txt';
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- wiring ---------- */

document.getElementById('songTitle').addEventListener('input', (e) => {
  state.title = e.target.value;
  autosave();
});
document.getElementById('tuningPreset').addEventListener('change', (e) => applyTuningPreset(e.target.value));
document.getElementById('starterPreset').addEventListener('change', (e) => {
  if (!e.target.value) return;
  pushHistory();
  state = e.target.value === 'pickingPractice' ? pickingPracticeState() : defaultState();
  selection = null;
  e.target.value = '';
  render(); autosave();
});
document.getElementById('btnAddNote').addEventListener('click', insertNoteAfterSelection);
document.getElementById('btnAddBar').addEventListener('click', insertBarAfterSelection);
document.getElementById('btnDeleteBar').addEventListener('click', deleteSelectedBarline);
document.getElementById('btnDeleteCol').addEventListener('click', deleteSelected);
document.getElementById('btnAddString').addEventListener('click', addString);
document.getElementById('btnRemoveString').addEventListener('click', removeString);
document.getElementById('btnUndo').addEventListener('click', undo);
document.getElementById('btnRedo').addEventListener('click', redo);
document.getElementById('btnNew').addEventListener('click', () => {
  if (confirm('Start a new tab? This clears the current sheet (use Save Project first to keep a copy).')) {
    pushHistory();
    state = defaultState();
    selection = null;
    render(); autosave();
  }
});
document.getElementById('btnSaveJson').addEventListener('click', exportProjectFile);
document.getElementById('btnLoadJson').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const loaded = JSON.parse(String(reader.result));
      if (!loaded.items || !loaded.strings) throw new Error('bad file');
      pushHistory();
      state = loaded;
      selection = null;
      render(); autosave();
    } catch (err) {
      alert('Could not load that file — it does not look like a Tab It project.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});
document.getElementById('btnExportTxt').addEventListener('click', exportTxtFile);
document.getElementById('btnPrint').addEventListener('click', () => window.print());

document.addEventListener('keydown', (e) => {
  const target = e.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
      target.isContentEditable) return;
  const k = e.key;
  if (k >= '0' && k <= '9') { e.preventDefault(); handleDigit(k); return; }
  if (k === 'x' || k === 'X') { e.preventDefault(); setMuteCurrent(); return; }
  if (k === 'Backspace' || k === 'Delete') {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) deleteSelected(); else clearCurrentFret();
    return;
  }
  if (k === 'ArrowLeft') { e.preventDefault(); moveSelection(0, -1); return; }
  if (k === 'ArrowRight') { e.preventDefault(); moveSelection(0, 1); return; }
  if (k === 'ArrowUp') { e.preventDefault(); moveSelection(-1, 0); return; }
  if (k === 'ArrowDown') { e.preventDefault(); moveSelection(1, 0); return; }
  if (k === 'Enter' || k === 'Tab') { e.preventDefault(); advanceToNextNote(); return; }
  if (k === '|') { e.preventDefault(); insertBarAfterSelection(); return; }
  if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
});

render();
