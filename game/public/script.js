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
const fieldMember = document.getElementById('fieldMember');
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
  const eventsByDate = new Map();
  events.forEach(ev => {
    if (!eventsByDate.has(ev.date)) eventsByDate.set(ev.date, []);
    eventsByDate.get(ev.date).push(ev);
  });
  eventsByDate.forEach(list => {
    list.sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
  });

  calendarGrid.innerHTML = '';
  const MAX_VISIBLE = 3;

  cells.forEach(cell => {
    const cellEl = document.createElement('div');
    cellEl.className = 'day-cell'
      + (cell.outside ? ' outside' : '')
      + (cell.date === today ? ' today' : '')
      + (cell.date === selectedDate ? ' selected' : '');

    const numberEl = document.createElement('div');
    numberEl.className = 'day-number';
    numberEl.textContent = cell.day;
    cellEl.appendChild(numberEl);

    const dayEvents = eventsByDate.get(cell.date) || [];
    dayEvents.slice(0, MAX_VISIBLE).forEach(ev => {
      const member = memberById(ev.memberId);
      const pill = document.createElement('div');
      pill.className = 'event-pill';
      pill.style.background = member ? member.color : '#999';
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

function selectDate(date) {
  selectedDate = date;
  renderCalendar();
  renderDayPanel();
}

function buildDayPanelItem(ev) {
  const member = memberById(ev.memberId);
  const timeHtml = ev.startTime ? `
    <div class="day-panel-item-time">
      <span class="day-panel-item-time-start">${escapeHtml(ev.startTime)}</span>
      ${ev.endTime ? `<span class="day-panel-item-time-end">${escapeHtml(ev.endTime)}</span>` : ''}
    </div>
  ` : '';

  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'day-panel-item';
  item.style.setProperty('--item-color', member ? member.color : '#999');
  item.innerHTML = `
    ${timeHtml}
    <div class="day-panel-item-body">
      <div class="day-panel-item-title">${escapeHtml(ev.title)}</div>
      <div class="day-panel-item-member">${escapeHtml(member ? member.name : '')}</div>
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

  const dayEvents = events.filter(ev => ev.date === selectedDate);
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

function populateMemberSelect() {
  fieldMember.innerHTML = '';
  members.forEach(member => {
    const option = document.createElement('option');
    option.value = member.id;
    option.textContent = member.name;
    fieldMember.appendChild(option);
  });
}

function openNewModal(date) {
  editingEventId = null;
  modalTitle.textContent = 'Nouvel événement';
  eventForm.reset();
  populateMemberSelect();
  fieldDate.value = date;
  if (currentMember) fieldMember.value = currentMember.id;
  formError.classList.add('hidden');
  deleteEventBtn.classList.add('hidden');
  modalOverlay.classList.remove('hidden');
  fieldTitle.focus();
}

function openEditModal(ev) {
  editingEventId = ev.id;
  modalTitle.textContent = 'Modifier l\'événement';
  populateMemberSelect();
  fieldTitle.value = ev.title;
  fieldDate.value = ev.date;
  fieldMember.value = ev.memberId;
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

cancelModalBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
newEventBtn.addEventListener('click', () => openNewModal(selectedDate));

eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.classList.add('hidden');

  const payload = {
    title: fieldTitle.value,
    date: fieldDate.value,
    memberId: fieldMember.value,
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
