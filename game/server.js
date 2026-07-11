const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('trust proxy', 1); // derrière nginx : nécessaire pour que req.secure reflète X-Forwarded-Proto
app.use(express.json());
app.use(express.static('public'));

const membersPath = path.join(__dirname, 'data/members.json');
const eventsPath = path.join(__dirname, 'data', 'events.json');
const sessionSecretPath = path.join(__dirname, 'data', 'session-secret');

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

function loadOrCreateSessionSecret() {
  try {
    return fs.readFileSync(sessionSecretPath, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(path.dirname(sessionSecretPath), { recursive: true });
    fs.writeFileSync(sessionSecretPath, secret);
    return secret;
  }
}

const sessionSecret = loadOrCreateSessionSecret();
const SESSION_COOKIE = 'kalndar_session';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 90; // 90 jours

function isValidDate(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function isValidTime(str) {
  return str == null || str === '' || /^\d{2}:\d{2}$/.test(str);
}

function memberById(id) {
  return members.find(m => m.id === id);
}

function publicMember(member) {
  return { id: member.id, name: member.name, color: member.color };
}

// stored = "saltHex:hashHex", généré à la main via scripts/hash-password.js
function verifyPassword(password, stored) {
  if (typeof password !== 'string' || !password || typeof stored !== 'string') return false;
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;

  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hashHex, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function sign(value) {
  return crypto.createHmac('sha256', sessionSecret).update(value).digest('hex');
}

function createSessionToken(memberId) {
  return `${memberId}.${sign(memberId)}`;
}

function verifySessionToken(token) {
  if (typeof token !== 'string') return null;
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return null;
  const memberId = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  if (!memberIds.has(memberId)) return null;

  const expected = sign(memberId);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return memberId;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function requireAuth(req, res, next) {
  const cookies = parseCookies(req);
  const memberId = verifySessionToken(cookies[SESSION_COOKIE]);
  if (!memberId) return res.status(401).json({ error: 'Non authentifié' });
  req.memberId = memberId;
  next();
}

function setSessionCookie(res, memberId) {
  res.cookie(SESSION_COOKIE, createSessionToken(memberId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: SESSION_MAX_AGE_MS,
  });
}

app.get('/api/members', (req, res) => {
  res.json(members.map(publicMember));
});

app.get('/api/me', (req, res) => {
  const cookies = parseCookies(req);
  const memberId = verifySessionToken(cookies[SESSION_COOKIE]);
  if (!memberId) return res.status(401).json({ error: 'Non authentifié' });
  res.json(publicMember(memberById(memberId)));
});

app.post('/api/login', (req, res) => {
  const { memberId, password } = req.body || {};
  const member = memberById(memberId);

  if (!member || !verifyPassword(password, member.passwordHash)) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  }

  setSessionCookie(res, member.id);
  res.json(publicMember(member));
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.status(204).end();
});

app.get('/api/events', requireAuth, (req, res) => {
  res.json(events);
});

app.post('/api/events', requireAuth, (req, res) => {
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

app.put('/api/events/:id', requireAuth, (req, res) => {
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

app.delete('/api/events/:id', requireAuth, (req, res) => {
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
