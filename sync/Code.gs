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
 * 비밀번호를 잊은 팀원: 시트의 kaia_users 탭에서 그 사람 줄을 지우면, 같은 아이디로 다시 가입할 수 있고 데이터는 그대로예요.
 */
const TEAM_CODE = '여기에-팀-가입코드를-넣으세요';

const DATA = 'kaia_data';
const USERS = 'kaia_users';
const TEAM_OWNER = '_team';
const SHARED = { courses: true, inbox: true, posts: true, comments: true, leads: true }; // 팀 공용 (meta/team 도 공용 · inbox 진단 수신함 · posts/comments 게시판 · leads DB 배정)
const MAX_FILE = 15 * 1024 * 1024;

function ss_() { return SpreadsheetApp.getActive(); }
function dataSheet_() {
  let s = ss_().getSheetByName(DATA);
  if (!s) { s = ss_().insertSheet(DATA); s.appendRow(['owner', 'col', 'id', 'json', 'updated', 'deleted']); s.setFrozenRows(1); }
  return s;
}
function userSheet_() {
  let s = ss_().getSheetByName(USERS);
  if (!s) { s = ss_().insertSheet(USERS); s.appendRow(['user', 'name', 'salt', 'hash', 'tokens', 'created', 'email']); s.setFrozenRows(1); }
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
function inFolder_(file) { const fid = folder_().getId(); const it = file.getParents(); while (it.hasNext()) if (it.next().getId() === fid) return true; return false; }
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

function doGet(e) {
  const p = e.parameter || {};
  if (p.a === 'ping') return out_({ ok: true, app: 'kaia-desk', v: 3 });
  const uid = auth_(p.token); if (!uid) return out_({ error: 'auth' });
  if (p.a === 'members') {
    const v = userSheet_().getDataRange().getValues().slice(1);
    const me = v.find(r => norm_(r[0]) === uid);
    return out_({ v: 3, members: v.map(r => ({ user: norm_(r[0]), name: String(r[1] || r[0]) })), email: me ? String(me[6] || '') : '' });
  }
  if (p.a === 'file') {
    let f; try { f = DriveApp.getFileById(String(p.id || '')); } catch (err) { return out_({ error: 'nofile' }); }
    if (!inFolder_(f)) return out_({ error: 'nofile' });
    const b = f.getBlob();
    return out_({ name: f.getName(), type: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) });
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

function doPost(e) {
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
      userSheet_().appendRow([user, name, salt, hash_(salt, pw), '[]', new Date()]);
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
      if (w.col === 'posts' || w.col === 'comments' || w.col === 'leads') {
        let old = null; if (idx[k]) { try { old = JSON.parse(vals[idx[k] - 1][3] || 'null'); } catch (err) {} }
        if (w.col === 'leads') {
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
