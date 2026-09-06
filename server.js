require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const { Redis } = require('@upstash/redis');
const { put } = require('@vercel/blob');

const app = express();
const PORT = process.env.PORT || 3000;

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : null;

const MESSAGES_KEY = 'wa:messages';
const MAX_STORED_MESSAGES = 500;

// Stores one inbox entry (sent or received) in Redis. No-ops silently if
// Redis isn't configured, so the app still works without an Inbox.
async function logMessage(entry) {
  if (!redis) return;
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    ...entry,
  };
  await redis.lpush(MESSAGES_KEY, JSON.stringify(record));
  await redis.ltrim(MESSAGES_KEY, 0, MAX_STORED_MESSAGES - 1);
}

async function getMessages(limit = 300) {
  if (!redis) return [];
  const raw = await redis.lrange(MESSAGES_KEY, 0, limit - 1);
  return raw.map((r) => (typeof r === 'string' ? JSON.parse(r) : r));
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
const GRAPH_API_VERSION = 'v25.0';
const WHATSAPP_API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    results.push({ to, ...result });
    await logMessage({
      direction: 'sent',
      number: to,
      type: body.type,
      body: describeSentBody(body),
      ok: result.ok,
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
    const safeName = Date.now() + '-' + req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const blob = await put(`uploads/${safeName}`, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
    });
    res.json({ ok: true, url: blob.url, mimetype: req.file.mimetype });
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

// Returns the stored Inbox log (sent + received messages), newest first.
app.get('/api/messages', async (req, res) => {
  if (!redis) {
    return res.json({ ok: true, messages: [], warning: 'Inbox database configured nahi hai.' });
  }
  const messages = await getMessages(300);
  res.json({ ok: true, messages });
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

    for (const msg of messages) {
      const contact = contacts.find((c) => c.wa_id === msg.from);
      let body;
      if (msg.type === 'text') body = msg.text?.body || '';
      else if (msg.type === 'button') body = msg.button?.text || '';
      else if (msg.type === 'interactive') {
        body = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || `[${msg.type}]`;
      } else body = `[${msg.type}]`;

      await logMessage({
        direction: 'received',
        number: msg.from,
        name: contact?.profile?.name || '',
        type: msg.type,
        body,
      });
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`leelainfra.in WhatsApp sender chal raha hai: http://localhost:${PORT}`);
});
