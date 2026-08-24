// Tabs
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// Parses recipient text the same way the server does (newline/comma separated,
// digits only, 10+ chars), plus dedupes and reports invalid/duplicate counts
// so the user can see exactly who will receive the message before sending.
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

function updateRecipientInfo(textarea, infoEl) {
  if (!textarea || !infoEl) return;
  const { valid, invalidCount, duplicateCount } = parseNumbersClient(textarea.value);
  let msg = `${valid.length} number${valid.length === 1 ? '' : 's'} ko bheja jaayega`;
  const extras = [];
  if (invalidCount > 0) extras.push(`${invalidCount} ignore hue (invalid)`);
  if (duplicateCount > 0) extras.push(`${duplicateCount} duplicate hataye`);
  if (extras.length) msg += ` — ${extras.join(', ')}`;
  infoEl.textContent = msg;
  infoEl.classList.toggle('warn', valid.length === 0);
}

function wireRecipientCounter(textareaSelector, infoId) {
  const textarea = document.querySelector(textareaSelector);
  const infoEl = document.getElementById(infoId);
  if (!textarea || !infoEl) return;
  textarea.addEventListener('input', () => updateRecipientInfo(textarea, infoEl));
  updateRecipientInfo(textarea, infoEl);
}

wireRecipientCounter('#templateForm textarea[name="numbersText"]', 'templateRecipientInfo');
wireRecipientCounter('#textForm textarea[name="numbersText"]', 'textRecipientInfo');
wireRecipientCounter('#mediaForm textarea[name="numbersText"]', 'mediaRecipientInfo');

// Message character counter (Text tab)
const messageTextarea = document.querySelector('#textForm textarea[name="message"]');
const charCountEl = document.getElementById('textCharCount');
if (messageTextarea && charCountEl) {
  const updateCharCount = () => {
    charCountEl.textContent = `${messageTextarea.value.length} / 4096 characters`;
  };
  messageTextarea.addEventListener('input', updateCharCount);
  updateCharCount();
}

// CSV/text upload: pulls phone-number-looking cells out of the file, merges
// them with whatever's already typed (deduped), and tells the user what changed.
function wireCsvUpload(inputId, textareaSelector, feedbackId, infoId) {
  const input = document.getElementById(inputId);
  const textarea = document.querySelector(textareaSelector);
  const feedbackEl = document.getElementById(feedbackId);
  const infoEl = document.getElementById(infoId);
  if (!input || !textarea) return;

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;

    const text = await file.text();
    const { valid: fromCsv } = parseNumbersClient(text);
    const { valid: existing } = parseNumbersClient(textarea.value);
    const merged = [...new Set([...existing, ...fromCsv])];
    const added = merged.length - existing.length;

    textarea.value = merged.join('\n');
    updateRecipientInfo(textarea, infoEl);

    if (feedbackEl) {
      if (added > 0) {
        feedbackEl.textContent = `✓ CSV se ${added} naya number add hua.`;
      } else if (fromCsv.length > 0) {
        feedbackEl.textContent = 'Ye saare numbers pehle se list me hain.';
      } else {
        feedbackEl.textContent = 'CSV me koi valid phone number nahi mila.';
      }
    }
    input.value = ''; // allow re-selecting the same file later
  });
}

wireCsvUpload('templateCsv', '#templateForm textarea[name="numbersText"]', 'templateCsvFeedback', 'templateRecipientInfo');
wireCsvUpload('textCsv', '#textForm textarea[name="numbersText"]', 'textCsvFeedback', 'textRecipientInfo');
wireCsvUpload('mediaCsv', '#mediaForm textarea[name="numbersText"]', 'mediaCsvFeedback', 'mediaRecipientInfo');

// Media file -> upload to server -> fill the URL field automatically.
// Once a file is uploaded, the URL field is locked (file and URL are
// mutually exclusive) until the user explicitly removes the file.
let uploadedMediaMime = '';
const mediaFileInput = document.getElementById('mediaFile');
const mediaUrlInput = document.getElementById('mediaUrlInput');
const mediaFileFeedback = document.getElementById('mediaFileFeedback');
const clearMediaBtn = document.getElementById('clearMediaBtn');

if (mediaFileInput) {
  mediaFileInput.addEventListener('change', async () => {
    const file = mediaFileInput.files[0];
    if (!file) return;
    const mediaResultEl = document.getElementById('mediaResult');
    mediaUrlInput.value = 'Upload ho raha hai...';
    mediaUrlInput.readOnly = true;
    if (mediaFileFeedback) mediaFileFeedback.textContent = '';
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload-media', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.ok) {
        mediaUrlInput.value = data.url;
        uploadedMediaMime = data.mimetype;
        if (mediaFileFeedback) mediaFileFeedback.textContent = `✓ "${file.name}" upload ho gayi.`;
        if (clearMediaBtn) clearMediaBtn.hidden = false;
      } else {
        mediaUrlInput.value = '';
        mediaUrlInput.readOnly = false;
        showResult(mediaResultEl, false, `Upload error: ${data.error}`);
      }
    } catch (err) {
      mediaUrlInput.value = '';
      mediaUrlInput.readOnly = false;
      showResult(mediaResultEl, false, `Upload error: ${err.message}`);
    }
  });
}

if (clearMediaBtn) {
  clearMediaBtn.addEventListener('click', () => {
    mediaFileInput.value = '';
    mediaUrlInput.value = '';
    mediaUrlInput.readOnly = false;
    uploadedMediaMime = '';
    clearMediaBtn.hidden = true;
    if (mediaFileFeedback) mediaFileFeedback.textContent = '';
  });
}

function showResult(el, ok, text) {
  el.textContent = text;
  el.className = 'result ' + (ok ? 'success' : 'error');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function formatFailedList(failed) {
  return (failed || [])
    .map((f) => `✕ ${f.to}: ${f.error || (f.data && (f.data.error?.message || JSON.stringify(f.data))) || 'Unknown error'}`)
    .join('\n');
}

// Disables every input/button in a form while a send is in progress, and
// restores their previous state afterwards (so nothing can be double-submitted).
function setFormBusy(form, busy) {
  form.querySelectorAll('input, textarea, select, button').forEach((el) => {
    if (busy) {
      el.dataset.wasDisabled = el.disabled ? '1' : '0';
      el.disabled = true;
    } else if (el.dataset.wasDisabled !== undefined) {
      el.disabled = el.dataset.wasDisabled === '1';
      delete el.dataset.wasDisabled;
    }
  });
}

document.getElementById('templateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const resultEl = document.getElementById('templateResult');
  const fd = new FormData(form);
  const { valid: recipients } = parseNumbersClient(fd.get('numbersText'));

  if (recipients.length === 0) {
    showResult(resultEl, false, 'Kam se kam ek valid phone number do.');
    return;
  }
  if (!confirm(`${recipients.length} number(s) ko template message bheja jaayega. Confirm karein?`)) {
    return;
  }

  setFormBusy(form, true);
  showResult(resultEl, true, 'Bhej raha hoon...');

  const payload = {
    templateName: fd.get('templateName'),
    language: fd.get('language'),
    variables: (fd.get('variables') || '').split(',').map((v) => v.trim()).filter(Boolean),
    numbersText: recipients.join('\n'),
  };

  try {
    const res = await fetch('/api/send-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) {
      showResult(resultEl, true, `✓ Bheja gaya ${data.sentTo} number(s) ko.`);
    } else if (data.error) {
      showResult(resultEl, false, `Error: ${data.error}`);
    } else {
      showResult(resultEl, false, `${data.sentTo || 0} bheje gaye, kuch fail hue:\n${formatFailedList(data.failed)}`);
    }
  } catch (err) {
    showResult(resultEl, false, `Error: ${err.message}`);
  } finally {
    setFormBusy(form, false);
  }
});

document.getElementById('textForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const resultEl = document.getElementById('textResult');
  const fd = new FormData(form);
  const { valid: recipients } = parseNumbersClient(fd.get('numbersText'));

  if (recipients.length === 0) {
    showResult(resultEl, false, 'Kam se kam ek valid phone number do.');
    return;
  }
  if (!confirm(`${recipients.length} number(s) ko message bheja jaayega. Confirm karein?`)) {
    return;
  }

  setFormBusy(form, true);
  showResult(resultEl, true, 'Bhej raha hoon...');

  const payload = {
    message: fd.get('message'),
    numbersText: recipients.join('\n'),
  };

  try {
    const res = await fetch('/api/send-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) {
      showResult(resultEl, true, `✓ Bheja gaya ${data.sentTo} number(s) ko.`);
    } else {
      showResult(resultEl, false, `${data.sentTo || 0} bheje gaye, kuch fail hue:\n${formatFailedList(data.failed)}`);
    }
  } catch (err) {
    showResult(resultEl, false, `Error: ${err.message}`);
  } finally {
    setFormBusy(form, false);
  }
});

document.getElementById('mediaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const resultEl = document.getElementById('mediaResult');
  const fd = new FormData(form);
  const { valid: recipients } = parseNumbersClient(fd.get('numbersText'));

  if (!fd.get('mediaUrl')) {
    showResult(resultEl, false, 'File upload karo ya Media URL do.');
    return;
  }
  if (recipients.length === 0) {
    showResult(resultEl, false, 'Kam se kam ek valid phone number do.');
    return;
  }
  if (!confirm(`${recipients.length} number(s) ko media message bheja jaayega. Confirm karein?`)) {
    return;
  }

  setFormBusy(form, true);
  showResult(resultEl, true, 'Bhej raha hoon...');

  const payload = {
    mediaUrl: fd.get('mediaUrl'),
    mediaType: fd.get('mediaType'),
    mimetype: uploadedMediaMime,
    caption: fd.get('caption'),
    filename: mediaFileInput && mediaFileInput.files[0] ? mediaFileInput.files[0].name : '',
    numbersText: recipients.join('\n'),
  };

  try {
    const res = await fetch('/api/send-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) {
      showResult(resultEl, true, `✓ Bheja gaya ${data.sentTo} number(s) ko.`);
    } else {
      showResult(resultEl, false, `Error: ${data.error || ''}\n${formatFailedList(data.failed)}`);
    }
  } catch (err) {
    showResult(resultEl, false, `Error: ${err.message}`);
  } finally {
    setFormBusy(form, false);
  }
});

// Clear buttons: reset the form and all derived UI state (counters, feedback, results).
document.querySelectorAll('[data-reset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const form = document.getElementById(btn.dataset.reset);
    if (!form) return;
    form.reset();
    form.querySelectorAll('.recipient-info').forEach((el) => updateRecipientInfo(form.querySelector('textarea[name="numbersText"]'), el));
    form.querySelectorAll('.csv-feedback').forEach((el) => { el.textContent = ''; });
    const resultEl = document.getElementById(`${form.id.replace('Form', '')}Result`);
    if (resultEl) { resultEl.textContent = ''; resultEl.className = 'result'; }
    if (form.id === 'mediaForm') {
      uploadedMediaMime = '';
      if (mediaUrlInput) mediaUrlInput.readOnly = false;
      if (clearMediaBtn) clearMediaBtn.hidden = true;
    }
    if (form.id === 'textForm' && charCountEl) charCountEl.textContent = '0 / 4096 characters';
  });
});
