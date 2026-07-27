// --- Navigation entre écrans (side bar sur pc, tab bar sur tel) ---

const mainNav = document.getElementById('mainNav');
const navButtons = [...mainNav.querySelectorAll('.nav-btn')];

let currentView = 'month';

// rendu paresseux : chaque écran ne se (re)construit que quand on y accède, pas à chaque
// changement ailleurs dans l'app ; les fonctions renderX sont définies dans leur fichier respectif
const VIEW_RENDERERS = {
  agenda: () => renderAgenda(),
  notes: () => renderNotes(),
  todos: () => renderTodos(),
  birthdays: () => renderBirthdays(),
};

function switchView(name) {
  currentView = name;
  document.querySelectorAll('.app-content > .view').forEach(view => {
    view.classList.toggle('hidden', view.id !== `view-${name}`);
  });
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));

  const render = VIEW_RENDERERS[name];
  if (render) render();
}

navButtons.forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});
