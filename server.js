require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const safeName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, safeName);
    },
  }),
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
    const result = await sendWhatsAppMessage(buildBody(to));
    results.push({ to, ...result });
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

// Upload a media file (image/document/video) and hand back a public URL for it.
// NOTE: Meta's servers must be able to reach this URL to fetch the file,
// so this only works once the app is deployed on a public URL (not on localhost).
app.post('/api/upload-media', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'File nahi mili.' });
  }
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ ok: true, url, mimetype: req.file.mimetype });
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

app.listen(PORT, () => {
  console.log(`leelainfra.in WhatsApp sender chal raha hai: http://localhost:${PORT}`);
});
