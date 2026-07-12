const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];
let members = [];
let events = [];
let currentMember = null;
let loginMemberId = null;
let currentDate = new Date();
let selectedDate = todayString();
let editingEventId = null;

const identityScreen = document.getElementById('identityScreen');
const appScreen = document.getElementById('appScreen');
const identityList = document.getElementById('identityList');
const loginForm = document.getElementById('loginForm');
const loginAs = document.getElementById('loginAs');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const loginBackBtn = document.getElementById('loginBackBtn');
const currentIdentityEl = document.getElementById('currentIdentity');
const switchIdentityBtn = document.getElementById('switchIdentityBtn');

const monthLabel = document.getElementById('monthLabel');
const weekdaysRow = document.getElementById('weekdaysRow');
const calendarGrid = document.getElementById('calendarGrid');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const todayBtn = document.getElementById('todayBtn');
const newEventBtn = document.getElementById('newEventBtn');
const dayPanelDate = document.getElementById('dayPanelDate');
const dayPanelList = document.getElementById('dayPanelList');
const dayPanelAddBtn = document.getElementById('dayPanelAddBtn');

const modalOverlay = document.getElementById('eventModalOverlay');
const modalTitle = document.getElementById('modalTitle');
const eventForm = document.getElementById('eventForm');
const fieldTitle = document.getElementById('fieldTitle');
const fieldDate = document.getElementById('fieldDate');
const fieldEndDate = document.getElementById('fieldEndDate');
const fieldMembers = document.getElementById('fieldMembers');
const fieldStartTime = document.getElementById('fieldStartTime');
const fieldEndTime = document.getElementById('fieldEndTime');
[fieldStartTime, fieldEndTime].forEach(input => input.addEventListener('input', formatTimeInput));
const fieldDescription = document.getElementById('fieldDescription');
const formError = document.getElementById('formError');
const deleteEventBtn = document.getElementById('deleteEventBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');

function pad(n) { return String(n).padStart(2, '0'); }
function formatDate(year, month, day) { return `${year}-${pad(month + 1)}-${pad(day)}`; }
function todayString() {
  const now = new Date();
  return formatDate(now.getFullYear(), now.getMonth(), now.getDate());
}

// jj/mm/aaaa (affichage) <-> aaaa-mm-jj (valeur native, utilisée partout ailleurs dans le code)
function formatDateEU(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function parseDateEU(str) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str.trim());
  if (!match) return null;
  const [, d, m, y] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) return null;
  return `${y}-${m}-${d}`;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
function isValidTimeInput(value) { return value === '' || TIME_PATTERN.test(value); }

// insère automatiquement le ":" pendant la saisie, en gardant un format HH:mm 24h
function formatTimeInput(e) {
  const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
  e.target.value = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

function memberById(id) { return members.find(m => m.id === id); }

function daysBetween(dateStrA, dateStrB) {
  const [ay, am, ad] = dateStrA.split('-').map(Number);
  const [by, bm, bd] = dateStrB.split('-').map(Number);
  const a = new Date(ay, am - 1, ad);
  const b = new Date(by, bm - 1, bd);
  return Math.round((b - a) / 86400000);
}

// couleur unique, ou dégradé par bandes quand plusieurs membres sont concernés :
// chaque couleur occupe une bande unie (deux points à la même teinte) séparée
// de la suivante par une petite zone de transition, plutôt qu'un dégradé continu
function memberAccent(memberIds) {
  const colors = (memberIds || []).map(memberById).filter(Boolean).map(m => m.color);
  if (colors.length === 0) return '#999';
  if (colors.length === 1) return colors[0];

  const n = colors.length;
  const bandWidth = 100 / n;
  const blend = Math.min(10, bandWidth * 0.4);

  const stops = colors.flatMap((color, i) => {
    const solidStart = i === 0 ? 0 : i * bandWidth + blend / 2;
    const solidEnd = i === n - 1 ? 100 : (i + 1) * bandWidth - blend / 2;
    return [`${color} ${solidStart.toFixed(1)}%`, `${color} ${solidEnd.toFixed(1)}%`];
  });

  return `linear-gradient(135deg, ${stops.join(', ')})`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatFullDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString('fr-FR', { weekday: 'long' });
  const dayMonth = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${dayMonth} ${y}`;
}

function formatShortDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

async function loadMembers() {
  members = await fetchJSON('/api/members');
}

async function loadEvents() {
  events = await fetchJSON('/api/events');
}

// --- Identity / login screen ---

function renderIdentityScreen() {
  identityList.innerHTML = '';
  members.forEach(member => {
    const btn = document.createElement('button');
    btn.className = 'identity-option';
    btn.innerHTML = `<span class="identity-dot" style="background:${member.color}"></span> ${member.name}`;
    btn.addEventListener('click', () => openLoginForm(member));
    identityList.appendChild(btn);
  });
}

function openLoginForm(member) {
  loginMemberId = member.id;
  loginAs.textContent = `Mot de passe pour ${member.name}`;
  loginPassword.value = '';
  loginError.classList.add('hidden');
  identityList.classList.add('hidden');
  loginForm.classList.remove('hidden');
  loginPassword.focus();
}

function closeLoginForm() {
  loginMemberId = null;
  loginForm.classList.add('hidden');
  identityList.classList.remove('hidden');
}

loginBackBtn.addEventListener('click', closeLoginForm);

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');
  try {
    const member = await fetchJSON('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: loginMemberId, password: loginPassword.value }),
    });
    loginForm.classList.add('hidden');
    identityList.classList.remove('hidden');
    await showApp(member);
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
    loginPassword.value = '';
    loginPassword.focus();
  }
});

function showIdentityScreen() {
  currentMember = null;
  closeLoginForm();
  identityScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

async function showApp(member) {
  currentMember = member;
  currentIdentityEl.textContent = member.name;
  currentIdentityEl.style.setProperty('--pill-color', member.color);
  identityScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  await loadEvents();
  renderCalendar();
  renderDayPanel();
}

switchIdentityBtn.addEventListener('click', async () => {
  await fetchJSON('/api/logout', { method: 'POST' });
  showIdentityScreen();
});

// --- Calendar rendering ---

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  monthLabel.textContent = `${MONTH_LABELS[month]} ${year}`;

  weekdaysRow.innerHTML = '';
  WEEKDAY_LABELS.forEach(label => {
    const div = document.createElement('div');
    div.textContent = label;
    weekdaysRow.appendChild(div);
  });

  const firstOfMonth = new Date(year, month, 1);
  // Monday = 0 ... Sunday = 6
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({ day, date: formatDate(y, m, day), outside: true });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, date: formatDate(year, month, day), outside: false });
  }

  while (cells.length % 7 !== 0) {
    const day = cells.length - (firstWeekday + daysInMonth) + 1;
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    cells.push({ day, date: formatDate(y, m, day), outside: true });
  }

  const today = todayString();

  // événements d'un seul jour : regroupés par date, pour les pastilles habituelles
  const singleDayEventsByDate = new Map();
  events.forEach(ev => {
    if (ev.endDate !== ev.date) return;
    if (!singleDayEventsByDate.has(ev.date)) singleDayEventsByDate.set(ev.date, []);
    singleDayEventsByDate.get(ev.date).push(ev);
  });
  singleDayEventsByDate.forEach(list => {
    list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  });

  // événements sur plusieurs jours : traités par ligne de semaine (voir plus bas)
  const multiDayEvents = events
    .filter(ev => ev.endDate !== ev.date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

  calendarGrid.innerHTML = '';
  const MAX_VISIBLE = 3;

  for (let rowStart = 0; rowStart < cells.length; rowStart += 7) {
    const rowCells = cells.slice(rowStart, rowStart + 7);
    const rowFirstDate = rowCells[0].date;
    const rowLastDate = rowCells[6].date;

    // assignation des barres à des "lanes" (rangées empilées) pour cette semaine :
    // chaque événement garde la même lane sur toute sa traversée de la ligne
    const laneLastCol = [];
    const placements = [];
    multiDayEvents
      .filter(ev => ev.date <= rowLastDate && ev.endDate >= rowFirstDate)
      .forEach(ev => {
        const colStart = ev.date <= rowFirstDate ? 0 : daysBetween(rowFirstDate, ev.date);
        const colEnd = ev.endDate >= rowLastDate ? 6 : daysBetween(rowFirstDate, ev.endDate);
        let lane = laneLastCol.findIndex(lastCol => lastCol < colStart);
        if (lane === -1) {
          lane = laneLastCol.length;
          laneLastCol.push(colEnd);
        } else {
          laneLastCol[lane] = colEnd;
        }
        placements.push({ ev, colStart, colEnd, lane });
      });

    rowCells.forEach((cell, col) => {
      const cellEl = document.createElement('div');
      cellEl.className = 'day-cell'
        + (cell.outside ? ' outside' : '')
        + (cell.date === today ? ' today' : '')
        + (cell.date === selectedDate ? ' selected' : '');

      const numberEl = document.createElement('div');
      numberEl.className = 'day-number';
      numberEl.textContent = cell.date === today ? `${cell.day} · Aujourd'hui` : cell.day;
      cellEl.appendChild(numberEl);

      if (laneLastCol.length > 0) {
        const barsWrap = document.createElement('div');
        barsWrap.className = 'event-bars';
        for (let lane = 0; lane < laneLastCol.length; lane++) {
          const placement = placements.find(p => p.lane === lane && col >= p.colStart && col <= p.colEnd);
          if (!placement) {
            const spacer = document.createElement('div');
            spacer.className = 'event-bar-spacer';
            barsWrap.appendChild(spacer);
            continue;
          }
          const bar = document.createElement('div');
          bar.className = 'event-bar';
          if (col > placement.colStart) bar.classList.add('continues-before');
          if (col < placement.colEnd) bar.classList.add('continues-after');
          bar.style.background = memberAccent(placement.ev.memberIds);
          if (col === placement.colStart) bar.textContent = placement.ev.title;
          bar.addEventListener('click', (e) => {
            e.stopPropagation();
            selectDate(cell.date);
            openEditModal(placement.ev);
          });
          barsWrap.appendChild(bar);
        }
        cellEl.appendChild(barsWrap);
      }

      const dayEvents = singleDayEventsByDate.get(cell.date) || [];
      dayEvents.slice(0, MAX_VISIBLE).forEach(ev => {
        const pill = document.createElement('div');
        pill.className = 'event-pill';
        pill.style.background = memberAccent(ev.memberIds);
        pill.textContent = ev.startTime ? `${ev.startTime} ${ev.title}` : ev.title;
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          selectDate(cell.date);
          openEditModal(ev);
        });
        cellEl.appendChild(pill);
      });

      if (dayEvents.length > MAX_VISIBLE) {
        const more = document.createElement('div');
        more.className = 'event-more';
        more.textContent = `+${dayEvents.length - MAX_VISIBLE} autre(s)`;
        cellEl.appendChild(more);
      }

      cellEl.addEventListener('click', () => selectDate(cell.date));
      calendarGrid.appendChild(cellEl);
    });
  }
}

// sélectionne une date ; bascule automatiquement le mois affiché si cette date
// (clic sur un jour "outside", flèches...) n'appartient pas au mois actuellement montré
function selectDate(date) {
  const [y, m] = date.split('-').map(Number);
  if (y !== currentDate.getFullYear() || m - 1 !== currentDate.getMonth()) {
    currentDate = new Date(y, m - 1, 1);
  }
  selectedDate = date;
  renderCalendar();
  renderDayPanel();
}

function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return formatDate(date.getFullYear(), date.getMonth(), date.getDate());
}

function moveSelection(delta) {
  selectDate(addDays(selectedDate, delta));
}

document.addEventListener('keydown', (e) => {
  if (appScreen.classList.contains('hidden')) return;
  if (!modalOverlay.classList.contains('hidden')) return;
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  switch (e.key) {
    case '+':
      e.preventDefault();
      dayPanelAddBtn.click();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      moveSelection(-1);
      break;
    case 'ArrowRight':
      e.preventDefault();
      moveSelection(1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      moveSelection(-7);
      break;
    case 'ArrowDown':
      e.preventDefault();
      moveSelection(7);
      break;
  }
});

function buildDayPanelItem(ev) {
  const memberNamesHtml = (ev.memberIds || [])
    .map(memberById)
    .filter(Boolean)
    .map(m => `<span class="day-panel-item-member-name" style="color:${m.color}">${escapeHtml(m.name)}</span>`)
    .join(', ');
  const timeHtml = ev.startTime ? `
    <div class="day-panel-item-time">
      <span class="day-panel-item-time-start">${escapeHtml(ev.startTime)}</span>
      ${ev.endTime ? `<span class="day-panel-item-time-end">${escapeHtml(ev.endTime)}</span>` : ''}
    </div>
  ` : '';
  const rangeHtml = ev.endDate !== ev.date
    ? `<div class="day-panel-item-range">Du ${formatShortDate(ev.date)} au ${formatShortDate(ev.endDate)}</div>`
    : '';

  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'day-panel-item';
  item.style.setProperty('--item-accent', memberAccent(ev.memberIds));
  item.innerHTML = `
    ${timeHtml}
    <div class="day-panel-item-body">
      <div class="day-panel-item-title">${escapeHtml(ev.title)}</div>
      ${rangeHtml}
      <div class="day-panel-item-member">${memberNamesHtml}</div>
      ${ev.description ? `<div class="day-panel-item-desc">${escapeHtml(ev.description)}</div>` : ''}
    </div>
  `;
  item.addEventListener('click', () => openEditModal(ev));
  return item;
}

function renderDayPanelSection(title, dayEvents) {
  if (dayEvents.length === 0) return;
  const heading = document.createElement('h3');
  heading.className = 'day-panel-section-title';
  heading.textContent = title;
  dayPanelList.appendChild(heading);
  dayEvents.forEach(ev => dayPanelList.appendChild(buildDayPanelItem(ev)));
}

function renderDayPanel() {
  dayPanelDate.textContent = formatFullDate(selectedDate);

  const dayEvents = events.filter(ev => ev.date <= selectedDate && ev.endDate >= selectedDate);
  const allDayEvents = dayEvents.filter(ev => !ev.startTime);
  const timedEvents = dayEvents
    .filter(ev => ev.startTime)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  dayPanelList.innerHTML = '';

  if (dayEvents.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'day-panel-empty';
    empty.textContent = 'Aucun événement ce jour.';
    dayPanelList.appendChild(empty);
    return;
  }

  renderDayPanelSection('Toute la journée', allDayEvents);
  renderDayPanelSection('Heure précise', timedEvents);
}

dayPanelAddBtn.addEventListener('click', () => openNewModal(selectedDate));

prevMonthBtn.addEventListener('click', () => {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  renderCalendar();
});

todayBtn.addEventListener('click', () => {
  currentDate = new Date();
  selectDate(todayString());
});

// --- Event modal ---

function renderMemberCheckboxes(checkedIds) {
  fieldMembers.innerHTML = '';
  members.forEach(member => {
    const label = document.createElement('label');
    label.className = 'member-checkbox';
    label.style.setProperty('--member-color', member.color);
    const checked = checkedIds.includes(member.id) ? 'checked' : '';
    label.innerHTML = `
      <input type="checkbox" value="${member.id}" ${checked}>
      ${escapeHtml(member.name)}
    `;
    fieldMembers.appendChild(label);
  });
}

function getCheckedMemberIds() {
  return [...fieldMembers.querySelectorAll('input:checked')].map(input => input.value);
}

function openNewModal(date) {
  editingEventId = null;
  modalTitle.textContent = 'Nouvel événement';
  eventForm.reset();
  renderMemberCheckboxes(currentMember ? [currentMember.id] : []);
  fieldDate.value = date;
  fieldEndDate.value = date;
  refreshAllPickers();
  formError.classList.add('hidden');
  deleteEventBtn.classList.add('hidden');
  modalOverlay.classList.remove('hidden');
  fieldTitle.focus();
}

function openEditModal(ev) {
  editingEventId = ev.id;
  modalTitle.textContent = 'Modifier l\'événement';
  renderMemberCheckboxes(ev.memberIds || []);
  fieldTitle.value = ev.title;
  fieldDate.value = ev.date;
  fieldEndDate.value = ev.endDate || ev.date;
  fieldStartTime.value = ev.startTime || '';
  fieldEndTime.value = ev.endTime || '';
  refreshAllPickers();
  fieldDescription.value = ev.description || '';
  formError.classList.add('hidden');
  deleteEventBtn.classList.remove('hidden');
  modalOverlay.classList.remove('hidden');
  fieldTitle.focus();
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  editingEventId = null;
}

fieldDate.addEventListener('change', () => {
  if (fieldEndDate.value && fieldEndDate.value < fieldDate.value) {
    fieldEndDate.value = fieldDate.value;
    refreshFieldEndDatePicker();
  }
});

cancelModalBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
newEventBtn.addEventListener('click', () => openNewModal(selectedDate));

eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.classList.add('hidden');

  const memberIds = getCheckedMemberIds();
  if (memberIds.length === 0) {
    formError.textContent = 'Sélectionne au moins un membre.';
    formError.classList.remove('hidden');
    return;
  }

  const endDate = fieldEndDate.value || fieldDate.value;
  if (endDate < fieldDate.value) {
    formError.textContent = 'La date de fin doit être postérieure ou égale à la date de début.';
    formError.classList.remove('hidden');
    return;
  }

  if (!isValidTimeInput(fieldStartTime.value) || !isValidTimeInput(fieldEndTime.value)) {
    formError.textContent = 'Heure invalide : utilise le format HH:mm (24h), ex. 14:30';
    formError.classList.remove('hidden');
    return;
  }

  const payload = {
    title: fieldTitle.value,
    date: fieldDate.value,
    endDate,
    memberIds,
    startTime: fieldStartTime.value || null,
    endTime: fieldEndTime.value || null,
    description: fieldDescription.value,
  };

  try {
    if (editingEventId) {
      await fetchJSON(`/api/events/${editingEventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetchJSON('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    closeModal();
    await loadEvents();
    renderCalendar();
    renderDayPanel();
  } catch (err) {
    if (err.status === 401) {
      closeModal();
      renderIdentityScreen();
      showIdentityScreen();
      return;
    }
    formError.textContent = err.message;
    formError.classList.remove('hidden');
  }
});

deleteEventBtn.addEventListener('click', async () => {
  if (!editingEventId) return;
  if (!confirm('Supprimer cet événement ?')) return;
  try {
    await fetchJSON(`/api/events/${editingEventId}`, { method: 'DELETE' });
    closeModal();
    await loadEvents();
    renderCalendar();
    renderDayPanel();
  } catch (err) {
    if (err.status === 401) {
      closeModal();
      renderIdentityScreen();
      showIdentityScreen();
      return;
    }
    formError.textContent = err.message;
    formError.classList.remove('hidden');
  }
});

// --- Pickers de date/heure au format européen ---
// Les <input type="date"/"time"> natifs sont conservés cachés (source de vérité pour
// .value, lu/écrit partout ailleurs dans le code) ; on les habille d'un champ visible
// jj/mm/aaaa ou HH:mm avec une petite popup de sélection, indépendante du réglage
// régional du navigateur/OS.

function closeAllPickerPopups() {
  document.querySelectorAll('.picker-popup').forEach(p => p.classList.add('hidden'));
}

function attachDatePicker(nativeInput) {
  nativeInput.style.display = 'none';
  nativeInput.tabIndex = -1;

  const wrap = document.createElement('div');
  wrap.className = 'picker';

  const display = document.createElement('input');
  display.type = 'text';
  display.className = 'picker-display';
  display.placeholder = 'jj/mm/aaaa';
  display.inputMode = 'numeric';
  display.maxLength = 10;

  const popup = document.createElement('div');
  popup.className = 'picker-popup hidden';

  wrap.append(display, popup);
  nativeInput.insertAdjacentElement('afterend', wrap);
  wrap.appendChild(nativeInput); // pour que le champ visible soit le premier descendant "labelable" du <label>

  let viewYear, viewMonth;

  // saisie segmentée jour/mois/année façon <input type="date"> natif : cliquer
  // sélectionne le jour, taper 2 chiffres avance sur le mois puis sur l'année
  const SEGMENTS = [
    { name: 'day', len: 2, start: 0, end: 2, mask: 'jj' },
    { name: 'month', len: 2, start: 3, end: 5, mask: 'mm' },
    { name: 'year', len: 4, start: 6, end: 10, mask: 'aaaa' },
  ];
  let segIndex = 0;
  // vrai juste après avoir (re)sélectionné un segment : le prochain chiffre tapé
  // remplace tout le segment au lieu de s'ajouter à ce qu'il contenait déjà
  let freshSegment = true;
  let parts = { day: '', month: '', year: '' };

  function resetPartsFromValue() {
    if (nativeInput.value) {
      const [y, m, d] = nativeInput.value.split('-');
      parts = { day: d, month: m, year: y };
    } else {
      parts = { day: '', month: '', year: '' };
    }
  }

  function renderDisplay() {
    display.value = SEGMENTS.map(seg => (parts[seg.name] + seg.mask).slice(0, seg.len)).join('/');
  }

  // fresh=true : le segment est entièrement surligné (un chiffre tapé le remplacera) ;
  // fresh=false : simple curseur après le dernier chiffre tapé (le prochain s'ajoute)
  function selectSegment(i, fresh = true) {
    segIndex = i;
    freshSegment = fresh;
    if (fresh) {
      display.setSelectionRange(SEGMENTS[i].start, SEGMENTS[i].end);
    } else {
      const pos = SEGMENTS[i].start + parts[SEGMENTS[i].name].length;
      display.setSelectionRange(pos, pos);
    }
  }

  function syncDisplay() {
    display.value = formatDateEU(nativeInput.value);
  }

  function commitIfComplete() {
    if (parts.day.length === 2 && parts.month.length === 2 && parts.year.length === 4) {
      const iso = parseDateEU(`${parts.day}/${parts.month}/${parts.year}`);
      if (iso) setValue(iso);
    }
  }

  function setValue(iso) {
    nativeInput.value = iso;
    nativeInput.dispatchEvent(new Event('change', { bubbles: true }));
    syncDisplay();
    renderPopup();
  }

  function renderPopup() {
    popup.innerHTML = '';

    const nav = document.createElement('div');
    nav.className = 'picker-nav';
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.textContent = '‹';
    const label = document.createElement('span');
    label.textContent = `${MONTH_LABELS[viewMonth]} ${viewYear}`;
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.textContent = '›';
    prevBtn.addEventListener('click', () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      renderPopup();
    });
    nextBtn.addEventListener('click', () => {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      renderPopup();
    });
    nav.append(prevBtn, label, nextBtn);
    popup.appendChild(nav);

    const weekdaysEl = document.createElement('div');
    weekdaysEl.className = 'picker-weekdays';
    WEEKDAY_LABELS.forEach(l => {
      const s = document.createElement('span');
      s.textContent = l;
      weekdaysEl.appendChild(s);
    });
    popup.appendChild(weekdaysEl);

    const grid = document.createElement('div');
    grid.className = 'picker-grid';

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const today = todayString();

    const cells = [];
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({ day, date: formatDate(y, m, day), outside: true });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day, date: formatDate(viewYear, viewMonth, day), outside: false });
    }
    while (cells.length % 7 !== 0) {
      const day = cells.length - (firstWeekday + daysInMonth) + 1;
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      cells.push({ day, date: formatDate(y, m, day), outside: true });
    }

    cells.forEach(cell => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'picker-day'
        + (cell.outside ? ' outside' : '')
        + (cell.date === today ? ' today' : '')
        + (cell.date === nativeInput.value ? ' selected' : '');
      btn.textContent = cell.day;
      btn.addEventListener('click', () => {
        setValue(cell.date);
        popup.classList.add('hidden');
      });
      grid.appendChild(btn);
    });

    popup.appendChild(grid);
  }

  // point d'entrée commun clic ET tab : repart toujours du jour, avec la
  // valeur actuelle du champ, plutôt que de laisser le navigateur décider
  function startEditing() {
    resetPartsFromValue();
    renderDisplay();
    selectSegment(0);
  }

  display.addEventListener('focus', () => {
    closeAllPickerPopups();
    startEditing();
    const base = nativeInput.value ? nativeInput.value.split('-').map(Number) : null;
    const now = new Date();
    viewYear = base ? base[0] : now.getFullYear();
    viewMonth = base ? base[1] - 1 : now.getMonth();
    renderPopup();
    popup.classList.remove('hidden');
  });

  // clic alors que le champ a déjà le focus : 'focus' ne se redéclenche pas,
  // il faut donc relancer nous-mêmes la sélection du jour
  display.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (document.activeElement === display) {
      startEditing();
    } else {
      display.focus(); // déclenche le handler 'focus' ci-dessus
    }
  });

  display.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const digits = text.replace(/\D/g, '').slice(0, 8);
    parts.day = digits.slice(0, 2);
    parts.month = digits.slice(2, 4);
    parts.year = digits.slice(4, 8);
    renderDisplay();
    segIndex = parts.year ? 2 : parts.month ? 1 : 0;
    selectSegment(segIndex);
    commitIfComplete();
  });

  display.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // ferme la popup avant que le navigateur ne déplace le focus, sinon ses
    // boutons (encore visibles) seraient la prochaine étape du Tab
    if (e.key === 'Tab') { popup.classList.add('hidden'); return; }

    if (e.key === 'Escape') { popup.classList.add('hidden'); return; }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selectSegment(Math.max(0, segIndex - 1));
      return;
    }
    if (e.key === 'ArrowRight' || e.key === '/') {
      e.preventDefault();
      selectSegment(Math.min(SEGMENTS.length - 1, segIndex + 1));
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      const seg = SEGMENTS[segIndex];
      if (parts[seg.name].length > 0) {
        parts[seg.name] = parts[seg.name].slice(0, -1);
        renderDisplay();
        selectSegment(segIndex, false);
      } else if (segIndex > 0) {
        parts[SEGMENTS[segIndex - 1].name] = parts[SEGMENTS[segIndex - 1].name].slice(0, -1);
        renderDisplay();
        selectSegment(segIndex - 1, false);
      }
      return;
    }
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const seg = SEGMENTS[segIndex];
      parts[seg.name] = freshSegment ? e.key : (parts[seg.name] + e.key).slice(0, seg.len);
      renderDisplay();
      if (parts[seg.name].length >= seg.len && segIndex < SEGMENTS.length - 1) {
        selectSegment(segIndex + 1, true);
      } else {
        selectSegment(segIndex, false);
      }
      commitIfComplete();
      return;
    }

    e.preventDefault();
  });

  display.addEventListener('blur', syncDisplay);

  syncDisplay();
  return syncDisplay;
}

const refreshFieldDatePicker = attachDatePicker(fieldDate);
const refreshFieldEndDatePicker = attachDatePicker(fieldEndDate);

// à appeler chaque fois que le code met à jour fieldDate/fieldEndDate directement
// (sans passer par le picker), pour que l'affichage jj/mm/aaaa reste à jour
function refreshAllPickers() {
  refreshFieldDatePicker();
  refreshFieldEndDatePicker();
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.picker')) closeAllPickerPopups();
});

// --- Realtime sync ---

const socket = io();
socket.on('events:changed', async () => {
  if (appScreen.classList.contains('hidden')) return;
  try {
    await loadEvents();
    renderCalendar();
    renderDayPanel();
  } catch (err) {
    if (err.status === 401) {
      renderIdentityScreen();
      showIdentityScreen();
    }
  }
});

// --- Boot ---

(async function init() {
  await loadMembers();
  renderIdentityScreen();
  try {
    const member = await fetchJSON('/api/me');
    await showApp(member);
  } catch (err) {
    showIdentityScreen();
  }
})();
