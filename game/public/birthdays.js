// --- Anniversaires : liste nom + date que chaque utilisateur remplit pour soi (jamais
// partagée). Pas d'intégration avec les notifications/le calendrier dans cette passe. ---

const birthdayForm = document.getElementById('birthdayForm');
const birthdayNameInput = document.getElementById('birthdayNameInput');
const birthdayDateInput = document.getElementById('birthdayDateInput');
const birthdayList = document.getElementById('birthdayList');

const refreshBirthdayDatePicker = attachDatePicker(birthdayDateInput);

let birthdays = [];

// prochaine occurrence (jour/mois) à partir d'aujourd'hui, pour trier la liste
function nextOccurrenceTime(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  const today = new Date();
  const occurrence = new Date(today.getFullYear(), m - 1, d);
  occurrence.setHours(0, 0, 0, 0);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (occurrence < todayMidnight) occurrence.setFullYear(occurrence.getFullYear() + 1);
  return occurrence.getTime();
}

function sortedBirthdays() {
  return [...birthdays].sort((a, b) => nextOccurrenceTime(a.date) - nextOccurrenceTime(b.date));
}

function renderBirthdayList() {
  birthdayList.innerHTML = '';
  if (birthdays.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'notes-empty';
    empty.textContent = 'Aucun anniversaire enregistré.';
    birthdayList.appendChild(empty);
    return;
  }

  sortedBirthdays().forEach(birthday => {
    const item = document.createElement('div');
    item.className = 'birthday-item';

    const name = document.createElement('span');
    name.className = 'birthday-item-name';
    name.textContent = birthday.name;

    const date = document.createElement('span');
    date.className = 'birthday-item-date';
    date.textContent = formatShortDate(birthday.date);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'birthday-item-delete';
    deleteBtn.setAttribute('aria-label', 'Supprimer');
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', () => deleteBirthday(birthday.id));

    item.append(name, date, deleteBtn);
    birthdayList.appendChild(item);
  });
}

async function deleteBirthday(id) {
  try {
    await fetchJSON(`/api/birthdays/${id}`, { method: 'DELETE' });
    birthdays = birthdays.filter(b => b.id !== id);
    renderBirthdayList();
  } catch (err) {
    if (err.status === 401) { showIdentityScreen(); return; }
    console.error('Suppression anniversaire :', err);
  }
}

birthdayForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = birthdayNameInput.value.trim();
  if (!name || !birthdayDateInput.value) return;

  try {
    const birthday = await fetchJSON('/api/birthdays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, date: birthdayDateInput.value }),
    });
    birthdays.push(birthday);
    birthdayForm.reset();
    refreshBirthdayDatePicker();
    renderBirthdayList();
  } catch (err) {
    if (err.status === 401) { showIdentityScreen(); return; }
    console.error('Ajout anniversaire :', err);
  }
});

async function renderBirthdays() {
  try {
    birthdays = await fetchJSON('/api/birthdays');
  } catch (err) {
    if (err.status === 401) { showIdentityScreen(); return; }
    console.error('Anniversaires indisponibles :', err);
    return;
  }
  renderBirthdayList();
}
