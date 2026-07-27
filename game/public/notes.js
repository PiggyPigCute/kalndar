// --- Notes : plusieurs notes par utilisateur (titre + contenu), jamais partagées entre
// membres. Liste + éditeur façon app Notes ; sur tel un seul volet à la fois (voir CSS
// .notes-layout.editor-open), sur pc les deux sont visibles côte à côte. ---

const notesList = document.getElementById('notesList');
const noteAddBtn = document.getElementById('noteAddBtn');
const noteBackBtn = document.getElementById('noteBackBtn');
const noteTitleInput = document.getElementById('noteTitleInput');
const noteBodyInput = document.getElementById('noteBodyInput');
const noteDeleteBtn = document.getElementById('noteDeleteBtn');
const notesLayout = document.querySelector('.notes-layout');

let notes = [];
let activeNoteId = null;
let noteSaveTimer = null;

function notePreview(note) {
  return (note.body || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function sortedNotes() {
  return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function setNoteEditorEnabled(enabled) {
  noteTitleInput.disabled = !enabled;
  noteBodyInput.disabled = !enabled;
  noteDeleteBtn.disabled = !enabled;
}

function renderNotesList() {
  notesList.innerHTML = '';
  if (notes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'notes-empty';
    empty.textContent = 'Aucune note pour l\'instant.';
    notesList.appendChild(empty);
    return;
  }
  sortedNotes().forEach(note => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'note-list-item' + (note.id === activeNoteId ? ' active' : '');
    item.innerHTML = `
      <div class="note-list-item-title">${escapeHtml(note.title || 'Sans titre')}</div>
      <div class="note-list-item-preview">${escapeHtml(notePreview(note))}</div>
    `;
    item.addEventListener('click', () => openNote(note.id));
    notesList.appendChild(item);
  });
}

function openNote(id) {
  flushNoteSave();
  activeNoteId = id;
  const note = notes.find(n => n.id === id);
  if (!note) return;
  setNoteEditorEnabled(true);
  noteTitleInput.value = note.title;
  noteBodyInput.value = note.body;
  notesLayout.classList.add('editor-open');
  renderNotesList();
  noteTitleInput.focus();
}

function closeNoteEditor() {
  flushNoteSave();
  notesLayout.classList.remove('editor-open');
}

function scheduleNoteSave() {
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(flushNoteSave, 600);
}

async function flushNoteSave() {
  clearTimeout(noteSaveTimer);
  if (!activeNoteId) return;
  const id = activeNoteId;
  const note = notes.find(n => n.id === id);
  if (!note) return;

  const title = noteTitleInput.value;
  const body = noteBodyInput.value;
  if (note.title === title && note.body === body) return;

  try {
    const updated = await fetchJSON(`/api/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    });
    Object.assign(note, updated);
    renderNotesList();
  } catch (err) {
    if (err.status === 401) { showIdentityScreen(); return; }
    console.error('Sauvegarde note :', err);
  }
}

noteTitleInput.addEventListener('input', scheduleNoteSave);
noteBodyInput.addEventListener('input', scheduleNoteSave);
noteTitleInput.addEventListener('blur', flushNoteSave);
noteBodyInput.addEventListener('blur', flushNoteSave);

noteAddBtn.addEventListener('click', async () => {
  try {
    const note = await fetchJSON('/api/notes', { method: 'POST' });
    notes.unshift(note);
    openNote(note.id);
  } catch (err) {
    if (err.status === 401) { showIdentityScreen(); return; }
    console.error('Création note :', err);
  }
});

noteDeleteBtn.addEventListener('click', async () => {
  if (!activeNoteId) return;
  if (!confirm('Supprimer cette note ?')) return;
  const id = activeNoteId;
  clearTimeout(noteSaveTimer);
  try {
    await fetchJSON(`/api/notes/${id}`, { method: 'DELETE' });
    notes = notes.filter(n => n.id !== id);
    activeNoteId = null;
    noteTitleInput.value = '';
    noteBodyInput.value = '';
    setNoteEditorEnabled(false);
    closeNoteEditor();
    renderNotesList();
  } catch (err) {
    if (err.status === 401) { showIdentityScreen(); return; }
    console.error('Suppression note :', err);
  }
});

noteBackBtn.addEventListener('click', closeNoteEditor);

async function renderNotes() {
  try {
    notes = await fetchJSON('/api/notes');
  } catch (err) {
    if (err.status === 401) { showIdentityScreen(); return; }
    console.error('Notes indisponibles :', err);
    return;
  }

  if (!notes.find(n => n.id === activeNoteId)) {
    activeNoteId = null;
    noteTitleInput.value = '';
    noteBodyInput.value = '';
    setNoteEditorEnabled(false);
  }
  renderNotesList();
}

setNoteEditorEnabled(false);
