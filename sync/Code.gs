/**
 * KAIA DESK 동기화용 Google Apps Script
 * 1) 아래 KEY를 나만 아는 긴 문자열로 바꾸세요. (앱 설정의 "비밀 키"에 똑같이 넣어요)
 * 2) 배포 → 새 배포 → 유형: 웹 앱 → 실행: 나 / 액세스: 모든 사용자 → 배포
 * 3) 나온 웹 앱 주소(…/exec)를 앱 설정 → PC · 휴대폰 동기화에 붙여 넣으세요.
 */
const KEY = '여기에-나만-아는-비밀키를-넣으세요';
const SHEET = 'kaia_data';

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(SHEET);
  if (!s) { s = ss.insertSheet(SHEET); s.appendRow(['col', 'id', 'json', 'updated', 'deleted']); s.setFrozenRows(1); }
  return s;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  const p = e.parameter || {};
  if (p.key !== KEY) return out_({ error: 'auth' });
  const since = Number(p.since || 0);
  const rows = sheet_().getDataRange().getValues().slice(1);
  const docs = [];
  rows.forEach(r => {
    if (!r[0] || Number(r[3]) <= since) return;
    docs.push({ col: r[0], id: String(r[1]), t: Number(r[3]), del: !!r[4], data: r[4] ? null : JSON.parse(r[2] || 'null') });
  });
  return out_({ now: Date.now(), docs: docs });
}

function doPost(e) {
  const b = JSON.parse(e.postData.contents || '{}');
  if (b.key !== KEY) return out_({ error: 'auth' });
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const s = sheet_();
    const vals = s.getDataRange().getValues();
    const idx = {}; vals.forEach((r, i) => { if (i) idx[r[0] + '/' + r[1]] = i + 1; });
    const now = Date.now();
    (b.writes || []).forEach(w => {
      const k = w.col + '/' + w.id;
      const row = [w.col, String(w.id), w.del ? '' : JSON.stringify(w.data), now, w.del ? 1 : ''];
      if (idx[k]) s.getRange(idx[k], 1, 1, 5).setValues([row]);
      else { s.appendRow(row); idx[k] = s.getLastRow(); }
    });
    return out_({ ok: true, now: now });
  } finally { lock.releaseLock(); }
}
