// --- TODO : liste de tâches à cocher, propre à chaque utilisateur (jamais partagée) ---

const todoForm = document.getElementById('todoForm');
const todoInput = document.getElementById('todoInput');
const todoList = document.getElementById('todoList');

let todos = [];

function renderTodoList() {
  todoList.innerHTML = '';
  if (todos.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'notes-empty';
    empty.textContent = 'Aucune tâche.';
    todoList.appendChild(empty);
    return;
  }

  todos.forEach(todo => {
    const item = document.createElement('div');
    item.className = 'todo-item' + (todo.done ? ' done' : '');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.done;
    checkbox.addEventListener('change', () => toggleTodoDone(todo.id, checkbox.checked));

    const text = document.createElement('span');
    text.className = 'todo-item-text';
    text.textContent = todo.text;

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'todo-item-delete';
    deleteBtn.setAttribute('aria-label', 'Supprimer');
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

    item.append(checkbox, text, deleteBtn);
    todoList.appendChild(item);
  });
}

async function toggleTodoDone(id, done) {
  const todo = todos.find(t => t.id === id);
  try {
    const updated = await fetchJSON(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    });
    if (todo) Object.assign(todo, updated);
    renderTodoList();
  } catch (err) {
    if (err.status === 401) { showIdentityScreen(); return; }
    console.error('Tâche :', err);
  }
}

async function deleteTodo(id) {
  try {
    await fetchJSON(`/api/todos/${id}`, { method: 'DELETE' });
    todos = todos.filter(t => t.id !== id);
    renderTodoList();
  } catch (err) {
    if (err.status === 401) { showIdentityScreen(); return; }
    console.error('Suppression tâche :', err);
  }
}

todoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (!text) return;

  try {
    const todo = await fetchJSON('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    todos.push(todo);
    todoInput.value = '';
    renderTodoList();
  } catch (err) {
    if (err.status === 401) { showIdentityScreen(); return; }
    console.error('Ajout tâche :', err);
  }
});

async function renderTodos() {
  try {
    todos = await fetchJSON('/api/todos');
  } catch (err) {
    if (err.status === 401) { showIdentityScreen(); return; }
    console.error('Tâches indisponibles :', err);
    return;
  }
  renderTodoList();
}
