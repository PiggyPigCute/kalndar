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
