// --- Navigation entre écrans (side bar sur pc, tab bar sur tel) ---

const mainNav = document.getElementById('mainNav');
const navButtons = [...mainNav.querySelectorAll('.nav-btn')];
const logoK = document.querySelector('.logo-k');

let currentView = 'month';

// rendu paresseux : chaque écran ne se (re)construit que quand on y accède, pas à chaque
// changement ailleurs dans l'app ; les fonctions renderX sont définies dans leur fichier respectif
const VIEW_RENDERERS = {
  agenda: () => renderAgenda(),
  notes: () => renderNotes(),
  todos: () => renderTodos(),
  birthdays: () => renderBirthdays(),
};

// sur la view "month", la tab bar (tel) reste cachée par défaut pour laisser toute la
// place au calendrier ; taper sur le "k" du logo la fait apparaître/disparaître (secret
// toggle). Sur les autres views elle reste normalement affichée (seule façon d'y revenir).
// Le choix est mémorisé dans localStorage pour survivre aux rechargements/prochaines visites.
const TAB_BAR_REVEALED_KEY = 'kalndar_tabbar_revealed';
let monthTabBarRevealed = localStorage.getItem(TAB_BAR_REVEALED_KEY) === '1';

function updateTabBarVisibility() {
  const hidden = currentView === 'month' && !monthTabBarRevealed;
  mainNav.classList.toggle('nav-auto-hidden', hidden);
}

function switchView(name) {
  currentView = name;

  document.querySelectorAll('.app-content > .view').forEach(view => {
    view.classList.toggle('hidden', view.id !== `view-${name}`);
  });
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
  updateTabBarVisibility();

  const render = VIEW_RENDERERS[name];
  if (render) render();
}

navButtons.forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

logoK.addEventListener('click', () => {
  monthTabBarRevealed = !monthTabBarRevealed;
  localStorage.setItem(TAB_BAR_REVEALED_KEY, monthTabBarRevealed ? '1' : '0');
  updateTabBarVisibility();
});

updateTabBarVisibility();
