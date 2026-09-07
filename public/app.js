/* ============================================================
   Utilities
   ============================================================ */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function initials(name, number) {
  const src = (name || '').trim();
  if (src) {
    const parts = src.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
  }
  const digits = (number || '').replace(/\D/g, '');
  return digits ? digits.slice(-2) : '?';
}

function formatClock(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function displayNumber(num) {
  const n = String(num || '');
  if (n.length > 8) return `+${n.slice(0, n.length - 10)} ${n.slice(-10, -5)} ${n.slice(-5)}`.trim();
  return n;
}

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'toast'; }, 3200);
}

async function api(path, options) {
  const res = await fetch(path, options);
  let data;
  try { data = await res.json(); } catch { data = { ok: false, error: 'Invalid server response' }; }
  return data;
}

function parseNumbersClient(text) {
  if (!text) return { valid: [], invalidCount: 0, duplicateCount: 0 };
  const rawEntries = text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const cleaned = rawEntries.map((s) => s.replace(/[^\d]/g, ''));
  const valid = cleaned.filter((n) => n.length >= 10);
  const invalidCount = cleaned.length - valid.length;
  const uniqueValid = [...new Set(valid)];
  const duplicateCount = valid.length - uniqueValid.length;
  return { valid: uniqueValid, invalidCount, duplicateCount };
}

const ICONS = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  doubleCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m2 12 4 4 8-9"/><path d="m8 16 4 4 10-11"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  paperclip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  smile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
};

const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘',
  '😋', '😛', '😜', '🤪', '🤓', '😎', '🥸', '😏', '😒', '😞', '😔', '🙁', '😣', '😢', '😭', '😤',
  '😠', '🤯', '😳', '🥵', '🥶', '😱', '😰', '🥺', '🤗', '🤔', '🤭', '🤫', '🙄', '😴', '🤤', '😷',
  '🤒', '🥳', '😇', '🤠', '👍', '👎', '👌', '✌️', '🤞', '🙏', '👏', '🙌', '👋', '💪', '🤝', '❤️',
  '🔥', '⭐', '✅', '❌', '🎉', '💯', '📌', '📍', '💰', '💵', '📞', '📱', '📦', '🚚', '🏠', '🏢',
];

// Shared voice-recording state for the Inbox composer.
const recorderState = { mediaRecorder: null, stream: null, chunks: [], startedAt: null, timer: null };

function updateComposerButtons() {
  const input = document.getElementById('threadComposerInput');
  const sendBtn = document.getElementById('threadSendBtn');
  const micBtn = document.getElementById('composerMicBtn');
  if (!input || !sendBtn || !micBtn) return;
  const hasText = input.value.trim().length > 0;
  sendBtn.hidden = !hasText;
  micBtn.hidden = hasText;
}

function setRecordingUi(active) {
  document.getElementById('composerBar').classList.toggle('recording', active);
  document.getElementById('threadComposerInput').hidden = active;
  document.getElementById('composerRecordingInline').hidden = !active;
  document.getElementById('composerAttachBtn').hidden = active;
  document.getElementById('composerEmojiBtn').hidden = active;
  document.getElementById('recCancelBtn').hidden = !active;
}

// WhatsApp's supported audio formats don't include plain WebM — prefer MP4
// (AAC), which Chrome/Edge/Safari can record directly and Meta accepts.
const AUDIO_MIME_CANDIDATES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'];
function pickAudioMimeType() {
  return AUDIO_MIME_CANDIDATES.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickAudioMimeType();
    recorderState.stream = stream;
    recorderState.chunks = [];
    recorderState.mimeType = mimeType || 'audio/webm';
    recorderState.mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorderState.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recorderState.chunks.push(e.data); };
    recorderState.mediaRecorder.start();
    recorderState.startedAt = Date.now();
    setRecordingUi(true);
    recorderState.timer = setInterval(() => {
      const secs = Math.floor((Date.now() - recorderState.startedAt) / 1000);
      const el = document.getElementById('recTimer');
      if (el) el.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    }, 500);
  } catch (err) {
    toast('Microphone access nahi mila', 'error');
  }
}

function teardownRecording() {
  clearInterval(recorderState.timer);
  recorderState.stream?.getTracks().forEach((t) => t.stop());
  recorderState.mediaRecorder = null;
  recorderState.stream = null;
  setRecordingUi(false);
}

function stopRecordingAndSend() {
  if (!recorderState.mediaRecorder) return;
  const chunks = recorderState.chunks;
  const conversationNumber = state.activeConversation;
  recorderState.mediaRecorder.onstop = async () => {
    teardownRecording();
    if (!chunks.length || !conversationNumber) return;
    const mimeType = recorderState.mimeType || 'audio/webm';
    const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size < 800) { toast('Recording bahut chhoti thi', 'error'); return; }
    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });
    toast('Sending voice message...');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const uploadRes = await fetch('/api/upload-media', { method: 'POST', body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadData.ok) throw new Error(uploadData.error || 'Upload failed');
      const res = await api('/api/send-media', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaUrl: uploadData.url, mimetype: uploadData.mimetype, mediaType: 'audio', numbersText: conversationNumber }),
      });
      if (!res.ok) throw new Error(res.error || (res.failed?.[0]?.data?.error?.message) || 'Send failed');
      toast('Voice message sent', 'success');
      await loadAll(false);
      if (state.activeConversation === conversationNumber) renderThread(conversationNumber);
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  recorderState.mediaRecorder.stop();
}

function cancelRecording() {
  if (!recorderState.mediaRecorder) return;
  recorderState.mediaRecorder.onstop = () => teardownRecording();
  recorderState.mediaRecorder.stop();
  recorderState.chunks = [];
}

/* ============================================================
   Global state
   ============================================================ */
const state = {
  messages: [],
  templates: [],
  contacts: [],
  selectedContacts: new Set(),
  config: null,
  currentView: 'dashboard',
  activeConversation: null,
  inboxFilter: 'all', // 'all' | 'open' (free 24-hour window open)
  send: {
    step: 1,
    numbers: [],
    type: null, // 'text' | 'template'
    mediaUrl: null,
    mediaMime: null,
    mediaName: null,
    template: null,
    templateVars: {},
    sending: false,
  },
};

/* ============================================================
   Navigation
   ============================================================ */
const VIEW_META = {
  dashboard: { title: 'Dashboard', subtitle: 'Aapke WhatsApp business ka overview' },
  inbox: { title: 'Inbox', subtitle: 'Sent aur received sab ek jagah' },
  send: { title: 'Send Message', subtitle: 'Step-by-step message bhejo' },
  templates: { title: 'Templates', subtitle: 'Approved templates fresh numbers ke liye' },
  contacts: { title: 'Contacts', subtitle: 'Un numbers ki list jinse baat hui hai' },
  settings: { title: 'Settings', subtitle: 'Connection aur account details' },
};

function goToView(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === view));
  document.querySelectorAll('.nav-item[data-view]').forEach((n) => n.classList.toggle('active', n.dataset.view === view));
  document.querySelectorAll('.bottom-nav-item[data-view]').forEach((n) => n.classList.toggle('active', n.dataset.view === view));
  const meta = VIEW_META[view] || {};
  document.getElementById('topbarTitle').textContent = meta.title || '';
  document.getElementById('topbarSubtitle').textContent = meta.subtitle || '';
  document.getElementById('appShell').classList.remove('inbox-open');

  if (view === 'dashboard') renderDashboard();
  if (view === 'inbox') renderConversationList();
  if (view === 'templates') renderTemplatesView();
  if (view === 'contacts') renderContacts();
  if (view === 'settings') renderSettings();
  if (view === 'send' && state.send.step === 1) renderWizard();

  window.scrollTo(0, 0);
}

document.querySelectorAll('.nav-item[data-view], .bottom-nav-item[data-view]').forEach((el) => {
  el.addEventListener('click', () => goToView(el.dataset.view));
});

document.querySelectorAll('[data-action]').forEach((el) => {
  el.addEventListener('click', () => {
    const action = el.dataset.action;
    if (action === 'goto-send-normal') { resetWizard(); state.send.type = 'text'; goToView('send'); }
    else if (action === 'goto-send-template') { resetWizard(); state.send.type = 'template'; goToView('send'); }
    else if (action === 'goto-inbox') goToView('inbox');
    else if (action === 'goto-templates-new') { goToView('templates'); openTemplateForm(); }
  });
});

document.getElementById('topbarRefreshBtn').addEventListener('click', () => loadAll(true));

/* ============================================================
   Data loading
   ============================================================ */
async function loadAll(showToastOnDone) {
  const [msgRes, tplRes, cfgRes, contactsRes] = await Promise.all([
    api('/api/messages'),
    api('/api/templates'),
    api('/api/config'),
    api('/api/contacts'),
  ]);
  if (msgRes.ok) state.messages = msgRes.messages || [];
  if (tplRes.ok) state.templates = tplRes.templates || [];
  if (cfgRes.ok) state.config = cfgRes;
  if (contactsRes.ok) state.contacts = contactsRes.contacts || [];

  const unreadCount = getConversations().filter((c) => c.awaitingReply).length;
  const badge = document.getElementById('inboxNavBadge');
  if (unreadCount > 0) { badge.hidden = false; badge.textContent = unreadCount; } else badge.hidden = true;

  if (state.currentView === 'dashboard') renderDashboard();
  if (state.currentView === 'inbox') {
    renderConversationList();
    if (state.activeConversation) renderThread(state.activeConversation);
  }
  if (state.currentView === 'contacts') renderContacts(document.getElementById('contactsSearchInput').value);

  if (cfgRes.ok) {
    document.getElementById('connStatusDot').classList.toggle('offline', !cfgRes.connected);
  }

  if (showToastOnDone) toast('Refreshed', 'success');
}

setInterval(() => loadAll(false), 12000);
loadAll(false);

/* ============================================================
   Conversation helpers (shared by Dashboard / Inbox / Contacts)
   ============================================================ */
const WINDOW_MS = 24 * 3600 * 1000;

function getConversations() {
  const byNumber = new Map();
  // messages come newest-first
  for (const m of state.messages) {
    if (!byNumber.has(m.number)) {
      byNumber.set(m.number, { number: m.number, name: '', messages: [], lastTimestamp: 0, lastReceivedTimestamp: 0 });
    }
    const conv = byNumber.get(m.number);
    conv.messages.push(m);
    if (m.direction === 'received' && m.name && !conv.name) conv.name = m.name;
    if (m.timestamp > conv.lastTimestamp) conv.lastTimestamp = m.timestamp;
    if (m.direction === 'received' && m.timestamp > conv.lastReceivedTimestamp) conv.lastReceivedTimestamp = m.timestamp;
  }
  const list = [...byNumber.values()].map((c) => {
    const sorted = [...c.messages].sort((a, b) => b.timestamp - a.timestamp);
    const last = sorted[0];
    const windowExpiresAt = c.lastReceivedTimestamp > 0 ? c.lastReceivedTimestamp + WINDOW_MS : null;
    return {
      ...c,
      lastMessage: last,
      awaitingReply: last?.direction === 'received',
      windowExpiresAt,
      windowOpen: windowExpiresAt !== null && windowExpiresAt > Date.now(),
    };
  });
  list.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  return list;
}

// e.g. "3h 20m left" — null once the free window has closed.
function formatWindowRemaining(expiresAt) {
  if (!expiresAt) return null;
  const msLeft = expiresAt - Date.now();
  if (msLeft <= 0) return null;
  const hrs = Math.floor(msLeft / 3600000);
  const mins = Math.floor((msLeft % 3600000) / 60000);
  return hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`;
}

const MEDIA_PREVIEW_LABELS = { audio: '🎤 Voice message', image: '📷 Photo', video: '🎥 Video', document: '📄 Document', sticker: '😊 Sticker' };

// A friendly one-line preview for conversation lists / activity feeds —
// shows "🎤 Voice message" etc. instead of the raw "[audio]" placeholder.
function previewLabel(m) {
  if (!m) return '';
  if (/^\[[a-z]+\]$/i.test(m.body || '')) return MEDIA_PREVIEW_LABELS[m.type] || m.body;
  return m.body || '';
}

/* ============================================================
   Dashboard
   ============================================================ */
function renderDashboard() {
  const msgs = state.messages;
  const sent = msgs.filter((m) => m.direction === 'sent');
  const received = msgs.filter((m) => m.direction === 'received');
  const delivered = sent.filter((m) => m.status === 'delivered' || m.status === 'read');
  const read = sent.filter((m) => m.status === 'read');
  const failed = sent.filter((m) => m.status === 'failed' || m.ok === false);
  const conversations = getConversations();
  const approvedTemplates = state.templates.filter((t) => t.status === 'APPROVED');
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayCount = msgs.filter((m) => m.timestamp >= todayStart.getTime()).length;

  const kpis = [
    { label: 'Messages Sent', value: sent.length, icon: ICONS.send, color: 'dark' },
    { label: 'Delivered', value: delivered.length, icon: ICONS.doubleCheck, color: 'blue' },
    { label: 'Read', value: read.length, icon: ICONS.doubleCheck, color: 'green' },
    { label: 'Failed', value: failed.length, icon: ICONS.alert, color: 'red' },
    { label: 'Active Conversations', value: conversations.length, icon: ICONS.inbox, color: 'green' },
    { label: 'Approved Templates', value: approvedTemplates.length, icon: ICONS.doc, color: 'amber' },
    { label: 'Replies Received', value: received.length, icon: ICONS.inbox, color: 'blue' },
    { label: "Today's Activity", value: todayCount, icon: ICONS.clock, color: 'dark' },
  ];

  document.getElementById('kpiGrid').innerHTML = kpis.map((k) => `
    <div class="kpi-card">
      <div class="kpi-icon ${k.color}">${k.icon}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-label">${k.label}</div>
    </div>
  `).join('');

  // 7-day chart
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    days.push({ start: d.getTime(), end: d.getTime() + 86400000, label: d.toLocaleDateString('en-IN', { weekday: 'short' }) });
  }
  const maxCount = Math.max(1, ...days.map((d) => msgs.filter((m) => m.timestamp >= d.start && m.timestamp < d.end).length));
  document.getElementById('chartBars').innerHTML = days.map((d) => {
    const daySent = msgs.filter((m) => m.direction === 'sent' && m.timestamp >= d.start && m.timestamp < d.end).length;
    const dayRecv = msgs.filter((m) => m.direction === 'received' && m.timestamp >= d.start && m.timestamp < d.end).length;
    const sentPct = (daySent / maxCount) * 100;
    const recvPct = (dayRecv / maxCount) * 100;
    return `
      <div class="chart-col">
        <div class="chart-bar-track">
          <div class="chart-bar-seg sent" style="height:${sentPct}%"></div>
          <div class="chart-bar-seg received" style="height:${recvPct}%"></div>
        </div>
        <span class="chart-col-label">${d.label}</span>
      </div>
    `;
  }).join('');

  // recent activity
  const recent = msgs.slice(0, 8);
  document.getElementById('recentActivityList').innerHTML = recent.length
    ? recent.map((m) => `
      <div class="activity-row">
        <div class="activity-icon ${m.direction}">${m.direction === 'sent' ? ICONS.send : ICONS.inbox}</div>
        <div class="activity-body">
          <strong>${m.direction === 'sent' ? 'Sent to' : 'From'} ${escapeHtml(displayNumber(m.number))}</strong>
          <span>${escapeHtml(previewLabel(m))}</span>
        </div>
        <div class="activity-time">${relativeTime(m.timestamp)}</div>
      </div>
    `).join('')
    : `<div class="empty-state">${ICONS.inbox}<strong>Koi activity nahi</strong><span>Pehla message bhejo ya wait karo customer reply ka</span></div>`;
}

/* ============================================================
   Send wizard
   ============================================================ */
const WIZARD_STEPS_TEXT = [
  { key: 1, label: 'Recipients' },
  { key: 2, label: 'Type' },
  { key: '3-text', label: 'Compose' },
  { key: 4, label: 'Preview' },
];
const WIZARD_STEPS_TEMPLATE = [
  { key: 1, label: 'Recipients' },
  { key: 2, label: 'Type' },
  { key: '3-template', label: 'Template' },
  { key: 4, label: 'Preview' },
];

function resetWizard() {
  state.send = { step: 1, numbers: [], type: null, mediaUrl: null, mediaMime: null, mediaName: null, template: null, templateVars: {}, sending: false };
  document.getElementById('sendNumbers').value = '';
  document.getElementById('composeText').value = '';
  document.getElementById('sendMediaPreview').hidden = true;
  document.getElementById('sendMediaCaptionField').hidden = true;
  document.getElementById('sendMediaCaption').value = '';
  document.getElementById('sendMediaInput').value = '';
  document.querySelectorAll('.choice-card').forEach((c) => c.classList.remove('selected'));
  updateRecipientCount();
}

function currentSteps() {
  return state.send.type === 'template' ? WIZARD_STEPS_TEMPLATE : WIZARD_STEPS_TEXT;
}

function renderWizard() {
  const steps = currentSteps();
  const currentIndex = steps.findIndex((s) => String(s.key) === String(state.send.step));

  document.getElementById('wizardProgress').innerHTML = steps.map((s, i) => `
    <div class="wizard-step ${i < currentIndex ? 'done' : ''} ${i === currentIndex ? 'current' : ''}">
      <span class="dot">${i < currentIndex ? '✓' : i + 1}</span>
      <span class="label">${s.label}</span>
    </div>
    ${i < steps.length - 1 ? `<div class="wizard-connector ${i < currentIndex ? 'done' : ''}"></div>` : ''}
  `).join('');

  document.querySelectorAll('.wizard-panel').forEach((p) => {
    p.classList.toggle('active', String(p.dataset.step) === String(state.send.step));
  });

  const backBtn = document.getElementById('wizardBackBtn');
  const nextBtn = document.getElementById('wizardNextBtn');
  backBtn.style.visibility = currentIndex === 0 ? 'hidden' : 'visible';

  if (state.send.step === 4) {
    nextBtn.textContent = state.send.sending ? 'Sending...' : 'Send Message';
    nextBtn.disabled = state.send.sending;
    renderPreview();
  } else if (state.send.step === 5) {
    backBtn.style.visibility = 'hidden';
    nextBtn.textContent = 'Done — Send Another';
    nextBtn.disabled = false;
  } else {
    nextBtn.textContent = 'Next';
    nextBtn.disabled = false;
  }

  if (state.send.step === '3-template') renderTemplatePicker();
}

function updateRecipientCount() {
  const { valid } = parseNumbersClient(document.getElementById('sendNumbers').value);
  state.send.numbers = valid;
  const el = document.getElementById('sendRecipientCount');
  el.textContent = `${valid.length} number${valid.length === 1 ? '' : 's'} selected`;
  el.classList.toggle('warn', valid.length === 0);
}

document.getElementById('sendNumbers').addEventListener('input', updateRecipientCount);

document.getElementById('sendCsvInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const { valid: fromCsv } = parseNumbersClient(text);
  const { valid: existing } = parseNumbersClient(document.getElementById('sendNumbers').value);
  const merged = [...new Set([...existing, ...fromCsv])];
  document.getElementById('sendNumbers').value = merged.join('\n');
  document.getElementById('sendCsvFeedback').textContent = `✓ ${merged.length - existing.length} naya number add hua.`;
  updateRecipientCount();
  e.target.value = '';
});

document.querySelectorAll('.choice-card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.choice-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    state.send.type = card.dataset.type;
  });
});

document.getElementById('composeText').addEventListener('input', (e) => {
  document.getElementById('composeTextCount').textContent = `${e.target.value.length} / 4096`;
});

document.getElementById('sendMediaInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const preview = document.getElementById('sendMediaPreview');
  preview.hidden = false;
  preview.innerHTML = `<span class="spinner spinner-dark"></span><span>Uploading ${escapeHtml(file.name)}...</span>`;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await fetch('/api/upload-media', { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Upload failed');
    state.send.mediaUrl = data.url;
    state.send.mediaMime = data.mimetype;
    state.send.mediaName = file.name;
    const isImage = data.mimetype?.startsWith('image/');
    preview.innerHTML = `
      ${isImage ? `<img src="${data.url}" alt="" />` : `<span class="file-icon">${ICONS.doc}</span>`}
      <div class="attach-preview-info"><strong>${escapeHtml(file.name)}</strong><span>Ready to send</span></div>
      <button type="button" class="icon-btn" id="removeMediaBtn">✕</button>
    `;
    document.getElementById('removeMediaBtn').addEventListener('click', () => {
      state.send.mediaUrl = null; state.send.mediaMime = null; state.send.mediaName = null;
      preview.hidden = true; preview.innerHTML = '';
      document.getElementById('sendMediaCaptionField').hidden = true;
      document.getElementById('sendMediaInput').value = '';
    });
    document.getElementById('sendMediaCaptionField').hidden = false;
  } catch (err) {
    preview.innerHTML = `<span>✕ ${escapeHtml(err.message)}</span>`;
  }
});

function renderTemplatePicker() {
  const approved = state.templates.filter((t) => t.status === 'APPROVED');
  const wrap = document.getElementById('sendTemplatePicker');
  if (!approved.length) {
    wrap.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">${ICONS.doc}<strong>Koi approved template nahi</strong><span>Templates page se ek template banao aur approval ka wait karo</span></div>`;
    return;
  }
  wrap.innerHTML = approved.map((t, i) => `
    <div class="template-card" data-tpl-index="${i}" style="${state.send.template?.name === t.name ? 'border-color:var(--accent);background:var(--accent-50);' : ''}">
      <div class="template-card-head"><strong>${escapeHtml(t.name)}</strong>${state.send.template?.name === t.name ? `<span style="color:var(--accent-ink);">${ICONS.check}</span>` : ''}</div>
      <div class="template-card-meta">
        <span class="badge badge-green">Approved</span>
        <span class="badge badge-gray">${escapeHtml(t.category || '')}</span>
        <span class="badge badge-gray">${escapeHtml(t.language || '')}</span>
      </div>
      <div class="template-card-preview">${escapeHtml(templateBodyText(t))}</div>
    </div>
  `).join('');

  wrap.querySelectorAll('.template-card').forEach((card, i) => {
    card.addEventListener('click', () => {
      state.send.template = approved[i];
      state.send.templateVars = {};
      renderTemplatePicker();
      renderTemplateVarsForm();
    });
  });

  if (state.send.template) renderTemplateVarsForm();
}

function templateBodyText(t) {
  return t.components?.find((c) => c.type === 'BODY')?.text || '';
}

function templateVarNames(t) {
  const body = templateBodyText(t);
  return [...new Set((body.match(/{{\d+}}/g) || []))].sort();
}

function renderTemplateVarsForm() {
  const wrap = document.getElementById('sendTemplateVarsWrap');
  const varsEl = document.getElementById('sendTemplateVars');
  const vars = templateVarNames(state.send.template);
  if (!vars.length) { wrap.hidden = true; return; }
  wrap.hidden = false;
  varsEl.innerHTML = vars.map((v, i) => `
    <div class="var-row">
      <span class="var-tag">${v}</span>
      <input class="input" data-var-index="${i}" placeholder="Value for ${v}" value="${escapeHtml(state.send.templateVars[i] || '')}" />
    </div>
  `).join('');
  varsEl.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      state.send.templateVars[input.dataset.varIndex] = input.value;
      renderPreview();
    });
  });
}

function renderPreview() {
  document.getElementById('previewRecipientCount').textContent = `${state.send.numbers.length} recipient${state.send.numbers.length === 1 ? '' : 's'}`;
  let html = '';
  const time = formatClock(Date.now());

  if (state.send.type === 'template' && state.send.template) {
    let text = templateBodyText(state.send.template);
    const vars = templateVarNames(state.send.template);
    vars.forEach((v, i) => {
      text = text.replace(v, state.send.templateVars[i] || v);
    });
    const footer = state.send.template.components?.find((c) => c.type === 'FOOTER')?.text;
    html = `<div class="phone-bubble mine">${escapeHtml(text)}${footer ? `<div style="opacity:.55;font-size:11px;margin-top:6px;">${escapeHtml(footer)}</div>` : ''}<div class="phone-bubble-time">${time}</div></div>`;
  } else {
    const mediaHtml = state.send.mediaUrl
      ? (state.send.mediaMime?.startsWith('image/') ? `<img src="${state.send.mediaUrl}" />` : `<div style="padding:8px;background:#f2f2f2;border-radius:8px;font-size:11px;margin-bottom:6px;">📄 ${escapeHtml(state.send.mediaName || 'Document')}</div>`)
      : '';
    const caption = state.send.mediaUrl ? document.getElementById('sendMediaCaption').value : document.getElementById('composeText').value;
    html = `<div class="phone-bubble mine">${mediaHtml}${escapeHtml(caption || (state.send.mediaUrl ? '' : 'Aapka message yahan dikhega...'))}<div class="phone-bubble-time">${time}</div></div>`;
  }
  document.getElementById('previewBubble').innerHTML = html;
}

function validateStep() {
  const step = state.send.step;
  if (step === 1) {
    if (!state.send.numbers.length) { toast('Kam se kam ek valid number do', 'error'); return false; }
    return true;
  }
  if (step === 2) {
    if (!state.send.type) { toast('Message type chuno', 'error'); return false; }
    return true;
  }
  if (step === '3-text') {
    if (!state.send.mediaUrl && !document.getElementById('composeText').value.trim()) {
      toast('Message likho ya file attach karo', 'error'); return false;
    }
    return true;
  }
  if (step === '3-template') {
    if (!state.send.template) { toast('Template chuno', 'error'); return false; }
    return true;
  }
  return true;
}

function nextStepKey(dir) {
  const steps = currentSteps();
  const idx = steps.findIndex((s) => String(s.key) === String(state.send.step));
  const targetIdx = idx + dir;
  if (targetIdx < 0) return null;
  if (targetIdx >= steps.length) return 4;
  return steps[targetIdx].key;
}

document.getElementById('wizardBackBtn').addEventListener('click', () => {
  const prev = nextStepKey(-1);
  if (prev !== null) { state.send.step = prev; renderWizard(); }
});

document.getElementById('wizardNextBtn').addEventListener('click', async () => {
  if (state.send.step === 5) { resetWizard(); renderWizard(); return; }
  if (state.send.step === 4) { await doSend(); return; }
  if (!validateStep()) return;
  const next = nextStepKey(1);
  state.send.step = next;
  renderWizard();
});

async function doSend() {
  state.send.sending = true;
  renderWizard();
  const numbersText = state.send.numbers.join('\n');
  let result;
  try {
    if (state.send.type === 'template') {
      const vars = templateVarNames(state.send.template).map((v, i) => state.send.templateVars[i] || '');
      result = await api('/api/send-template', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateName: state.send.template.name, language: state.send.template.language, variables: vars, numbersText }),
      });
    } else if (state.send.mediaUrl) {
      result = await api('/api/send-media', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaUrl: state.send.mediaUrl, mimetype: state.send.mediaMime, caption: document.getElementById('sendMediaCaption').value, filename: state.send.mediaName, numbersText }),
      });
    } else {
      result = await api('/api/send-text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: document.getElementById('composeText').value, numbersText }),
      });
    }
  } catch (err) {
    result = { ok: false, error: err.message };
  }

  state.send.sending = false;
  state.send.step = 5;
  renderWizard();

  const area = document.getElementById('sendResultArea');
  if (result.error && !result.results) {
    area.innerHTML = `<div class="result-line fail">✕ ${escapeHtml(result.error)}</div>`;
  } else {
    const lines = (result.results || []).map((r) => `
      <div class="result-line ${r.ok ? 'ok' : 'fail'}">
        ${r.ok ? '✓' : '✕'} ${escapeHtml(displayNumber(r.to))} ${r.ok ? '' : '— ' + escapeHtml(r.data?.error?.message || r.error || 'failed')}
      </div>
    `).join('');
    area.innerHTML = `<div class="result-summary"><strong>${result.sentTo || 0} / ${(result.results || []).length} bheje gaye</strong></div>${lines}`;
  }
  toast(result.ok ? 'Message sent!' : 'Kuch numbers pe fail hua', result.ok ? 'success' : 'error');
  loadAll(false);
}

/* ============================================================
   Templates view
   ============================================================ */
function renderTemplatesView() {
  const grid = document.getElementById('templatesGrid');
  const statusBadge = (s) => {
    if (s === 'APPROVED') return '<span class="badge badge-green">Approved</span>';
    if (s === 'PENDING') return '<span class="badge badge-amber">Pending</span>';
    if (s === 'REJECTED') return '<span class="badge badge-red">Rejected</span>';
    return `<span class="badge badge-gray">${escapeHtml(s || '')}</span>`;
  };
  const cards = state.templates.map((t) => `
    <div class="template-card">
      <div class="template-card-head"><strong>${escapeHtml(t.name)}</strong></div>
      <div class="template-card-meta">${statusBadge(t.status)}<span class="badge badge-gray">${escapeHtml(t.category || '')}</span><span class="badge badge-gray">${escapeHtml(t.language || '')}</span></div>
      <div class="template-card-preview">${escapeHtml(templateBodyText(t))}</div>
      <button class="btn btn-secondary btn-sm" data-use-tpl="${escapeHtml(t.name)}" ${t.status !== 'APPROVED' ? 'disabled' : ''}>Use this template</button>
    </div>
  `).join('');

  grid.innerHTML = cards + `
    <div class="create-template-card" id="createTemplateCard">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      <strong>New Template</strong>
      <span style="font-size:11px;">Meta approval me kuch time lagta hai</span>
    </div>
  `;

  if (!state.templates.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">${ICONS.doc}<strong>Koi template nahi mila</strong><span>Naya template banao neeche</span></div>` + grid.innerHTML;
  }

  document.getElementById('createTemplateCard').addEventListener('click', openTemplateForm);
  grid.querySelectorAll('[data-use-tpl]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tpl = state.templates.find((t) => t.name === btn.dataset.useTpl);
      resetWizard();
      state.send.type = 'template';
      state.send.template = tpl;
      goToView('send');
      document.querySelector('.choice-card[data-type="template"]').classList.add('selected');
      state.send.step = '3-template';
      renderWizard();
    });
  });
}

document.getElementById('newTemplateBtn').addEventListener('click', openTemplateForm);

function openTemplateForm() {
  const existing = document.getElementById('templateFormOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'templateFormOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,12,15,0.5);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:460px;width:100%;max-height:88vh;overflow-y:auto;">
      <div class="card-pad">
        <div class="section-heading"><div><h2>New Template</h2><p>Meta review karega, usually minutes-hours lagte hain</p></div></div>
        <div class="field"><label>Template name</label><input class="input" id="tplName" placeholder="e.g. order_update" /><span class="field-hint">Sirf lowercase letters, numbers, underscore</span></div>
        <div class="field"><label>Category</label>
          <select class="input" id="tplCategory">
            <option value="MARKETING">Marketing</option>
            <option value="UTILITY">Utility</option>
          </select>
        </div>
        <div class="field"><label>Language</label>
          <select class="input" id="tplLanguage">
            <option value="en_US">English (US)</option>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </select>
        </div>
        <div class="field"><label>Body</label><textarea class="input" id="tplBody" rows="5" placeholder="Hi {{1}}, ..."></textarea><span class="field-hint">Variables ke liye {{1}}, {{2}} use karo</span></div>
        <div class="field"><label>Footer (optional)</label><input class="input" id="tplFooter" placeholder="Leela Infra Solution" /></div>
        <div id="tplFormError"></div>
        <div class="wizard-actions" style="border:none;padding-top:6px;margin-top:6px;">
          <button class="btn btn-ghost" id="tplCancelBtn">Cancel</button>
          <button class="btn btn-primary" id="tplSubmitBtn">Create Template</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('tplCancelBtn').addEventListener('click', () => overlay.remove());
  document.getElementById('tplSubmitBtn').addEventListener('click', async () => {
    const btn = document.getElementById('tplSubmitBtn');
    const payload = {
      name: document.getElementById('tplName').value.trim(),
      category: document.getElementById('tplCategory').value,
      language: document.getElementById('tplLanguage').value,
      body: document.getElementById('tplBody').value.trim(),
      footer: document.getElementById('tplFooter').value.trim(),
    };
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating...';
    const res = await api('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      overlay.remove();
      toast('Template submitted for review!', 'success');
      await loadAll(false);
      renderTemplatesView();
    } else {
      btn.disabled = false;
      btn.textContent = 'Create Template';
      document.getElementById('tplFormError').innerHTML = `<div class="result-line fail">✕ ${escapeHtml(res.error)}</div>`;
    }
  });
}

/* ============================================================
   Inbox
   ============================================================ */
function renderConversationList(filter = '') {
  let conversations = getConversations().filter((c) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return c.number.includes(q) || (c.name || '').toLowerCase().includes(q);
  });
  if (state.inboxFilter === 'open') conversations = conversations.filter((c) => c.windowOpen);

  const listEl = document.getElementById('convList');
  if (!conversations.length) {
    const msg = state.inboxFilter === 'open'
      ? { title: 'Koi free window open nahi', body: 'Jab customer message karega, 24 ghante ka free window yahan dikhega' }
      : { title: 'Koi conversation nahi', body: 'Message bhejo ya customer reply ka wait karo' };
    listEl.innerHTML = `<div class="empty-state">${ICONS.inbox}<strong>${msg.title}</strong><span>${msg.body}</span></div>`;
    return;
  }
  listEl.innerHTML = conversations.map((c) => `
    <div class="conv-item ${state.activeConversation === c.number ? 'active' : ''}" data-number="${escapeHtml(c.number)}">
      <div class="avatar avatar-sm">${escapeHtml(initials(c.name, c.number))}</div>
      <div class="conv-item-body">
        <div class="conv-item-top">
          <strong>${escapeHtml(c.name || displayNumber(c.number))}</strong>
          <span class="conv-item-time">${relativeTime(c.lastTimestamp)}</span>
        </div>
        <div class="conv-item-bottom">
          <span>${c.lastMessage?.direction === 'sent' ? 'You: ' : ''}${escapeHtml(previewLabel(c.lastMessage))}</span>
          ${c.windowOpen ? `<span class="window-badge"><span class="filter-dot"></span>${formatWindowRemaining(c.windowExpiresAt)}</span>` : c.awaitingReply ? '<span class="unread-dot"></span>' : ''}
        </div>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('.conv-item').forEach((item) => {
    item.addEventListener('click', () => {
      state.activeConversation = item.dataset.number;
      document.getElementById('appShell').classList.add('inbox-open');
      renderConversationList(document.getElementById('convSearchInput').value);
      renderThread(item.dataset.number);
    });
  });
}

document.getElementById('convSearchInput').addEventListener('input', (e) => renderConversationList(e.target.value));

document.querySelectorAll('.conv-filter-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    state.inboxFilter = tab.dataset.inboxFilter;
    document.querySelectorAll('.conv-filter-tab').forEach((t) => t.classList.toggle('active', t === tab));
    renderConversationList(document.getElementById('convSearchInput').value);
  });
});

function tickIcon(m) {
  if (m.direction !== 'sent') return '';
  if (m.status === 'failed' || m.ok === false) return `<span class="bubble-ticks tick-failed">${ICONS.alert}</span>`;
  if (m.status === 'read') return `<span class="bubble-ticks tick-read">${ICONS.doubleCheck}</span>`;
  if (m.status === 'delivered') return `<span class="bubble-ticks tick-delivered">${ICONS.doubleCheck}</span>`;
  return `<span class="bubble-ticks tick-sent">${ICONS.check}</span>`;
}

function docLinkLabel(m) {
  const isPlaceholder = /^\[[a-z]+\]$/i.test(m.body || '');
  return m.body && !isPlaceholder ? m.body : 'Document';
}

function bubbleMediaHtml(m) {
  if (m.direction === 'sent' && m.mediaUrl) {
    if (m.type === 'image') return `<img src="${m.mediaUrl}" alt="" />`;
    if (m.type === 'video') return `<video src="${m.mediaUrl}" controls></video>`;
    if (m.type === 'audio') return `<audio src="${m.mediaUrl}" controls preload="metadata"></audio>`;
    return `<a class="bubble-doc-link" href="${m.mediaUrl}" target="_blank" rel="noopener">${ICONS.doc} ${escapeHtml(docLinkLabel(m))}</a>`;
  }
  if (m.direction === 'received' && m.mediaId) {
    const src = `/api/media/${m.mediaId}`;
    if (m.type === 'image' || m.type === 'sticker') return `<img src="${src}" alt="" />`;
    if (m.type === 'video') return `<video src="${src}" controls></video>`;
    if (m.type === 'audio') return `<audio src="${src}" controls preload="metadata"></audio>`;
    return `<a class="bubble-doc-link" href="${src}" target="_blank" rel="noopener">${ICONS.doc} ${escapeHtml(docLinkLabel(m))}</a>`;
  }
  return '';
}

function renderThread(number) {
  const conv = getConversations().find((c) => c.number === number);
  document.getElementById('threadEmptyState').style.display = 'none';
  const pane = document.getElementById('threadPane');

  if (!document.getElementById('threadHeader')) {
    pane.insertAdjacentHTML('afterbegin', `
      <div class="thread-header" id="threadHeader">
        <button class="icon-btn thread-back-btn" id="threadBackBtn">${ICONS.back}</button>
        <div class="avatar avatar-sm" id="threadAvatar"></div>
        <div class="thread-header-info"><strong id="threadName"></strong><span id="threadNumber"></span></div>
      </div>
      <div class="thread-body" id="threadBody"></div>
      <div class="composer-session-note" id="composerNote" hidden></div>
      <div class="emoji-picker" id="emojiPicker" hidden></div>
      <div class="composer" id="composerBar">
        <input type="file" id="composerFileInput" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" hidden />
        <button class="composer-icon-btn" id="composerAttachBtn" title="Attach">${ICONS.paperclip}</button>
        <div class="composer-input-area">
          <textarea id="threadComposerInput" rows="1" placeholder="Type a message..."></textarea>
          <div class="composer-recording-inline" id="composerRecordingInline" hidden>
            <span class="rec-dot"></span><span id="recTimer">0:00</span>
          </div>
          <button class="composer-icon-btn composer-emoji-btn" id="composerEmojiBtn" title="Emoji">${ICONS.smile}</button>
        </div>
        <button class="composer-icon-btn" id="recCancelBtn" title="Cancel recording" hidden>${ICONS.close}</button>
        <button class="composer-icon-btn composer-mic-btn" id="composerMicBtn" title="Record voice">${ICONS.mic}</button>
        <button class="composer-send-btn" id="threadSendBtn" hidden>${ICONS.send}</button>
      </div>
    `);
    document.getElementById('threadBackBtn').addEventListener('click', () => {
      document.getElementById('appShell').classList.remove('inbox-open');
    });
    document.getElementById('threadSendBtn').addEventListener('click', sendThreadReply);
    document.getElementById('threadComposerInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendThreadReply(); }
    });
    document.getElementById('threadComposerInput').addEventListener('input', updateComposerButtons);
    updateComposerButtons();

    // Attach — reuses the same upload+send-media endpoints as the Send wizard.
    document.getElementById('composerAttachBtn').addEventListener('click', () => {
      document.getElementById('composerFileInput').click();
    });
    document.getElementById('composerFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file || !state.activeConversation) return;
      const caption = document.getElementById('threadComposerInput').value.trim();
      toast('Uploading...');
      try {
        const fd = new FormData();
        fd.append('file', file);
        const uploadRes = await fetch('/api/upload-media', { method: 'POST', body: fd });
        const uploadData = await uploadRes.json();
        if (!uploadData.ok) throw new Error(uploadData.error || 'Upload failed');
        const res = await api('/api/send-media', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaUrl: uploadData.url, mimetype: uploadData.mimetype, caption, filename: file.name, numbersText: state.activeConversation }),
        });
        if (!res.ok) throw new Error(res.error || (res.failed?.[0]?.data?.error?.message) || 'Send failed');
        document.getElementById('threadComposerInput').value = '';
        updateComposerButtons();
        toast('Media sent', 'success');
        await loadAll(false);
        renderThread(state.activeConversation);
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // Emoji picker
    document.getElementById('composerEmojiBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      const picker = document.getElementById('emojiPicker');
      if (!picker.hidden) { picker.hidden = true; return; }
      if (!picker.dataset.built) {
        picker.innerHTML = EMOJI_LIST.map((em) => `<button type="button" class="emoji-item">${em}</button>`).join('');
        picker.dataset.built = '1';
        picker.querySelectorAll('.emoji-item').forEach((btn) => {
          btn.addEventListener('click', () => {
            const input = document.getElementById('threadComposerInput');
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? input.value.length;
            input.value = input.value.slice(0, start) + btn.textContent + input.value.slice(end);
            input.focus();
            input.selectionStart = input.selectionEnd = start + btn.textContent.length;
            updateComposerButtons();
          });
        });
      }
      picker.hidden = false;
    });
    document.addEventListener('click', (e) => {
      const picker = document.getElementById('emojiPicker');
      const emojiBtn = document.getElementById('composerEmojiBtn');
      if (picker && !picker.hidden && !picker.contains(e.target) && e.target !== emojiBtn) picker.hidden = true;
    });

    // Voice recording
    document.getElementById('composerMicBtn').addEventListener('click', () => {
      if (recorderState.mediaRecorder && recorderState.mediaRecorder.state === 'recording') stopRecordingAndSend();
      else startRecording();
    });
    document.getElementById('recCancelBtn').addEventListener('click', cancelRecording);
  }

  document.getElementById('threadAvatar').textContent = initials(conv?.name, number);
  document.getElementById('threadName').textContent = conv?.name || displayNumber(number);
  document.getElementById('threadNumber').textContent = displayNumber(number);

  const sorted = [...(conv?.messages || [])].sort((a, b) => a.timestamp - b.timestamp);
  let lastDay = null;
  let html = '';
  for (const m of sorted) {
    const dayLabel = formatDayLabel(m.timestamp);
    if (dayLabel !== lastDay) { html += `<div class="date-sep">${dayLabel}</div>`; lastDay = dayLabel; }
    const failed = m.direction === 'sent' && (m.status === 'failed' || m.ok === false);
    const hasMedia = Boolean(m.mediaUrl || m.mediaId);
    // Bodies like "[audio]"/"[image]" are just our own placeholder for
    // media with no real caption — don't show that as if it were text.
    const isPlaceholderBody = /^\[[a-z]+\]$/i.test(m.body || '');
    const showBodyText = m.body && !(hasMedia && isPlaceholderBody);
    const bubbleContent = [
      bubbleMediaHtml(m),
      showBodyText ? escapeHtml(m.body) : '',
    ].filter(Boolean).join('');
    html += `<div class="bubble-row ${m.direction}"><div class="bubble ${m.direction} ${hasMedia ? 'has-media' : ''} ${failed ? 'failed' : ''}">${bubbleContent}<div class="bubble-meta"><span class="bubble-time">${formatClock(m.timestamp)}</span>${tickIcon(m)}</div></div></div>`;
  }
  document.getElementById('threadBody').innerHTML = html;
  document.getElementById('threadBody').scrollTop = document.getElementById('threadBody').scrollHeight;

  document.getElementById('composerNote').hidden = !!conv?.windowOpen;
  document.getElementById('composerNote').textContent = 'Ye number 24-hour free window me nahi hai — sirf approved template hi bhej sakte ho (Send Message > Template).';

  renderInfoPane(conv);
}

async function sendThreadReply() {
  const input = document.getElementById('threadComposerInput');
  const text = input.value.trim();
  if (!text || !state.activeConversation) return;
  input.value = '';
  const res = await api('/api/send-text', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text, numbersText: state.activeConversation }),
  });
  if (!res.ok && res.error) toast(res.error, 'error');
  else if (res.failed?.length) toast(res.failed[0].data?.error?.message || 'Message fail hua', 'error');
  await loadAll(false);
  renderThread(state.activeConversation);
}

function renderInfoPane(conv) {
  const pane = document.getElementById('infoPane');
  if (!conv) { pane.hidden = true; return; }
  pane.hidden = window.innerWidth < 1024;
  const sentCount = conv.messages.filter((m) => m.direction === 'sent').length;
  const recvCount = conv.messages.filter((m) => m.direction === 'received').length;
  pane.innerHTML = `
    <div class="info-pane-center">
      <div class="avatar avatar-lg">${escapeHtml(initials(conv.name, conv.number))}</div>
      <strong>${escapeHtml(conv.name || displayNumber(conv.number))}</strong>
      <span>${escapeHtml(displayNumber(conv.number))}</span>
    </div>
    <div class="info-stat-row"><span>Messages sent</span><span>${sentCount}</span></div>
    <div class="info-stat-row"><span>Replies received</span><span>${recvCount}</span></div>
    <div class="info-stat-row"><span>Last activity</span><span>${relativeTime(conv.lastTimestamp)} ago</span></div>
    <a class="btn btn-secondary btn-block" style="margin-top:16px;" href="https://wa.me/${conv.number}" target="_blank" rel="noopener">Open in WhatsApp</a>
  `;
}

/* ============================================================
   Contacts
   ============================================================ */
// Unions saved (CSV-imported) contacts with numbers derived from message
// history, so a contact shows up whether or not a conversation exists yet.
function getMergedContacts() {
  const byNumber = new Map();
  for (const c of getConversations()) {
    byNumber.set(c.number, {
      number: c.number,
      name: c.name,
      lastTimestamp: c.lastTimestamp,
      sentCount: c.messages.filter((m) => m.direction === 'sent').length,
      recvCount: c.messages.filter((m) => m.direction === 'received').length,
    });
  }
  for (const c of state.contacts) {
    const existing = byNumber.get(c.number);
    if (existing) { if (!existing.name && c.name) existing.name = c.name; }
    else byNumber.set(c.number, { number: c.number, name: c.name, lastTimestamp: 0, sentCount: 0, recvCount: 0 });
  }
  return [...byNumber.values()].sort((a, b) => b.lastTimestamp - a.lastTimestamp);
}

const CONTACTS_RENDER_CAP = 200;

function updateContactsBulkBar(currentList) {
  const count = state.selectedContacts.size;
  document.getElementById('contactsBulkActions').hidden = count === 0;
  document.getElementById('contactsSelectedCount').textContent = `${count} selected`;
  const selectAllCb = document.getElementById('contactsSelectAll');
  selectAllCb.checked = currentList.length > 0 && currentList.every((c) => state.selectedContacts.has(c.number));
  selectAllCb.indeterminate = !selectAllCb.checked && currentList.some((c) => state.selectedContacts.has(c.number));
}

function renderContacts(filter = '') {
  const table = document.getElementById('contactsTable');
  const countText = document.getElementById('contactsCountText');
  const fullList = getMergedContacts();
  const totalCount = fullList.length;

  let list = fullList;
  if (filter) {
    const q = filter.toLowerCase();
    list = list.filter((c) => c.number.includes(q) || (c.name || '').toLowerCase().includes(q));
  }

  const capped = !filter && list.length > CONTACTS_RENDER_CAP;
  const rendered = capped ? list.slice(0, CONTACTS_RENDER_CAP) : list;

  countText.textContent = filter
    ? `${list.length} contact${list.length === 1 ? '' : 's'} matching "${filter}"`
    : `${totalCount.toLocaleString('en-IN')} total contact${totalCount === 1 ? '' : 's'}${capped ? ` — showing ${CONTACTS_RENDER_CAP}, search to narrow down` : ''}`;

  document.getElementById('contactsSelectAllLabel').textContent = filter
    ? `Sab ${list.length} select karo`
    : 'Sab select karo';

  updateContactsBulkBar(list);

  if (!rendered.length) {
    table.innerHTML = `<div class="empty-state">${ICONS.inbox}<strong>Koi contact nahi</strong><span>CSV import karo ya message bhejo — yahan dikhne lagega</span></div>`;
    return;
  }

  table.innerHTML = rendered.map((c) => `
    <div class="contact-row ${state.selectedContacts.has(c.number) ? 'selected' : ''}">
      <input type="checkbox" class="contact-checkbox" data-number="${escapeHtml(c.number)}" ${state.selectedContacts.has(c.number) ? 'checked' : ''} />
      <div class="avatar avatar-sm">${escapeHtml(initials(c.name, c.number))}</div>
      <div class="contact-row-info">
        <strong>${escapeHtml(c.name || displayNumber(c.number))}</strong>
        <span>${escapeHtml(displayNumber(c.number))}</span>
      </div>
      <div class="contact-row-meta">
        <strong>${c.sentCount} sent · ${c.recvCount} received</strong>
        <span>${c.lastTimestamp ? `Last: ${relativeTime(c.lastTimestamp)} ago` : 'No messages yet'}</span>
      </div>
      <button class="icon-btn" title="Send message" data-send-to="${escapeHtml(c.number)}">${ICONS.send}</button>
    </div>
  `).join('');

  table.querySelectorAll('.contact-checkbox').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.selectedContacts.add(cb.dataset.number);
      else state.selectedContacts.delete(cb.dataset.number);
      cb.closest('.contact-row').classList.toggle('selected', cb.checked);
      updateContactsBulkBar(list);
    });
  });

  table.querySelectorAll('[data-send-to]').forEach((btn) => {
    btn.addEventListener('click', () => {
      resetWizard();
      document.getElementById('sendNumbers').value = btn.dataset.sendTo;
      updateRecipientCount();
      goToView('send');
    });
  });

  document.getElementById('contactsSelectAll').onchange = (e) => {
    if (e.target.checked) list.forEach((c) => state.selectedContacts.add(c.number));
    else list.forEach((c) => state.selectedContacts.delete(c.number));
    renderContacts(filter);
  };
}

document.getElementById('contactsSearchInput').addEventListener('input', (e) => renderContacts(e.target.value));

document.getElementById('contactsBulkSendBtn').addEventListener('click', () => {
  const numbers = [...state.selectedContacts];
  if (!numbers.length) return;
  resetWizard();
  document.getElementById('sendNumbers').value = numbers.join('\n');
  updateRecipientCount();
  goToView('send');
});

document.getElementById('contactsClearSelectionBtn').addEventListener('click', () => {
  state.selectedContacts.clear();
  renderContacts(document.getElementById('contactsSearchInput').value);
});

// Accepts "number" or "name,number" / "number,name" per line — whichever
// column looks like a phone number is used as the number, the rest as name.
function parseContactsCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const contacts = [];
  for (const line of lines) {
    const cols = line.split(',').map((c) => c.trim()).filter(Boolean);
    if (!cols.length) continue;
    const numberCol = cols.find((c) => c.replace(/\D/g, '').length >= 10);
    if (!numberCol) continue; // likely a header row or junk line
    const name = cols.find((c) => c !== numberCol) || '';
    contacts.push({ name, number: numberCol.replace(/\D/g, '') });
  }
  return contacts;
}

document.getElementById('contactsCsvInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const feedback = document.getElementById('contactsCsvFeedback');
  feedback.textContent = 'Importing...';
  const contacts = parseContactsCsv(await file.text());
  if (!contacts.length) {
    feedback.textContent = 'CSV me koi valid phone number nahi mila.';
    e.target.value = '';
    return;
  }
  const res = await api('/api/contacts/import', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contacts }),
  });
  if (res.ok) {
    feedback.textContent = `✓ ${res.imported} contact(s) saved — dobara import nahi karna padega.`;
    toast(`${res.imported} contacts imported`, 'success');
    await loadAll(false);
    renderContacts(document.getElementById('contactsSearchInput').value);
  } else {
    feedback.textContent = `✕ ${res.error || 'Import fail hua'}`;
  }
  e.target.value = '';
});

/* ============================================================
   Settings
   ============================================================ */
function renderSettings() {
  const cfg = state.config;
  if (!cfg) return;
  document.getElementById('settingsPhone').textContent = cfg.phoneNumberId ? '+91 86521 67829' : 'Not connected';
  document.getElementById('settingsWabaId').textContent = cfg.wabaId || '—';
  document.getElementById('connNumberText').textContent = cfg.phoneNumberId ? '+91 86521 67829' : 'Disconnected';
}

/* ============================================================
   Boot
   ============================================================ */
goToView('dashboard');
