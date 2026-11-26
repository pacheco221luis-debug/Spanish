/**
 * Spanish with Lisa — inquiry receiver for Google Sheets (v4).
 * Deploy as a Google Apps Script Web App. Keep secrets in Script Properties:
 *   INQUIRY_SPREADSHEET_ID  (required)  ID of the destination spreadsheet
 *   INQUIRY_WEBHOOK_SECRET  (required)  same random value as GOOGLE_SHEETS_WEBHOOK_SECRET in Cloudflare
 *   NOTIFY_EMAIL            (optional)  address that gets a "new inquiry" alert (no personal data inside)
 */
const SHEET_NAME = 'Inquiries';
const HEADERS = ['Received at', 'Name', 'Email', 'Phone / WhatsApp', 'Spanish level', 'Interests', 'Preferred days', 'Preferred time', 'Comments / goals', 'Consent', 'Consent timestamp', 'Privacy version', 'Status', 'Notes'];
const STATUSES = ['New', 'Contacted', 'Scheduled', 'Active', 'Renewal due', 'Closed'];
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000; // same person re-sending within 24 h is not saved twice
const DUPLICATE_LOOKBACK_ROWS = 200;
const RETENTION_DAYS = 365;                        // must match the Privacy Policy (12 months)
const KEEP_STATUSES = ['Scheduled', 'Active', 'Renewal due']; // rows with active engagement are never purged

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const props = PropertiesService.getScriptProperties();
    const expectedSecret = props.getProperty('INQUIRY_WEBHOOK_SECRET');
    const spreadsheetId = props.getProperty('INQUIRY_SPREADSHEET_ID');
    if (!expectedSecret || !spreadsheetId || body.secret !== expectedSecret || !body.inquiry) {
      return output({ success: false, error: 'Unauthorized or incomplete request' });
    }

    lock.waitLock(15000); // avoid two simultaneous inquiries writing to the same row
    const data = body.inquiry;
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) setupSheet_(sheet);

    // Idempotent: a repeated submission (double click, retry after a dropped connection) is acknowledged but not saved again.
    if (isDuplicate_(sheet, data)) return output({ success: true, duplicate: true });

    const row = [
      data.receivedAt || new Date().toISOString(),
      data.name || '', data.email || '', data.phone || '', data.level || '',
      Array.isArray(data.interests) ? data.interests.join(', ') : '',
      Array.isArray(data.days) ? data.days.join(', ') : '',
      data.time || '', data.comments || '', data.privacyConsent === true ? 'Yes' : 'No',
      data.consentTimestamp || '', data.privacyVersion || '',
      'New', ''
    ];
    const target = sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length);
    target.setNumberFormat('@'); // plain text: keeps "+503…" intact and never evaluates formulas
    target.setValues([row]);

    notify_(spreadsheet);
    return output({ success: true });
  } catch (error) {
    console.error(error);
    return output({ success: false, error: 'Could not save inquiry' });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function setupSheet_(sheet) {
  sheet.appendRow(HEADERS);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  const statusCol = HEADERS.indexOf('Status') + 1;
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build();
  sheet.getRange(2, statusCol, 998, 1).setDataValidation(rule);
}

// Duplicate = same email, or same phone + same name, received within the last 24 hours.
function isDuplicate_(sheet, data) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const start = Math.max(2, last - DUPLICATE_LOOKBACK_ROWS + 1);
  const rows = sheet.getRange(start, 1, last - start + 1, 4).getValues(); // Received at, Name, Email, Phone
  const email = String(data.email || '').trim().toLowerCase();
  const name = String(data.name || '').trim().toLowerCase().replace(/^'/, '');
  const phone = String(data.phone || '').replace(/\D/g, '');
  const now = Date.now();
  return rows.some(function (r) {
    const t = Date.parse(r[0]);
    if (isNaN(t) || now - t > DUPLICATE_WINDOW_MS) return false;
    const sameEmail = email && String(r[2]).trim().toLowerCase() === email;
    const samePhoneAndName = phone && String(r[3]).replace(/\D/g, '') === phone &&
      String(r[1]).trim().toLowerCase().replace(/^'/, '') === name;
    return sameEmail || samePhoneAndName;
  });
}

/**
 * Data retention (Privacy Policy, section 6): deletes inquiries older than RETENTION_DAYS unless their Status
 * shows active engagement (Scheduled / Active / Renewal due). Run installRetentionTrigger() ONCE to schedule it monthly.
 * Tip: test purgeOldInquiries() on a copy of the spreadsheet first.
 */
function purgeOldInquiries() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const id = PropertiesService.getScriptProperties().getProperty('INQUIRY_SPREADSHEET_ID');
    const sheet = SpreadsheetApp.openById(id).getSheetByName(SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return 0;
    const statusIdx = HEADERS.indexOf('Status');
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (let i = values.length - 1; i >= 0; i--) { // bottom-up so row numbers stay valid
      const t = Date.parse(values[i][0]);
      if (!isNaN(t) && t < cutoff && KEEP_STATUSES.indexOf(String(values[i][statusIdx])) === -1) {
        sheet.deleteRow(i + 2);
        removed++;
      }
    }
    console.log('purgeOldInquiries removed ' + removed + ' row(s)');
    return removed;
  } finally {
    lock.releaseLock();
  }
}

function installRetentionTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'purgeOldInquiries') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('purgeOldInquiries').timeBased().onMonthDay(1).atHour(3).create();
}

function notify_(spreadsheet) {
  const to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (!to) return;
  try {
    MailApp.sendEmail(to, 'New Spanish with Lisa inquiry', 'A new inquiry has arrived. Open the sheet to review it:\n' + spreadsheet.getUrl());
  } catch (error) {
    console.error(error); // a failed alert must never fail the saved inquiry
  }
}

function output(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
