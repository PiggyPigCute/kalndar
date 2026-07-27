// --- Agenda : vue verticale par heure (un seul jour visible sur tel, semaine complète sur pc,
// le CSS masque simplement les 6 colonnes non sélectionnées en dessous de 900px) ---

const agendaGrid = document.getElementById('agendaGrid');
const agendaLabel = document.getElementById('agendaLabel');
const agendaPrevBtn = document.getElementById('agendaPrevBtn');
const agendaNextBtn = document.getElementById('agendaNextBtn');
const agendaTodayBtn = document.getElementById('agendaTodayBtn');
const agendaAddBtn = document.getElementById('agendaAddBtn');

const AGENDA_HOUR_HEIGHT = 48; // px par heure dans la grille horaire

function isAgendaWeekMode() {
  return !window.matchMedia('(max-width: 899px)').matches;
}

// lundi de la semaine contenant dateStr
function startOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = (date.getDay() + 6) % 7; // Lun=0 ... Dim=6
  date.setDate(date.getDate() - dow);
  return formatDate(date.getFullYear(), date.getMonth(), date.getDate());
}

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// place les événements à heure précise d'une journée dans des colonnes qui ne se
// chevauchent pas (algorithme glouton : chaque événement prend la première colonne
// dont le dernier événement se termine avant qu'il ne commence), même principe que
// les "lanes" des barres multi-jours du calendrier mensuel
function layoutTimedEvents(dayEvents) {
  const items = dayEvents
    .map(ev => ({
      ev,
      startMin: timeToMinutes(ev.startTime),
      endMin: ev.endTime ? timeToMinutes(ev.endTime) : timeToMinutes(ev.startTime) + 60,
    }))
    .sort((a, b) => a.startMin - b.startMin);

  const columnEnds = [];
  items.forEach(item => {
    let col = columnEnds.findIndex(endMin => endMin <= item.startMin);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(item.endMin);
    } else {
      columnEnds[col] = item.endMin;
    }
    item.col = col;
  });

  const colCount = columnEnds.length || 1;
  return items.map(item => ({ ...item, colCount }));
}

function buildAgendaChip(ev) {
  const chip = document.createElement('div');
  chip.className = 'agenda-chip';
  chip.style.background = memberAccent(ev.memberIds);
  chip.textContent = ev.title;
  chip.addEventListener('click', () => openDetailModal(ev));
  return chip;
}

function renderAgendaDayColumn(dayCol, allDayCell, headerCell, date, isWeekend, dayEvents) {
  const today = todayString();
  const holidayName = getFrenchHolidays(Number(date.slice(0, 4))).get(date);

  headerCell.classList.toggle('today', date === today);
  headerCell.classList.toggle('weekend', isWeekend || !!holidayName);
  headerCell.classList.toggle('is-selected', date === selectedDate);
  allDayCell.classList.toggle('weekend', isWeekend || !!holidayName);
  allDayCell.classList.toggle('is-selected', date === selectedDate);
  dayCol.classList.toggle('is-selected', date === selectedDate);

  const [y, m, d] = date.split('-').map(Number);
  const weekdayLabel = new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'short' });
  headerCell.innerHTML = `
    <span class="agenda-weekday">${weekdayLabel}</span>
    <span class="agenda-daynum">${d}</span>
  `;
  headerCell.onclick = () => { selectDate(date); renderAgenda(); };

  const multiDay = dayEvents.filter(ev => ev.endDate !== ev.date);
  const allDay = dayEvents.filter(ev => ev.endDate === ev.date && !ev.startTime);
  const timed = dayEvents.filter(ev => ev.endDate === ev.date && ev.startTime);

  allDayCell.innerHTML = '';
  [...multiDay, ...allDay].forEach(ev => allDayCell.appendChild(buildAgendaChip(ev)));

  dayCol.innerHTML = '';
  dayCol.style.height = `${24 * AGENDA_HOUR_HEIGHT}px`;
  dayCol.style.backgroundImage = `repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${AGENDA_HOUR_HEIGHT}px)`;

  layoutTimedEvents(timed).forEach(({ ev, startMin, endMin, col, colCount }) => {
    const block = document.createElement('div');
    block.className = 'agenda-event-block';
    block.style.top = `${(startMin / 60) * AGENDA_HOUR_HEIGHT}px`;
    block.style.height = `${Math.max(18, ((endMin - startMin) / 60) * AGENDA_HOUR_HEIGHT - 2)}px`;
    block.style.left = `${(col / colCount) * 100}%`;
    block.style.width = `${(1 / colCount) * 100}%`;
    block.style.background = memberAccent(ev.memberIds);
    block.textContent = `${ev.startTime} ${ev.title}`;
    block.addEventListener('click', () => openDetailModal(ev));
    dayCol.appendChild(block);
  });
}

function renderAgenda() {
  const weekMode = isAgendaWeekMode();
  const weekStart = startOfWeek(selectedDate);

  agendaLabel.textContent = weekMode
    ? `Semaine du ${formatShortDate(weekStart)} au ${formatShortDate(addDays(weekStart, 6))}`
    : formatFullDate(selectedDate);

  agendaGrid.innerHTML = '';

  const daysHeader = document.createElement('div');
  daysHeader.className = 'agenda-days-header';
  daysHeader.appendChild(Object.assign(document.createElement('div'), { className: 'agenda-gutter' }));

  const alldayRow = document.createElement('div');
  alldayRow.className = 'agenda-allday-row';
  alldayRow.appendChild(Object.assign(document.createElement('div'), { className: 'agenda-gutter' }));

  const hoursRow = document.createElement('div');
  hoursRow.className = 'agenda-hours-row';
  const hoursGutter = document.createElement('div');
  hoursGutter.className = 'agenda-hours-gutter';
  hoursGutter.style.height = `${24 * AGENDA_HOUR_HEIGHT}px`;
  for (let h = 1; h < 24; h++) {
    const label = document.createElement('div');
    label.className = 'agenda-hour-label';
    label.style.top = `${h * AGENDA_HOUR_HEIGHT}px`;
    label.textContent = `${pad(h)}:00`;
    hoursGutter.appendChild(label);
  }
  hoursRow.appendChild(hoursGutter);

  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const dayEvents = events.filter(ev => ev.date <= date && ev.endDate >= date);

    const headerCell = document.createElement('div');
    headerCell.className = 'agenda-day-header';
    daysHeader.appendChild(headerCell);

    const allDayCell = document.createElement('div');
    allDayCell.className = 'agenda-allday-cell';
    alldayRow.appendChild(allDayCell);

    const dayCol = document.createElement('div');
    dayCol.className = 'agenda-day-col';
    hoursRow.appendChild(dayCol);

    const isWeekend = i === 5 || i === 6; // Sam, Dim (weekStart = lundi)
    renderAgendaDayColumn(dayCol, allDayCell, headerCell, date, isWeekend, dayEvents);
  }

  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'agenda-scroll-wrap';
  scrollWrap.appendChild(hoursRow);

  agendaGrid.append(daysHeader, alldayRow, scrollWrap);

  // scroll initial vers une heure raisonnable plutôt que 00:00
  scrollWrap.scrollTop = Math.max(0, 7 * AGENDA_HOUR_HEIGHT - 40);
}

agendaPrevBtn.addEventListener('click', () => {
  selectDate(addDays(selectedDate, isAgendaWeekMode() ? -7 : -1));
  renderAgenda();
});

agendaNextBtn.addEventListener('click', () => {
  selectDate(addDays(selectedDate, isAgendaWeekMode() ? 7 : 1));
  renderAgenda();
});

agendaTodayBtn.addEventListener('click', () => {
  selectDate(todayString());
  renderAgenda();
});

agendaAddBtn.addEventListener('click', () => openNewModal(selectedDate));
