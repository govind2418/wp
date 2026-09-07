require('dotenv').config();
const express = require('express');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const fsPromises = require('fs/promises');
const { spawn } = require('child_process');
const multer = require('multer');
const { Redis } = require('@upstash/redis');
const { put, list, del } = require('@vercel/blob');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

const app = express();
const PORT = process.env.PORT || 3000;

// Browsers can't record audio in a container WhatsApp accepts (WebM is
// rejected outright; Chrome's "audio/mp4" output is a fragmented stream
// Meta's validator rejects as application/octet-stream despite the label).
// Every uploaded audio file is re-encoded to mono Ogg/Opus before it
// reaches Blob storage, regardless of its declared mimetype.

async function transcodeToOggOpus(inputBuffer) {
  const base = path.join(os.tmpdir(), `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const inPath = `${base}.in`;
  const outPath = `${base}.ogg`;
  await fsPromises.writeFile(inPath, inputBuffer);

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, ['-y', '-i', inPath, '-ac', '1', '-c:a', 'libopus', '-b:a', '32k', '-f', 'ogg', outPath]);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', async (code) => {
      const cleanup = () => Promise.all([
        fsPromises.unlink(inPath).catch(() => {}),
        fsPromises.unlink(outPath).catch(() => {}),
      ]);
      if (code !== 0) {
        await cleanup();
        return reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
      }
      try {
        const outBuffer = await fsPromises.readFile(outPath);
        await cleanup();
        resolve(outBuffer);
      } catch (err) {
        await cleanup();
        reject(err);
      }
    });
  });
}

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : null;

// Messages are stored as a Hash (key = WhatsApp's own message id, so incoming
// delivery/read status webhooks can update the right record) plus an ordered
// list of ids for pagination — an append-only list alone can't be updated by id.
const MESSAGES_HASH = 'wa:messages';
const MESSAGES_ORDER = 'wa:messages:order';
const MAX_STORED_MESSAGES = 1000;

async function logMessage(entry) {
  if (!redis) return null;
  const id = entry.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = { status: entry.direction === 'sent' ? 'sent' : undefined, timestamp: Date.now(), ...entry, id };
  await redis.hset(MESSAGES_HASH, { [id]: JSON.stringify(record) });
  await redis.lpush(MESSAGES_ORDER, id);
  await redis.ltrim(MESSAGES_ORDER, 0, MAX_STORED_MESSAGES - 1);
  return record;
}

// Merges a delivery-status update (sent/delivered/read/failed) from Meta's
// webhook into an existing sent-message record, matched by WhatsApp message id.
async function updateMessageStatus(id, status, extra = {}) {
  if (!redis || !id) return;
  const raw = await redis.hget(MESSAGES_HASH, id);
  if (!raw) return; // message predates this feature, or was trimmed
  const record = typeof raw === 'string' ? JSON.parse(raw) : raw;
  await redis.hset(MESSAGES_HASH, { [id]: JSON.stringify({ ...record, status, ...extra }) });
}

async function getMessages(limit = 500) {
  if (!redis) return [];
  const ids = await redis.lrange(MESSAGES_ORDER, 0, limit - 1);
  if (!ids.length) return [];
  const map = await redis.hmget(MESSAGES_HASH, ...ids);
  return ids
    .map((id) => map[id])
    .filter(Boolean)
    .map((r) => (typeof r === 'string' ? JSON.parse(r) : r));
}

// Saved contacts (from CSV import) — a Hash keyed by cleaned phone number,
// separate from the message log so a contact persists even before any
// message has ever been sent to or received from them.
const CONTACTS_KEY = 'wa:contacts';

async function getContacts() {
  if (!redis) return [];
  const all = await redis.hgetall(CONTACTS_KEY);
  return Object.values(all || {}).map((r) => (typeof r === 'string' ? JSON.parse(r) : r));
}

// Turns an outgoing Graph API request body into a short human-readable
// summary for the Inbox (e.g. "Template: hello_world" or the raw text).
function describeSentBody(body) {
  if (body.type === 'template') {
    const params = body.template.components?.[0]?.parameters || [];
    const vars = params.map((p) => p.text).join(', ');
    return `Template: ${body.template.name}${vars ? ` (${vars})` : ''}`;
  }
  if (body.type === 'text') return body.text.body;
  if (['image', 'document', 'video', 'audio'].includes(body.type)) {
    const media = body[body.type];
    return media.caption || media.filename || `[${body.type}]`;
  }
  return `[${body.type}]`;
}

// Vercel's filesystem is read-only at runtime, so uploads go straight to
// Vercel Blob (public storage) instead of disk — Meta needs a public URL
// to fetch the media from anyway.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 }, // WhatsApp media limits are ~16MB for most types
});

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const GRAPH_API_VERSION = 'v25.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const WHATSAPP_API_URL = `${GRAPH_BASE}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

// ---------------------------------------------------------------------------
// Owner-only PIN gate. Everything except the login page itself, the assets
// it needs, and Meta's own webhook/cron callbacks requires a valid session
// cookie. Sessions are opaque random tokens looked up in Redis (no JWT/secret
// management needed) so they can be revoked instantly by deleting the key.
// ---------------------------------------------------------------------------
// No hardcoded fallback: the PIN must only ever live in env vars, never in
// source that gets committed to the (public) repo.
const GATE_PIN = process.env.GATE_PIN;
const GATE_COOKIE = 'leela_gate';
const GATE_SESSION_TTL_SECONDS = 30 * 24 * 3600; // 30 days
const GATE_MAX_FAILED_ATTEMPTS = 8;
const GATE_LOCKOUT_SECONDS = 15 * 60;

const GATE_PUBLIC_PATHS = new Set([
  '/login.html',
  '/privacy.html',
  '/style.css',
  '/leela-logo.png',
  '/munim-ji-logo.png',
  '/favicon-16.png',
  '/favicon-32.png',
  '/apple-touch-icon.png',
]);

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((pair) => {
      const idx = pair.indexOf('=');
      if (idx === -1) return [pair.trim(), ''];
      return [pair.slice(0, idx).trim(), decodeURIComponent(pair.slice(idx + 1).trim())];
    })
  );
}

async function gateMiddleware(req, res, next) {
  if (req.method === 'GET' && req.path === '/api/webhook') return next();
  if (req.method === 'POST' && req.path === '/api/webhook') return next();
  if (req.path === '/api/cron/cleanup-media') return next();
  if (req.path === '/api/gate/login') return next();
  if (GATE_PUBLIC_PATHS.has(req.path)) return next();

  const token = parseCookies(req)[GATE_COOKIE];
  const valid = token && redis ? await redis.get(`gate:session:${token}`) : false;
  if (valid) return next();

  if (req.path.startsWith('/api/')) return res.status(401).json({ ok: false, error: 'Login required' });
  return res.redirect('/login.html');
}

// Default 100kb limit is too small for large CSV/vCard contact imports.
app.use(express.json({ limit: '10mb' }));
app.use(gateMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/gate/login', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const failKey = `gate:fail:${ip}`;

  if (redis) {
    const fails = Number((await redis.get(failKey)) || 0);
    if (fails >= GATE_MAX_FAILED_ATTEMPTS) {
      return res.status(429).json({ ok: false, error: 'Too many attempts. Try again in a few minutes.' });
    }
  }

  const pin = String(req.body?.pin || '');
  if (pin !== GATE_PIN) {
    if (redis) {
      await redis.incr(failKey);
      await redis.expire(failKey, GATE_LOCKOUT_SECONDS);
    }
    return res.status(401).json({ ok: false, error: 'Wrong PIN' });
  }

  if (redis) await redis.del(failKey);

  const token = crypto.randomBytes(24).toString('hex');
  if (redis) await redis.set(`gate:session:${token}`, '1', { ex: GATE_SESSION_TTL_SECONDS });

  const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `${GATE_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${GATE_SESSION_TTL_SECONDS}${isProd ? '; Secure' : ''}`
  );
  res.json({ ok: true });
});

// Lets login.html check "am I already signed in?" without showing the PIN
// pad — gateMiddleware itself does the real check (401 if the session
// cookie is missing/invalid), this just needs to exist behind it.
app.get('/api/gate/status', (req, res) => res.json({ ok: true }));

app.post('/api/gate/logout', async (req, res) => {
  const token = parseCookies(req)[GATE_COOKIE];
  if (token && redis) await redis.del(`gate:session:${token}`);
  res.setHeader('Set-Cookie', `${GATE_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
  res.json({ ok: true });
});

function cleanNumber(raw) {
  return String(raw).replace(/[^\d]/g, '');
}

function parseNumbers(input) {
  if (!input) return [];
  return input
    .split(/[\n,]/)
    .map((n) => cleanNumber(n))
    .filter((n) => n.length >= 10);
}

function requireCredentials(res) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    res.status(500).json({
      ok: false,
      error:
        'WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID set nahi hai. .env file me daalo (dekho .env.example).',
    });
    return true;
  }
  return false;
}

// One recipient = one Graph API call (Cloud API has no native bulk-send).
async function sendWhatsAppMessage(body) {
  try {
    const res = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Send numbers.length messages, one per recipient, with a small gap between calls.
async function sendToMany(numbers, buildBody) {
  const results = [];
  for (const to of numbers) {
    const body = buildBody(to);
    const result = await sendWhatsAppMessage(body);
    const wamid = result.data?.messages?.[0]?.id;
    results.push({ to, ...result });
    const mediaObj = ['image', 'document', 'video', 'audio'].includes(body.type) ? body[body.type] : null;
    await logMessage({
      id: wamid,
      direction: 'sent',
      number: to,
      type: body.type,
      body: describeSentBody(body),
      mediaUrl: mediaObj?.link,
      ok: result.ok,
      status: result.ok ? 'sent' : 'failed',
      error: result.ok ? undefined : result.data?.error?.message || result.error,
    });
    await new Promise((r) => setTimeout(r, 300));
  }
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, sentTo: results.length - failed.length, failed, results };
}

// Send an approved WhatsApp template message — works for cold/new numbers too.
app.post('/api/send-template', async (req, res) => {
  if (requireCredentials(res)) return;

  const { templateName, language, variables, numbersText } = req.body;
  const numbers = parseNumbers(numbersText);

  if (!templateName) {
    return res.status(400).json({ ok: false, error: 'Template name zaroori hai.' });
  }
  if (numbers.length === 0) {
    return res.status(400).json({ ok: false, error: 'Kam se kam ek valid phone number do.' });
  }

  const cleanVariables = (variables || []).filter((v) => v !== '' && v !== undefined && v !== null);
  const components = cleanVariables.length
    ? [{ type: 'body', parameters: cleanVariables.map((v) => ({ type: 'text', text: String(v) })) }]
    : [];

  const result = await sendToMany(numbers, (to) => ({
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language || 'en_US' },
      components,
    },
  }));

  res.json(result);
});

// Send a freeform text message (only valid inside the 24-hour WhatsApp session window per recipient).
app.post('/api/send-text', async (req, res) => {
  if (requireCredentials(res)) return;

  const { message, numbersText } = req.body;
  const numbers = parseNumbers(numbersText);

  if (!message || !message.trim()) {
    return res.status(400).json({ ok: false, error: 'Message likhna zaroori hai.' });
  }
  if (numbers.length === 0) {
    return res.status(400).json({ ok: false, error: 'Kam se kam ek valid phone number do.' });
  }

  const result = await sendToMany(numbers, (to) => ({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { preview_url: false, body: message },
  }));

  res.json(result);
});

// Upload a media file (image/document/video) to Vercel Blob and hand back
// its public URL — Meta's servers fetch media from this URL when sending.
app.post('/api/upload-media', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'File nahi mili.' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ ok: false, error: 'Blob storage configured nahi hai (BLOB_READ_WRITE_TOKEN missing).' });
  }
  try {
    let buffer = req.file.buffer;
    let mimetype = req.file.mimetype;
    let originalname = req.file.originalname;

    // Always re-encode audio, never trust the declared mimetype: browsers'
    // MediaRecorder labels its output "audio/mp4" but produces a fragmented
    // stream Meta's validator rejects as application/octet-stream, and
    // "audio/webm" isn't in WhatsApp's supported list at all.
    if (mimetype.startsWith('audio/')) {
      buffer = await transcodeToOggOpus(buffer);
      mimetype = 'audio/ogg';
      originalname = originalname.replace(/\.[^.]+$/, '') + '.ogg';
    }

    const safeName = Date.now() + '-' + originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const blob = await put(`uploads/${safeName}`, buffer, {
      access: 'public',
      contentType: mimetype,
    });
    res.json({ ok: true, url: blob.url, mimetype });
  } catch (err) {
    res.status(500).json({ ok: false, error: `Upload failed: ${err.message}` });
  }
});

function mediaTypeFromMime(mimetype) {
  if (!mimetype) return 'document';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'document';
}

// Send an image/document/video/audio message (with optional caption) to many numbers.
// Only deliverable within an active 24-hour session window, same rule as text.
app.post('/api/send-media', async (req, res) => {
  if (requireCredentials(res)) return;

  const { mediaUrl, mediaType, mimetype, caption, filename, numbersText } = req.body;
  const numbers = parseNumbers(numbersText);
  const type = mediaType || mediaTypeFromMime(mimetype);

  if (!mediaUrl) {
    return res.status(400).json({ ok: false, error: 'Media URL/file zaroori hai.' });
  }
  if (numbers.length === 0) {
    return res.status(400).json({ ok: false, error: 'Kam se kam ek valid phone number do.' });
  }
  if (!['image', 'document', 'video', 'audio'].includes(type)) {
    return res.status(400).json({ ok: false, error: 'Media type image, document, video ya audio hona chahiye.' });
  }

  const mediaObject = { link: mediaUrl };
  if (caption && type !== 'audio') mediaObject.caption = caption;
  if (type === 'document' && filename) mediaObject.filename = filename;

  const result = await sendToMany(numbers, (to) => ({
    messaging_product: 'whatsapp',
    to,
    type,
    [type]: mediaObject,
  }));

  res.json(result);
});

// Returns saved contacts (imported via CSV).
app.get('/api/contacts', async (req, res) => {
  if (!redis) return res.json({ ok: true, contacts: [], warning: 'Contacts database configured nahi hai.' });
  res.json({ ok: true, contacts: await getContacts() });
});

// Bulk-saves contacts (from a CSV upload) so they only need to be imported once.
// Re-importing the same number updates its name rather than duplicating it.
app.post('/api/contacts/import', async (req, res) => {
  if (!redis) return res.status(500).json({ ok: false, error: 'Contacts database configured nahi hai.' });
  const { contacts } = req.body;
  if (!Array.isArray(contacts) || !contacts.length) {
    return res.status(400).json({ ok: false, error: 'Koi valid contact nahi mila.' });
  }
  const entries = {};
  for (const c of contacts) {
    const number = cleanNumber(c.number || '');
    if (number.length < 10) continue;
    entries[number] = JSON.stringify({ number, name: (c.name || '').trim(), importedAt: Date.now() });
  }
  const imported = Object.keys(entries).length;
  if (imported) await redis.hset(CONTACTS_KEY, entries);
  res.json({ ok: true, imported });
});

// Non-secret display info for the Settings page (never returns tokens).
app.get('/api/config', (req, res) => {
  res.json({
    ok: true,
    connected: Boolean(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID),
    phoneNumberId: WHATSAPP_PHONE_NUMBER_ID || null,
    wabaId: WHATSAPP_BUSINESS_ACCOUNT_ID || null,
    hasInbox: Boolean(redis),
  });
});

// Returns the stored Inbox log (sent + received messages), newest first.
app.get('/api/messages', async (req, res) => {
  if (!redis) {
    return res.json({ ok: true, messages: [], warning: 'Inbox database configured nahi hai.' });
  }
  const messages = await getMessages(500);
  res.json({ ok: true, messages });
});

// Lists approved WhatsApp message templates for this business account, for
// the Templates picker. Falls back to an empty list (with a warning) if the
// WABA id isn't configured, rather than failing the whole page.
app.get('/api/templates', async (req, res) => {
  if (requireCredentials(res)) return;
  if (!WHATSAPP_BUSINESS_ACCOUNT_ID) {
    return res.json({ ok: true, templates: [], warning: 'WHATSAPP_BUSINESS_ACCOUNT_ID set nahi hai.' });
  }
  try {
    const url = `${GRAPH_BASE}/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=name,status,category,language,components&limit=100`;
    const apiRes = await fetch(url, { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` } });
    const data = await apiRes.json();
    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ ok: false, error: data.error?.message || 'Templates fetch fail hua.' });
    }
    res.json({ ok: true, templates: data.data || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Streams a customer-sent media file (image/document/video/audio) to the
// browser. WhatsApp media URLs expire in minutes and require the access
// token to fetch, so the client can't use them directly — this proxies it.
app.get('/api/media/:mediaId', async (req, res) => {
  if (requireCredentials(res)) return;
  try {
    const metaRes = await fetch(`${GRAPH_BASE}/${req.params.mediaId}`, {
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
    });
    const meta = await metaRes.json();
    if (!meta.url) return res.status(404).send('Media not found or expired.');

    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` } });
    const buf = Buffer.from(await fileRes.arrayBuffer());
    res.set('Content-Type', meta.mime_type || 'application/octet-stream');
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(buf);
  } catch (err) {
    res.status(500).send('Media fetch failed.');
  }
});

// Creates a new WhatsApp message template (goes to Meta for approval —
// usually minutes to a few hours before it can be used to message new numbers).
app.post('/api/templates', async (req, res) => {
  if (requireCredentials(res)) return;
  if (!WHATSAPP_BUSINESS_ACCOUNT_ID) {
    return res.status(500).json({ ok: false, error: 'WHATSAPP_BUSINESS_ACCOUNT_ID set nahi hai.' });
  }
  const { name, category, language, body: bodyText, footer } = req.body;
  if (!name || !/^[a-z0-9_]+$/.test(name)) {
    return res.status(400).json({ ok: false, error: 'Template name sirf lowercase letters, numbers, underscore me ho.' });
  }
  if (!bodyText || !bodyText.trim()) {
    return res.status(400).json({ ok: false, error: 'Template body zaroori hai.' });
  }

  const varMatches = [...new Set((bodyText.match(/{{\d+}}/g) || []))].sort();
  const components = [
    {
      type: 'BODY',
      text: bodyText,
      ...(varMatches.length
        ? { example: { body_text: [varMatches.map((_, i) => `Example${i + 1}`)] } }
        : {}),
    },
  ];
  if (footer && footer.trim()) components.push({ type: 'FOOTER', text: footer.trim() });

  try {
    const apiRes = await fetch(`${GRAPH_BASE}/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
      body: JSON.stringify({
        name,
        language: language || 'en_US',
        category: category || 'MARKETING',
        components,
      }),
    });
    const data = await apiRes.json();
    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ ok: false, error: data.error?.message || 'Template create fail hua.' });
    }
    res.json({ ok: true, template: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Meta calls this with a GET request once, to verify we own this endpoint.
app.get('/api/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Meta calls this with a POST request for every incoming message/status update.
app.post('/api/webhook', async (req, res) => {
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const messages = value?.messages || [];
    const contacts = value?.contacts || [];
    const statuses = value?.statuses || [];

    for (const msg of messages) {
      const contact = contacts.find((c) => c.wa_id === msg.from);
      let body;
      let mediaId;
      let mimeType;
      if (msg.type === 'text') body = msg.text?.body || '';
      else if (msg.type === 'button') body = msg.button?.text || '';
      else if (msg.type === 'interactive') {
        body = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || `[${msg.type}]`;
      } else if (['image', 'document', 'video', 'audio', 'sticker'].includes(msg.type)) {
        const media = msg[msg.type];
        mediaId = media?.id;
        mimeType = media?.mime_type;
        body = media?.caption || media?.filename || `[${msg.type}]`;
      } else body = `[${msg.type}]`;

      await logMessage({
        id: msg.id,
        direction: 'received',
        number: msg.from,
        name: contact?.profile?.name || '',
        type: msg.type,
        body,
        mediaId,
        mimeType,
      });
    }

    // Delivery-status callbacks (sent/delivered/read/failed) for messages we sent.
    for (const s of statuses) {
      if (s.errors?.length) console.error('WhatsApp status error:', JSON.stringify(s.errors));
      await updateMessageStatus(s.id, s.status, {
        statusTimestamp: s.timestamp ? Number(s.timestamp) * 1000 : Date.now(),
        error: s.errors?.[0]?.title,
      });
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
  res.sendStatus(200);
});

// Daily cleanup — deletes uploaded media older than 5 days so Blob storage
// doesn't grow unbounded. Triggered by Vercel Cron (see vercel.json); the
// CRON_SECRET check stops anyone else from hitting this endpoint publicly.
app.get('/api/cron/cleanup-media', async (req, res) => {
  if (process.env.CRON_SECRET) {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.sendStatus(401);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.json({ ok: true, deleted: 0, note: 'Blob storage configured nahi hai.' });
  }
  const MAX_AGE_MS = 5 * 24 * 3600 * 1000;
  const cutoff = Date.now() - MAX_AGE_MS;
  try {
    let cursor;
    let deleted = 0;
    do {
      const result = await list({ prefix: 'uploads/', cursor, limit: 1000 });
      const old = result.blobs.filter((b) => new Date(b.uploadedAt).getTime() < cutoff);
      if (old.length) {
        await del(old.map((b) => b.url));
        deleted += old.length;
      }
      cursor = result.cursor;
    } while (cursor);
    res.json({ ok: true, deleted });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`leelainfra.in WhatsApp sender chal raha hai: http://localhost:${PORT}`);
});
