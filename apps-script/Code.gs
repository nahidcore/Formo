/**
 * FormCraft — Google Apps Script Backend
 * Code.gs — main HTTP router (doGet / doPost), sheet I/O, admin API.
 *
 * Deploy as a Web App:
 *   Deploy > New deployment > type: Web app
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Required Script Properties (Project Settings > Script Properties):
 *   ADMIN_TOKEN      — secret string used to authenticate the admin dashboard
 *   DRIVE_FOLDER_ID  — (optional) Drive folder ID where uploads are stored
 *
 * See README.md for full setup instructions.
 */

const SHEET_NAME = 'Submissions';
const TOPICS_PROP_KEY = 'formcraft_topics'; // ScriptProperties key for topic storage

// Columns that always exist, in order, before the dynamic per-field columns.
const BASE_COLUMNS = ['Submission ID', 'Timestamp', 'IP', 'Browser', 'Name', 'Email', 'Phone'];
const TAIL_COLUMNS = ['Files', 'Status', 'Notes'];

/* ============================== ENTRY POINTS ============================== */

function doGet(e) {
  try {
    const action = (e.parameter.action || 'health').toLowerCase();

    if (action === 'health') {
      return jsonOut({ status: 'ok', message: 'FormCraft backend is running.' });
    }

    if (action === 'list') {
      Validation.verifyAdminToken(e.parameter.token);
      return jsonOut({ status: 'ok', submissions: listSubmissions() });
    }

    if (action === 'status') {
      // Public lookup of a single submission's status by ID — no admin token required.
      const row = findRowBySubmissionId(e.parameter.id);
      if (!row) return jsonOut({ status: 'error', message: 'Submission not found.' });
      return jsonOut({ status: 'ok', submissionId: e.parameter.id, submissionStatus: row.Status || 'New' });
    }

    // ── Topic actions (public reads, no token needed) ──
    if (action === 'gettopics') {
      return jsonOut({ status: 'ok', topics: loadTopics() });
    }

    if (action === 'gettopic') {
      const slug = (e.parameter.slug || '').trim();
      if (!slug) return jsonOut({ status: 'error', message: 'slug required.' });
      const found = loadTopics().find(t => t.slug === slug);
      if (!found) return jsonOut({ status: 'error', message: 'Topic not found.' });
      return jsonOut({ status: 'ok', topic: found });
    }

    return jsonOut({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return jsonOut({ status: 'error', message: err.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    // Normalize POST actions as well so camelCase client actions are handled.
    const action = String(payload.action || '').toLowerCase();

    // Admin-authenticated write actions
    if (action === 'markreviewed') {
      Validation.verifyAdminToken(payload.token);
      setStatus(payload.submissionId, 'Reviewed');
      return jsonOut({ status: 'ok' });
    }
    if (action === 'delete') {
      Validation.verifyAdminToken(payload.token);
      deleteSubmissionRow(payload.submissionId);
      return jsonOut({ status: 'ok' });
    }

    // ── Topic write actions (admin only) ──
    if (action === 'settopics') {
      Validation.verifyAdminToken(payload.token);
      const topics = payload.topics;
      if (!Array.isArray(topics)) return jsonOut({ status: 'error', message: 'topics must be an array.' });
      saveTopics(topics);
      return jsonOut({ status: 'ok', topics: topics });
    }

    if (action === 'deletetopic') {
      Validation.verifyAdminToken(payload.token);
      const slug = (payload.slug || '').trim();
      if (!slug) return jsonOut({ status: 'error', message: 'slug required.' });
      const next = loadTopics().filter(t => t.slug !== slug);
      saveTopics(next);
      return jsonOut({ status: 'ok', topics: next });
    }

    if (action) return jsonOut({ status: 'error', message: 'Unknown action: ' + action });
    return handleSubmission(payload, e);
  } catch (err) {
    return jsonOut({ status: 'error', message: err.message });
  }
}

/* ============================== SUBMISSION HANDLING ============================== */

function handleSubmission(payload, e) {
  const ip = (e && e.parameter && e.parameter.ip) || 'unknown';

  // 1) Spam defenses
  Validation.checkHoneypot(payload.honeypot);
  Validation.checkRateLimit(ip);

  // 2) Sanitize all user-supplied text
  const values = Validation.sanitizeObject(payload.values || {});

  // 3) Persist uploaded files & signatures to Drive
  const fileLinks = Upload.saveFiles(payload.files || [], payload.submissionId);
  const sigLinks = Upload.saveSignatures(payload.signatures || {}, payload.submissionId);
  const allFiles = fileLinks.concat(sigLinks);

  // 4) Write the row
  appendSubmissionRow({
    submissionId: payload.submissionId || Utilities.getUuid(),
    timestamp: payload.timestamp || new Date().toISOString(),
    ip: ip,
    browser: (payload.userAgent || '').slice(0, 250),
    values: values,
    files: allFiles,
  });

  return jsonOut({ status: 'ok', submissionId: payload.submissionId });
}

/* ============================== SHEET HELPERS ============================== */

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(BASE_COLUMNS.concat(TAIL_COLUMNS));
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getHeaders(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].filter(String);
}

/** Ensures every key in `fieldKeys` has a column, inserting new columns before the TAIL_COLUMNS. */
function ensureFieldColumns(sheet, fieldKeys) {
  let headers = getHeaders(sheet);
  const tailStart = headers.length - TAIL_COLUMNS.length;
  const existing = new Set(headers);
  const missing = fieldKeys.filter(k => !existing.has(k));
  if (missing.length === 0) return getHeaders(sheet);

  // Insert missing columns right before the TAIL_COLUMNS block
  missing.forEach((key, i) => {
    sheet.insertColumnBefore(tailStart + 1 + i);
    sheet.getRange(1, tailStart + 1 + i).setValue(key);
  });
  return getHeaders(sheet);
}

function appendSubmissionRow({ submissionId, timestamp, ip, browser, values, files }) {
  const sheet = getSheet();
  const fieldKeys = Object.keys(values);
  const headers = ensureFieldColumns(sheet, fieldKeys);

  const rowMap = {
    'Submission ID': submissionId,
    'Timestamp': timestamp,
    'IP': ip,
    'Browser': browser,
    'Name': formatCell(values.full_name || values.name || ''),
    'Email': formatCell(values.email || ''),
    'Phone': formatCell(values.phone || ''),
    'Files': JSON.stringify(files || []),
    'Status': 'New',
    'Notes': '',
  };
  fieldKeys.forEach(k => { rowMap[k] = formatCell(values[k]); });

  const row = headers.map(h => (h in rowMap ? rowMap[h] : ''));
  sheet.appendRow(row);
}

function formatCell(v) {
  if (Array.isArray(v)) v = v.join(', ');
  if (v === null || v === undefined) return '';
  let str = String(v);
  const formulaPrefix = /^\s*[+=@-]/;
  if (formulaPrefix.test(str)) {
    str = "'" + str;
  }
  return str;
}

function listSubmissions() {
  const sheet = getSheet();
  const headers = getHeaders(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  return data.map(row => {
    const rec = { values: {} };
    headers.forEach((h, i) => {
      const val = row[i];
      if (h === 'Submission ID') rec.submissionId = val;
      else if (h === 'Timestamp') rec.timestamp = val;
      else if (h === 'Status') rec.status = val || 'New';
      else if (h === 'Files') { try { rec.files = JSON.parse(val || '[]'); } catch (e) { rec.files = []; } }
      else if (h === 'Notes') rec.notes = val;
      else if (['IP', 'Browser'].includes(h)) rec[h.toLowerCase()] = val;
      else rec.values[h] = val;
    });
    // Convenience top-level aliases used by the admin table
    rec.full_name = rec.values['Name'] || rec.values['full_name'] || '';
    rec.email = rec.values['Email'] || rec.values['email'] || '';
    rec.phone = rec.values['Phone'] || rec.values['phone'] || '';
    return rec;
  }).reverse();
}

function findRowIndexBySubmissionId(id) {
  const sheet = getSheet();
  const headers = getHeaders(sheet);
  const idCol = headers.indexOf('Submission ID') + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2; // +2: header row + 1-index
  }
  return -1;
}

function findRowBySubmissionId(id) {
  const rowIndex = findRowIndexBySubmissionId(id);
  if (rowIndex === -1) return null;
  const sheet = getSheet();
  const headers = getHeaders(sheet);
  const row = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const rec = {};
  headers.forEach((h, i) => rec[h] = row[i]);
  return rec;
}

function setStatus(submissionId, status) {
  const rowIndex = findRowIndexBySubmissionId(submissionId);
  if (rowIndex === -1) throw new Error('Submission not found.');
  const sheet = getSheet();
  const headers = getHeaders(sheet);
  const statusCol = headers.indexOf('Status') + 1;
  sheet.getRange(rowIndex, statusCol).setValue(status);
}

function deleteSubmissionRow(submissionId) {
  const rowIndex = findRowIndexBySubmissionId(submissionId);
  if (rowIndex === -1) throw new Error('Submission not found.');
  getSheet().deleteRow(rowIndex);
}

/* ============================== TOPIC STORAGE ============================== */

function getTopicsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Topics');
  if (!sheet) {
    sheet = ss.insertSheet('Topics');
    sheet.appendRow(['Slug', 'Name', 'Field IDs', 'Created At']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Load topics array from the "Topics" sheet.
 */
function loadTopics() {
  try {
    const sheet = getTopicsSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    
    return data.map(row => {
      let fieldIds = [];
      try { fieldIds = row[2] ? JSON.parse(String(row[2])) : []; } catch (e) {}
      return {
        slug: String(row[0]),
        name: String(row[1]),
        fieldIds: fieldIds,
        createdAt: String(row[3])
      };
    }).filter(t => t.slug);
  } catch (e) {
    return [];
  }
}

/**
 * Persist topics array to the "Topics" sheet.
 */
function saveTopics(topics) {
  const sheet = getTopicsSheet();
  const lastRow = Math.max(sheet.getLastRow(), 1);
  
  // Clear existing rows (if any) beneath the header
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 4).clearContent();
  }
  
  if (!topics || topics.length === 0) return;
  
  // Write new data
  const rows = topics.map(t => [
    t.slug || '',
    t.name || '',
    JSON.stringify(t.fieldIds || []),
    t.createdAt || new Date().toISOString()
  ]);
  
  sheet.getRange(2, 1, rows.length, 4).setValues(rows);
}

/* ============================== RESPONSE HELPER ============================== */

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
