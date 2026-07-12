const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('trust proxy', 1); // derrière nginx : nécessaire pour que req.secure reflète X-Forwarded-Proto
app.use(express.json());
app.use(express.static('public'));

const membersPath = path.join(__dirname, 'data/members.json');
const eventsPath = path.join(__dirname, 'data', 'events.json');
const sessionSecretPath = path.join(__dirname, 'data', 'session-secret');
const vapidKeysPath = path.join(__dirname, 'data', 'vapid-keys.json');
const pushSubscriptionsPath = path.join(__dirname, 'data', 'push-subscriptions.json');

const members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
const validMemberIds = new Set(members.map(m => m.id));

function loadEvents() {
  try {
    const raw = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
    return raw.map(migrateEvent);
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

function loadOrCreateVapidKeys() {
  try {
    return JSON.parse(fs.readFileSync(vapidKeysPath, 'utf8'));
  } catch {
    const keys = webpush.generateVAPIDKeys();
    fs.mkdirSync(path.dirname(vapidKeysPath), { recursive: true });
    fs.writeFileSync(vapidKeysPath, JSON.stringify(keys, null, 2));
    return keys;
  }
}

function loadPushSubscriptions() {
  try {
    return JSON.parse(fs.readFileSync(pushSubscriptionsPath, 'utf8'));
  } catch {
    return {};
  }
}

function savePushSubscriptions() {
  fs.mkdirSync(path.dirname(pushSubscriptionsPath), { recursive: true });
  fs.writeFileSync(pushSubscriptionsPath, JSON.stringify(pushSubscriptions, null, 2));
}

// { [memberId]: [ { endpoint, keys: { p256dh, auth } }, ... ] } — plusieurs appareils par membre
let pushSubscriptions = loadPushSubscriptions();

const vapidKeys = loadOrCreateVapidKeys();
webpush.setVapidDetails('mailto:admin@localhost', vapidKeys.publicKey, vapidKeys.privateKey);

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
  if (!validMemberIds.has(memberId)) return null;

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

app.get('/api/push/public-key', requireAuth, (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/push/subscribe', requireAuth, (req, res) => {
  const subscription = req.body;
  if (!subscription || typeof subscription.endpoint !== 'string' || !subscription.keys) {
    return res.status(400).json({ error: 'Abonnement invalide' });
  }

  const list = pushSubscriptions[req.memberId] || [];
  if (!list.some(s => s.endpoint === subscription.endpoint)) {
    list.push(subscription);
    pushSubscriptions[req.memberId] = list;
    savePushSubscriptions();
  }
  res.status(204).end();
});

app.post('/api/push/unsubscribe', requireAuth, (req, res) => {
  const { endpoint } = req.body || {};
  const list = pushSubscriptions[req.memberId];
  if (list && endpoint) {
    pushSubscriptions[req.memberId] = list.filter(s => s.endpoint !== endpoint);
    savePushSubscriptions();
  }
  res.status(204).end();
});

function normalizeMemberIds(memberIds) {
  if (!Array.isArray(memberIds)) return null;
  const unique = [...new Set(memberIds)];
  if (unique.length === 0 || !unique.every(id => validMemberIds.has(id))) return null;
  return unique;
}

// une date de fin absente vaut date de début (événement d'un seul jour) ; sinon elle doit être valide et >= date de début
function normalizeEndDate(date, endDate) {
  if (!endDate) return date;
  if (!isValidDate(endDate) || endDate < date) return null;
  return endDate;
}

app.post('/api/events', requireAuth, (req, res) => {
  const { title, date, endDate, startTime, endTime, description, memberIds, notify } = req.body || {};

  if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Titre requis' });
  if (!isValidDate(date)) return res.status(400).json({ error: 'Date invalide' });
  if (!isValidTime(startTime) || !isValidTime(endTime)) return res.status(400).json({ error: 'Heure invalide' });

  const normalizedEndDate = normalizeEndDate(date, endDate);
  if (!normalizedEndDate) return res.status(400).json({ error: 'Date de fin invalide' });

  const normalizedMemberIds = normalizeMemberIds(memberIds);
  if (!normalizedMemberIds) return res.status(400).json({ error: 'Au moins un membre valide requis' });

  const event = {
    id: crypto.randomUUID(),
    title: title.trim().slice(0, 200),
    date,
    endDate: normalizedEndDate,
    startTime: startTime || null,
    endTime: endTime || null,
    description: typeof description === 'string' ? description.trim().slice(0, 2000) : '',
    memberIds: normalizedMemberIds,
    notify: notify === true,
  };

  events.push(event);
  saveEvents();
  io.emit('events:changed');
  res.status(201).json(event);
});

app.put('/api/events/:id', requireAuth, (req, res) => {
  const event = events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Événement introuvable' });

  const { title, date, endDate, startTime, endTime, description, memberIds, notify } = req.body || {};

  if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Titre requis' });
  if (!isValidDate(date)) return res.status(400).json({ error: 'Date invalide' });
  if (!isValidTime(startTime) || !isValidTime(endTime)) return res.status(400).json({ error: 'Heure invalide' });

  const normalizedEndDate = normalizeEndDate(date, endDate);
  if (!normalizedEndDate) return res.status(400).json({ error: 'Date de fin invalide' });

  const normalizedMemberIds = normalizeMemberIds(memberIds);
  if (!normalizedMemberIds) return res.status(400).json({ error: 'Au moins un membre valide requis' });

  event.title = title.trim().slice(0, 200);
  event.date = date;
  event.endDate = normalizedEndDate;
  event.startTime = startTime || null;
  event.endTime = endTime || null;
  event.description = typeof description === 'string' ? description.trim().slice(0, 2000) : '';
  event.memberIds = normalizedMemberIds;
  event.notify = notify === true;

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

// --- Notifications push ---

const LEAD_MINUTES = 30; // rappel avant un événement à heure précise
const MORNING_HOUR = 8; // heure du rappel le jour même pour un événement "toute la journée"

// en mémoire seulement : évite de renotifier deux fois le même événement tant
// que le serveur tourne (une redémarrage peut donc, au pire, renvoyer un rappel)
const notifiedEvents = new Set();

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function eventStartDate(ev) {
  const [y, m, d] = ev.date.split('-').map(Number);
  const [h, min] = ev.startTime.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

async function sendPushToMembers(memberIds, payload) {
  const body = JSON.stringify(payload);
  for (const memberId of memberIds) {
    const subs = pushSubscriptions[memberId] || [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, body);
      } catch (err) {
        console.error(`Push échoué pour ${memberId} (${err.statusCode || '?'}) :`, err.body || err.message);
        if (err.statusCode === 404 || err.statusCode === 410) {
          pushSubscriptions[memberId] = (pushSubscriptions[memberId] || []).filter(s => s.endpoint !== sub.endpoint);
          savePushSubscriptions();
        }
      }
    }
  }
}

function checkUpcomingEvents() {
  const now = new Date();
  const todayStr = todayISO();

  events.forEach(ev => {
    if (!ev.notify) return;
    if (ev.startTime) {
      const key = `${ev.id}:timed`;
      if (notifiedEvents.has(key)) return;
      const start = eventStartDate(ev);
      const notifyAt = new Date(start.getTime() - LEAD_MINUTES * 60000);
      if (now >= notifyAt && now < start) {
        notifiedEvents.add(key);
        sendPushToMembers(ev.memberIds, {
          title: ev.title,
          body: `à ${ev.startTime}${ev.description ? ' — ' + ev.description : ''}`,
          url: '/',
        });
      }
    } else if (ev.date === todayStr) {
      const key = `${ev.id}:allday:${todayStr}`;
      if (notifiedEvents.has(key)) return;
      if (now.getHours() >= MORNING_HOUR) {
        notifiedEvents.add(key);
        sendPushToMembers(ev.memberIds, {
          title: ev.title,
          body: ev.endDate !== ev.date ? 'Toute la journée (sur plusieurs jours)' : 'Toute la journée',
          url: '/',
        });
      }
    }
  });
}

setInterval(checkUpcomingEvents, 60 * 1000);
checkUpcomingEvents();

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Kalndar lancé sur http://localhost:${PORT}`);
});
