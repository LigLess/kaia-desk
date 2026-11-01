/**
 * KAIA DESK 팀 서버 (Google Apps Script)
 * - 팀원마다 아이디 · 비밀번호로 로그인하고, 각자 자기 데이터만 보고 써요.
 * - 시간표(과정)와 강의실 · 줌 회의 정보는 팀이 같이 써요.
 *
 * 1) 아래 TEAM_CODE를 팀원에게만 알려줄 "가입 코드"로 바꾸세요.
 * 2) 배포 → 새 배포 → 유형: 웹 앱 → 실행: 나 / 액세스: 모든 사용자 → 배포
 * 3) 나온 웹 앱 주소(…/exec)를 앱의 설정 → 계정 · 동기화에 넣으세요.
 *
 * 커뮤니티(게시판 · 파일 · DB 배정)를 처음 켤 때: 이 코드로 바꾼 뒤 배포 관리 → 수정 → 새 버전 → 배포.
 *   드라이브 · 메일 권한을 물어보면 "허용"을 눌러 주세요. 올린 파일은 내 드라이브의 "KAIA DESK 팀 파일" 폴더에 저장돼요.
 *
 * 팀장 권한: kaia_users 탭 H열(role)에 "팀장"이라고 적으면 그 사람은 앱의 팀 → 팀원 학생에서 직원들의 학생 명단을 볼 수 있어요(보기 전용).
 *   I열(manager)에 팀장 아이디를 적은 직원만 그 팀장에게 보이고, I열이 비어 있으면 모든 팀장에게 보여요. 조회 기록은 kaia_log 탭에 남아요.
 *
 * 과제 제출(v10): 학생은 로그인 없이 과제 링크로 과제 파일을 받고, 작성한 파일을 올려요. 링크마다 따로 만든 열쇠가 맞을 때만 돼요.
 *   올린 파일은 "KAIA DESK 팀 파일" 폴더에 저장되고, 과제를 낸 멘토의 앱으로 자동으로 들어가요(제출 기록은 kaia_data 탭 hwsub).
 *
 * 비밀번호를 잊은 팀원: 시트의 kaia_users 탭에서 그 사람 줄을 지우면, 같은 아이디로 다시 가입할 수 있고 데이터는 그대로예요.
 */
const TEAM_CODE = '여기에-팀-가입코드를-넣으세요';

const DATA = 'kaia_data';
const USERS = 'kaia_users';
const TEAM_OWNER = '_team';
const SHARED = { courses: true, inbox: true, posts: true, comments: true, leads: true, qshare: true }; // 팀 공용 (meta/team 도 공용 · inbox 진단 수신함 · posts/comments 게시판 · leads DB 배정)
const MAX_FILE = 31 * 1024 * 1024;
const HW_MAX_SUB = 15;               // 과제 링크 하나로 올릴 수 있는 파일 수 (다시 제출 포함)
const HW_OWNER = '_hw';              // 과제 열쇠를 적어 두는 줄의 주인 이름   // 게시판 첨부 한 파일 30MB (구글 앱스 스크립트 요청 한도 약 50MB 안쪽)

function ss_() { return SpreadsheetApp.getActive(); }
function dataSheet_() {
  let s = ss_().getSheetByName(DATA);
  if (!s) { s = ss_().insertSheet(DATA); s.appendRow(['owner', 'col', 'id', 'json', 'updated', 'deleted']); s.setFrozenRows(1); }
  return s;
}
function userSheet_() {
  let s = ss_().getSheetByName(USERS);
  if (!s) { s = ss_().insertSheet(USERS); s.appendRow(['user', 'name', 'salt', 'hash', 'tokens', 'created', 'email', 'role', 'manager']); s.setFrozenRows(1); }
  if (s.getLastColumn() < 9) s.getRange(1, 8, 1, 2).setValues([['role', 'manager']]);   // 팀장 권한 칸 (H: 역할 · I: 담당 팀장 아이디)
  return s;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function hash_(salt, pw) {
  let h = salt + '|' + pw;
  for (let i = 0; i < 300; i++) h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  return h;
}
function norm_(u) { return String(u || '').trim().toLowerCase(); }
function findUser_(user) {
  const s = userSheet_(); const v = s.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (norm_(v[i][0]) === user) return { row: i + 1, r: v[i], s: s };
  return null;
}
function newToken_(u) {
  const t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  let list = []; try { list = JSON.parse(u.r[4] || '[]'); } catch (e) {}
  list.push(t); list = list.slice(-12); // 기기 최대 12대
  u.s.getRange(u.row, 5).setValue(JSON.stringify(list));
  return t;
}
function auth_(token) {
  if (!token) return null;
  const c = CacheService.getScriptCache(); const hit = c.get('t_' + token); if (hit) return hit;
  const v = userSheet_().getDataRange().getValues();
  for (let i = 1; i < v.length; i++) { if (String(v[i][4] || '').indexOf(token) >= 0) { const u = norm_(v[i][0]); c.put('t_' + token, u, 1800); return u; } }
  return null;
}
function tooMany_(user) { const c = CacheService.getScriptCache(); return Number(c.get('f_' + user) || 0) >= 6; }
function fail_(user) { const c = CacheService.getScriptCache(); c.put('f_' + user, String(Number(c.get('f_' + user) || 0) + 1), 600); }

function folder_() {
  const p = PropertiesService.getScriptProperties(); const id = p.getProperty('FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder('KAIA DESK 팀 파일'); p.setProperty('FOLDER', f.getId()); return f;
}
function tmpFolder_() {   // 나눠 올린 조각을 잠깐 두는 곳 (합친 뒤 휴지통으로)
  const p = PropertiesService.getScriptProperties(); const id = p.getProperty('TMP');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = folder_().createFolder('_올리는 중'); p.setProperty('TMP', f.getId()); return f;
}
function inFolder_(file) { const fid = folder_().getId(); const it = file.getParents(); while (it.hasNext()) if (it.next().getId() === fid) return true; return false; }
const isLead_ = r => /^(팀장|lead|manager|admin)$/i.test(String(r[7] || '').trim());
function staffOf_(lead, rows) { return rows.filter(r => norm_(r[0]) !== lead && !isLead_(r) && (!String(r[8] || '').trim() || norm_(r[8]) === lead)); }
function log_(who, what, target) {
  let s = ss_().getSheetByName('kaia_log');
  if (!s) { s = ss_().insertSheet('kaia_log'); s.appendRow(['when', 'who', 'what', 'target']); s.setFrozenRows(1); }
  s.appendRow([new Date(), who, what, target]);
}
function nameOf_(user) { const u = findUser_(user); return u ? String(u.r[1] || user) : user; }
function mailLead_(lead, uid) {
  try {
    const u = findUser_(norm_(lead.to)); const to = u ? String(u.r[6] || '').trim() : '';
    if (!to || !/@/.test(to)) return;
    const from = nameOf_(uid);
    const subj = '[KAIA DESK] ' + (lead.name || '') + '문의 배정_' + from + '전달';
    const body = [subj, '', '문의자: ' + (lead.name || '-'), '연락처: ' + (lead.phone || '-'), '관심 과정: ' + (lead.course || '-'), '문의 경로: ' + (lead.src || '-'), '', (lead.memo || ''), '', '앱에서 확인: KAIA DESK → 팀 → DB 배정'].join('\n');
    MailApp.sendEmail(to, subj, body);
  } catch (e) {}
}

/* 처음 한 번: 편집기 위쪽 함수 목록에서 "authorize"를 고르고 ▶실행 → 권한 허용 (드라이브에 첨부 파일을 저장하는 권한) */
function authorize() {
  const f = folder_(); const t = tmpFolder_();
  const x = t.createFile('권한확인.txt', 'ok', 'text/plain'); x.setTrashed(true);
  Logger.log('권한 확인 완료 — 팀 파일 폴더: ' + f.getName());
}
/* 서버에서 오류가 나도 앱이 원인을 볼 수 있게 감싸요 (편집기에서 ▶실행을 눌러도 오류 안 남) */

/* ---------- 과제 제출 (v10) ---------- */
function hwKey_(k) {   // 열쇠로 과제 찾기 → { r: 줄 데이터 }
  k = String(k || '').replace(/[^\w]/g, '');
  if (k.length < 20) return null;
  const v = dataSheet_().getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (v[i][0] === HW_OWNER && v[i][1] === 'hwkey' && String(v[i][2]) === k && !v[i][5]) { try { return { k: k, d: JSON.parse(v[i][3]) }; } catch (e) { return null; } }
  return null;
}
function hwSubs_(k) {
  const out = [];
  dataSheet_().getDataRange().getValues().slice(1).forEach(r => { if (r[1] !== 'hwsub' || r[5]) return; let d = null; try { d = JSON.parse(r[3] || 'null'); } catch (e) {} if (d && d.k === k) out.push({ name: d.name, size: d.size, at: d.at }); });
  return out;
}
function hwRate_(k) { const c = CacheService.getScriptCache(); const n = Number(c.get('hw_' + k) || 0); if (n > 40) return false; c.put('hw_' + k, String(n + 1), 600); return true; }
function hwSave_(key, bytes, name, type, cm) {   // 학생 파일 저장 + 멘토에게 제출 기록
  const d = key.d;
  if (hwSubs_(key.k).length >= HW_MAX_SUB) return { error: 'limit' };
  const clean = String(name || 'file').replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
  const f = folder_().createFile(Utilities.newBlob(bytes, String(type || 'application/octet-stream'), '[과제] ' + String(d.n || '').slice(0, 20) + ' - ' + clean));
  f.setDescription(d.uid);
  const sub = { k: key.k, h: d.h, sid: d.sid, n: d.n, t: d.t, fid: f.getId(), name: clean, size: bytes.length, type: String(type || ''), cm: String(cm || '').slice(0, 500), at: Date.now() };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { dataSheet_().appendRow([d.uid, 'hwsub', 's' + Utilities.getUuid().replace(/-/g, '').slice(0, 16), JSON.stringify(sub), Date.now(), '']); } finally { lock.releaseLock(); }
  return { ok: true, name: clean, size: bytes.length, at: sub.at };
}

function doGet(e) { try { return doGet_(e || { parameter: {} }); } catch (err) { return out_({ error: 'server', msg: String(err && err.message || err) }); } }
function doPost(e) { try { return doPost_(e || { postData: { contents: '{}' } }); } catch (err) { return out_({ error: 'server', msg: String(err && err.message || err) }); } }

function doGet_(e) {
  const p = e.parameter || {};
  if (p.a === 'cal') {   // 휴대폰 달력 구독 (열쇠가 맞을 때만, 로그인 없이)
    const uid = PropertiesService.getScriptProperties().getProperty('calk_' + String(p.k || '').replace(/[^\w]/g, ''));
    let txt = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//KAIA DESK//KO\r\nX-WR-CALNAME:KAIA DESK 알림\r\nEND:VCALENDAR';
    if (uid) { const it = tmpFolder_().getFilesByName('cal_' + uid + '.ics'); if (it.hasNext()) txt = it.next().getBlob().getDataAsString('UTF-8'); }
    return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.ICAL);
  }
  if (p.a === 'ping') return out_({ ok: true, app: 'kaia-desk', v: 10 });
  if (p.a === 'hwinfo') {   // 학생 과제 페이지: 과제 정보 · 과제 파일 목록 · 이미 낸 파일 (열쇠가 맞을 때만)
    const key = hwKey_(p.k); if (!key || !hwRate_(key.k)) return out_({ error: 'nokey' });
    const d = key.d;
    return out_({ ok: true, t: d.t, n: d.n, due: d.due, dt: d.dt, ds: d.ds || '', files: (d.files || []).map(f => ({ id: f.id, name: f.name, size: f.size })), subs: hwSubs_(key.k) });
  }
  if (p.a === 'hwget') {    // 학생이 과제 파일 받기 (그 과제에 붙인 파일만 · 3MB씩)
    const key = hwKey_(p.k); if (!key || !hwRate_(key.k)) return out_({ error: 'nokey' });
    const id = String(p.id || ''); if (!(key.d.files || []).some(f => f.id === id)) return out_({ error: 'nofile' });
    let f; try { f = DriveApp.getFileById(id); } catch (err) { return out_({ error: 'nofile' }); }
    const bytes = f.getBlob().getBytes();
    const off = Math.max(0, Number(p.off || 0)), len = Math.min(3 * 1024 * 1024, Math.max(1, Number(p.len || 3 * 1024 * 1024)));
    return out_({ name: f.getName(), type: f.getBlob().getContentType(), size: bytes.length, off: off, data: Utilities.base64Encode(bytes.slice(off, off + len)) });
  }
  const uid = auth_(p.token); if (!uid) return out_({ error: 'auth' });
  if (p.a === 'members') {
    const v = userSheet_().getDataRange().getValues().slice(1);
    const me = v.find(r => norm_(r[0]) === uid);
    const lead = !!(me && isLead_(me));
    return out_({ v: 9, members: v.map(r => ({ user: norm_(r[0]), name: String(r[1] || r[0]) })), email: me ? String(me[6] || '') : '',
      role: lead ? 'lead' : '', staff: lead ? staffOf_(uid, v).map(r => ({ user: norm_(r[0]), name: String(r[1] || r[0]) })) : [] });
  }
  if (p.a === 'staffQuotes') {   // 팀장 전용 · 팀원이 저장한 견적서 보기 (보기 전용 · 조회 기록 남김)
    const v = userSheet_().getDataRange().getValues().slice(1);
    const me = v.find(r => norm_(r[0]) === uid);
    if (!me || !isLead_(me)) return out_({ error: 'forbidden' });
    const allowed = staffOf_(uid, v).map(r => norm_(r[0]));
    const of = norm_(p.of);
    if (allowed.indexOf(of) < 0) return out_({ error: 'forbidden' });
    const quotes = [];
    dataSheet_().getDataRange().getValues().slice(1).forEach(r => {
      if (norm_(r[0]) !== of || r[1] !== 'quotes' || r[5]) return;
      let d = null; try { d = JSON.parse(r[3] || 'null'); } catch (err) {}
      if (d && d.q) quotes.push({ id: String(r[2]), q: d.q, at: d.at || 0 });
    });
    log_(uid, 'staffQuotes', of);
    return out_({ v: 9, quotes: quotes });
  }
  if (p.a === 'staffStudents') {   // 팀장 전용 · 보기 전용 · 서버에서 권한 확인
    const v = userSheet_().getDataRange().getValues().slice(1);
    const me = v.find(r => norm_(r[0]) === uid);
    if (!me || !isLead_(me)) return out_({ error: 'forbidden' });
    const allowed = staffOf_(uid, v).map(r => norm_(r[0]));
    const of = norm_(p.of);
    if (allowed.indexOf(of) < 0) return out_({ error: 'forbidden' });
    const keep = ['id', 'name', 'phone', 'status', 'courses', 'goal', 'kind', 'at'];   // 필요한 항목만
    const students = [];
    dataSheet_().getDataRange().getValues().slice(1).forEach(r => {
      if (norm_(r[0]) !== of || r[1] !== 'students' || r[5]) return;
      let d = null; try { d = JSON.parse(r[3] || 'null'); } catch (err) {}
      if (!d) return;
      const o = {}; keep.forEach(k => { if (d[k] !== undefined) o[k] = d[k]; });
      const logs = Array.isArray(d.logs) ? d.logs : [];
      o.lastLog = logs.reduce((m, l) => (l && l.d && l.d > m ? l.d : m), '');
      o.logCount = logs.length;
      students.push(o);
    });
    log_(uid, 'staffStudents', of);
    return out_({ of: of, name: nameOf_(of), students: students });
  }
  if (p.a === 'file') {
    let f; try { f = DriveApp.getFileById(String(p.id || '')); } catch (err) { return out_({ error: 'nofile' }); }
    if (!inFolder_(f)) return out_({ error: 'nofile' });
    const b = f.getBlob();
    const bytes = b.getBytes();
    if (p.len) {   // 큰 파일은 3MB씩 나눠서 내려받아요
      const off = Math.max(0, Number(p.off || 0)), len = Math.min(3 * 1024 * 1024, Math.max(1, Number(p.len)));
      return out_({ name: f.getName(), type: b.getContentType(), size: bytes.length, off: off, data: Utilities.base64Encode(bytes.slice(off, off + len)) });
    }
    return out_({ name: f.getName(), type: b.getContentType(), data: Utilities.base64Encode(bytes) });
  }
  const since = Number(p.since || 0);
  const docs = [];
  dataSheet_().getDataRange().getValues().slice(1).forEach(r => {
    const owner = String(r[0]);
    if (owner !== uid && owner !== TEAM_OWNER) return;
    if (!r[1] || Number(r[4]) <= since) return;
    docs.push({ col: r[1], id: String(r[2]), t: Number(r[4]), del: !!r[5], data: r[5] ? null : JSON.parse(r[3] || 'null') });
  });
  return out_({ now: Date.now(), user: uid, docs: docs });
}

function doPost_(e) {
  const b = JSON.parse(e.postData.contents || '{}');
  if (b.a === 'upload') {   // 게시판 첨부 파일 → 드라이브 폴더
    const uid = auth_(b.token); if (!uid) return out_({ error: 'auth' });
    const bytes = Utilities.base64Decode(String(b.data || ''));
    if (!bytes.length || bytes.length > MAX_FILE) return out_({ error: 'size' });
    const name = String(b.name || 'file').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
    const f = folder_().createFile(Utilities.newBlob(bytes, String(b.type || 'application/octet-stream'), name));
    f.setDescription(uid);
    return out_({ ok: true, id: f.getId(), name: name, size: bytes.length, type: String(b.type || '') });
  }
  if (b.a === 'upc') {      // 큰 첨부: 3MB씩 나눠 받아서 마지막 조각에서 하나로 합쳐요
    const uid = auth_(b.token); if (!uid) return out_({ error: 'auth' });
    const id = String(b.up || '').replace(/[^\w-]/g, '').slice(0, 40), i = Number(b.i), n = Number(b.n);
    if (!id || !(n > 0 && n <= 20) || !(i >= 0 && i < n)) return out_({ error: 'bad' });
    const tmp = tmpFolder_(), key = uid + '.' + id + '.';
    tmp.createFile(key + i, String(b.data || ''), 'text/plain');
    if (i < n - 1) return out_({ ok: true, part: i });
    const parts = []; let txt = '';
    for (let k = 0; k < n; k++) { const it = tmp.getFilesByName(key + k); if (!it.hasNext()) return out_({ error: 'missing', part: k }); const f = it.next(); parts.push(f); txt += f.getBlob().getDataAsString(); }
    parts.forEach(f => { try { f.setTrashed(true); } catch (err) {} });
    const bytes = Utilities.base64Decode(txt); txt = '';
    if (!bytes.length || bytes.length > MAX_FILE) return out_({ error: 'size' });
    const name = String(b.name || 'file').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
    const f = folder_().createFile(Utilities.newBlob(bytes, String(b.type || 'application/octet-stream'), name));
    f.setDescription(uid);
    return out_({ ok: true, id: f.getId(), name: name, size: bytes.length, type: String(b.type || '') });
  }
  if (b.a === 'hwreg') {    // 멘토: 학생마다 과제 열쇠 만들기 (과제 파일은 먼저 upload로 올려 두고 id만 넘겨요)
    const uid = auth_(b.token); if (!uid) return out_({ error: 'auth' });
    const items = (b.items || []).slice(0, 80); const keys = {};
    const files = (b.files || []).slice(0, 5).filter(x => { try { const f = DriveApp.getFileById(String(x.id)); return inFolder_(f) && f.getDescription() === uid; } catch (e) { return false; } })
      .map(x => ({ id: String(x.id), name: String(x.name || '').slice(0, 120), size: Number(x.size || 0) }));
    const clip = (v, m) => String(v == null ? '' : v).slice(0, m);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const s = dataSheet_();
      items.forEach(it => {
        const k = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
        const d = { uid: uid, h: clip(it.h, 40), sid: clip(it.sid, 40), n: clip(it.n, 40), t: clip(it.t, 120), due: clip(it.due, 10), dt: clip(it.dt, 5), ds: clip(it.ds, 1500), files: files, at: Date.now() };
        s.appendRow([HW_OWNER, 'hwkey', k, JSON.stringify(d), Date.now(), '']);
        keys[d.sid + '|' + d.h] = k;
      });
    } finally { lock.releaseLock(); }
    return out_({ ok: true, keys: keys, files: files });
  }
  if (b.a === 'hwup') {     // 학생: 3MB 이하 파일 한 번에 올리기 (로그인 없이 · 열쇠 필요)
    const key = hwKey_(b.k); if (!key || !hwRate_(key.k)) return out_({ error: 'nokey' });
    const bytes = Utilities.base64Decode(String(b.data || ''));
    if (!bytes.length || bytes.length > MAX_FILE) return out_({ error: 'size' });
    return out_(hwSave_(key, bytes, b.name, b.type, b.cm));
  }
  if (b.a === 'hwupc') {    // 학생: 큰 파일은 3MB씩 나눠서
    const key = hwKey_(b.k); if (!key || !hwRate_(key.k)) return out_({ error: 'nokey' });
    const id = String(b.up || '').replace(/[^\w-]/g, '').slice(0, 40), i = Number(b.i), n = Number(b.n);
    if (!id || !(n > 0 && n <= 10) || !(i >= 0 && i < n)) return out_({ error: 'bad' });
    const tmp = tmpFolder_(), pre = 'hw.' + key.k + '.' + id + '.';
    tmp.createFile(pre + i, String(b.data || ''), 'text/plain');
    if (i < n - 1) return out_({ ok: true, part: i });
    const parts = []; let txt = '';
    for (let q = 0; q < n; q++) { const it = tmp.getFilesByName(pre + q); if (!it.hasNext()) return out_({ error: 'missing', part: q }); const f = it.next(); parts.push(f); txt += f.getBlob().getDataAsString(); }
    parts.forEach(f => { try { f.setTrashed(true); } catch (err) {} });
    const bytes = Utilities.base64Decode(txt); txt = '';
    if (!bytes.length || bytes.length > MAX_FILE) return out_({ error: 'size' });
    return out_(hwSave_(key, bytes, b.name, b.type, b.cm));
  }
  if (b.a === 'calkey') {   // 휴대폰 달력 구독 링크용 열쇠 (본인만 · 새로 만들면 예전 링크는 끊겨요)
    const uid = auth_(b.token); if (!uid) return out_({ error: 'auth' });
    const P = PropertiesService.getScriptProperties(); let key = P.getProperty('calu_' + uid);
    if (!key || b.reset) { if (key) P.deleteProperty('calk_' + key); key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8); P.setProperty('calu_' + uid, key); P.setProperty('calk_' + key, uid); }
    return out_({ ok: true, key: key });
  }
  if (b.a === 'calput') {   // 앱이 만든 달력 일정(ics)을 저장 → 구독 링크로 내보냄
    const uid = auth_(b.token); if (!uid) return out_({ error: 'auth' });
    const txt = String(b.data || ''); if (!/^BEGIN:VCALENDAR/.test(txt) || txt.length > 2000000) return out_({ error: 'bad' });
    const name = 'cal_' + uid + '.ics'; const it = tmpFolder_().getFilesByName(name);
    if (it.hasNext()) it.next().setContent(txt); else tmpFolder_().createFile(name, txt, 'text/calendar');
    return out_({ ok: true });
  }
  if (b.a === 'unfile') {
    const uid = auth_(b.token); if (!uid) return out_({ error: 'auth' });
    try { const f = DriveApp.getFileById(String(b.id || '')); if (inFolder_(f) && f.getDescription() === uid) f.setTrashed(true); } catch (err) {}
    return out_({ ok: true });
  }
  if (b.a === 'email') {    // 배정 알림 받을 메일 주소 (본인만)
    const uid = auth_(b.token); if (!uid) return out_({ error: 'auth' });
    const em = String(b.email || '').trim().slice(0, 120);
    if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return out_({ error: 'email' });
    const u = findUser_(uid); u.s.getRange(u.row, 7).setValue(em);
    return out_({ ok: true, email: em });
  }
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (b.a === 'signup') {
      const user = norm_(b.user), pw = String(b.pw || ''), name = String(b.name || '').trim();
      if (String(b.team || '').trim() !== TEAM_CODE) return out_({ error: 'team' });
      if (!/^[a-z0-9._-]{3,30}$/.test(user)) return out_({ error: 'userfmt' });
      if (pw.length < 6) return out_({ error: 'pwshort' });
      if (findUser_(user)) return out_({ error: 'exists' });
      const salt = Utilities.getUuid();
      userSheet_().appendRow([user, name, salt, "'" + hash_(salt, pw), '[]', new Date()]); // ' = 시트가 수식으로 읽지 않게
      const u = findUser_(user);
      return out_({ ok: true, user: user, name: name, token: newToken_(u) });
    }
    if (b.a === 'login') {
      const user = norm_(b.user);
      if (tooMany_(user)) return out_({ error: 'locked' });
      const u = findUser_(user);
      if (!u || hash_(u.r[2], String(b.pw || '')) !== u.r[3]) { fail_(user); return out_({ error: 'login' }); }
      return out_({ ok: true, user: user, name: u.r[1], token: newToken_(u) });
    }
    if (b.a === 'submit') {   // 진단 · 테스트 페이지에서 보내는 결과 (로그인 없이)
      const c = CacheService.getScriptCache(); const n = Number(c.get('sub_rate') || 0);
      if (n > 60) return out_({ error: 'busy' }); c.put('sub_rate', String(n + 1), 60);
      const f = b.form || {}; const clip = (v, m) => String(v == null ? '' : v).slice(0, m);
      const data = { test: clip(f.test, 80), name: clip(f.name, 40), phone: clip(f.phone, 30), score: clip(f.score, 80),
        summary: clip(f.summary, 600), detail: clip(f.detail, 4000), url: clip(f.url, 600), at: Date.now(), done: false };
      if (!data.name && !data.phone && !data.score) return out_({ error: 'empty' });
      const id = 'r' + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
      dataSheet_().appendRow([TEAM_OWNER, 'inbox', id, JSON.stringify(data), Date.now(), '']);
      return out_({ ok: true });
    }
    if (b.a === 'logout') {
      const uid = auth_(b.token); if (!uid) return out_({ ok: true });
      const u = findUser_(uid); let list = []; try { list = JSON.parse(u.r[4] || '[]'); } catch (e) {}
      u.s.getRange(u.row, 5).setValue(JSON.stringify(list.filter(t => t !== b.token)));
      CacheService.getScriptCache().remove('t_' + b.token);
      return out_({ ok: true });
    }
    const uid = auth_(b.token); if (!uid) return out_({ error: 'auth' });
    const s = dataSheet_();
    const vals = s.getDataRange().getValues();
    const idx = {}; vals.forEach((r, i) => { if (i) idx[r[0] + '/' + r[1] + '/' + r[2]] = i + 1; });
    const now = Date.now();
    const mails = [];
    (b.writes || []).forEach(w => {
      const owner = (SHARED[w.col] || (w.col === 'meta' && w.id === 'team')) ? TEAM_OWNER : uid;
      const k = owner + '/' + w.col + '/' + w.id;
      // 게시판 · DB 배정: 글쓴이 / 보낸 사람 · 받은 사람만 고칠 수 있어요
      if (w.col === 'posts' || w.col === 'comments' || w.col === 'leads' || w.col === 'qshare') {
        let old = null; if (idx[k]) { try { old = JSON.parse(vals[idx[k] - 1][3] || 'null'); } catch (err) {} }
        if (w.col === 'qshare') {   // 견적서 보내기: 보낸 사람 · 받은 사람만 고칠 수 있어요 (메일은 안 보냄)
          if (old && old.from !== uid && old.to !== uid) return;
          if (!w.del && w.data && !old) w.data.from = uid;
        } else if (w.col === 'leads') {
          if (old && old.from !== uid && old.to !== uid) return;
          if (!w.del && w.data) { if (!old) w.data.from = uid; if (w.data.to && (!old || old.to !== w.data.to)) mails.push(w.data); }
        } else {
          if (old && old.by !== uid) return;
          if (!w.del && w.data && !old) w.data.by = uid;
        }
      }
      const row = [owner, w.col, String(w.id), w.del ? '' : JSON.stringify(w.data), now, w.del ? 1 : ''];
      if (idx[k]) s.getRange(idx[k], 1, 1, 6).setValues([row]);
      else { s.appendRow(row); idx[k] = s.getLastRow(); }
    });
    lock.releaseLock();
    mails.forEach(l => mailLead_(l, uid));
    return out_({ ok: true, now: now });
  } finally { try { lock.releaseLock(); } catch (err) {} }
}
