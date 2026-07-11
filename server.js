const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

const membersPath = path.join(__dirname, 'members.json');
const eventsPath = path.join(__dirname, 'data', 'events.json');

const members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
const memberIds = new Set(members.map(m => m.id));

function loadEvents() {
  try {
    return JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
  } catch {
    return [];
  }
}

function saveEvents() {
  fs.mkdirSync(path.dirname(eventsPath), { recursive: true });
  fs.writeFileSync(eventsPath, JSON.stringify(events, null, 2));
}

let events = loadEvents();

function isValidDate(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function isValidTime(str) {
  return str == null || str === '' || /^\d{2}:\d{2}$/.test(str);
}

app.get('/api/members', (req, res) => {
  res.json(members);
});

app.get('/api/events', (req, res) => {
  res.json(events);
});

app.post('/api/events', (req, res) => {
  const { title, date, startTime, endTime, description, memberId } = req.body || {};

  if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Titre requis' });
  if (!isValidDate(date)) return res.status(400).json({ error: 'Date invalide' });
  if (!isValidTime(startTime) || !isValidTime(endTime)) return res.status(400).json({ error: 'Heure invalide' });
  if (!memberIds.has(memberId)) return res.status(400).json({ error: 'Membre invalide' });

  const event = {
    id: crypto.randomUUID(),
    title: title.trim().slice(0, 200),
    date,
    startTime: startTime || null,
    endTime: endTime || null,
    description: typeof description === 'string' ? description.trim().slice(0, 2000) : '',
    memberId,
  };

  events.push(event);
  saveEvents();
  io.emit('events:changed');
  res.status(201).json(event);
});

app.put('/api/events/:id', (req, res) => {
  const event = events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Événement introuvable' });

  const { title, date, startTime, endTime, description, memberId } = req.body || {};

  if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Titre requis' });
  if (!isValidDate(date)) return res.status(400).json({ error: 'Date invalide' });
  if (!isValidTime(startTime) || !isValidTime(endTime)) return res.status(400).json({ error: 'Heure invalide' });
  if (!memberIds.has(memberId)) return res.status(400).json({ error: 'Membre invalide' });

  event.title = title.trim().slice(0, 200);
  event.date = date;
  event.startTime = startTime || null;
  event.endTime = endTime || null;
  event.description = typeof description === 'string' ? description.trim().slice(0, 2000) : '';
  event.memberId = memberId;

  saveEvents();
  io.emit('events:changed');
  res.json(event);
});

app.delete('/api/events/:id', (req, res) => {
  const index = events.findIndex(e => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Événement introuvable' });

  events.splice(index, 1);
  saveEvents();
  io.emit('events:changed');
  res.status(204).end();
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Kalndar lancé sur http://localhost:${PORT}`);
});
