/* Island — 화면 맨 위 가운데 알약 (일상용)
   마우스를 올리면: 시계 · 음악 조작 · 바로가기(프로그램 · 게임 · 웹사이트) · 메모
   바로가기와 메모는 이 컴퓨터에만 저장돼요 (설정 파일: 사용자 폴더의 island.json).
   같은 폴더에 desk.json 이 있으면 그 안의 웹앱을 펼쳐 보는 버튼이 하나 더 생겨요. */
const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, shell, dialog, net } = require('electron');
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
let DESK = null; try { DESK = JSON.parse(fs.readFileSync(path.join(global.ISL.boot, 'desk.json'), 'utf8')); } catch (e) {}
const SH = require('./shell'), ISL = global.ISL;
let fsOn = false, userHide = false, upd = null;

const W = 520, H = 640, PILL = { w: 128, h: 34 };
let isl, desk, morph, tray, busy = false, dlg = false;
/* ---------- 지금 재생 중인 곡 (윈도우) ----------
   유튜브 · 유튜브 뮤직 · 스포티파이 · 멜론 등 무엇으로 틀든, 윈도우가 볼륨 팝업에 보여 주는 곡 정보(제목 · 가수 · 썸네일)를 읽어
   알약의 재생 버튼 옆에 보여 줘요. */
let NP = null;
function watchNowPlaying() {
  if (process.platform !== 'win32') return;
  const { spawn } = require('child_process'); let ps = null, stop = false;
  const start = () => { if (stop) return;
    try { ps = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'np.ps1')], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return; }
    let buf = '';
    ps.stdout.on('data', (d) => { buf += d; const L = buf.split(/\r?\n/); buf = L.pop(); const line = L.filter(x => x.trim()).pop(); if (!line) return;
      let v = null; try { v = JSON.parse(line); } catch (e) { return; }
      const k = JSON.stringify(v); if (k !== JSON.stringify(NP)) { NP = v; push(); } });
    ps.on('error', () => {}); ps.on('exit', () => { ps = null; if (!stop) setTimeout(start, 10000); });
  };
  start(); app.on('before-quit', () => { stop = true; try { ps && ps.kill(); } catch (e) {} });
}

if (!app.requestSingleInstanceLock()) { app.quit(); }

/* ---------- 저장 ---------- */
const FILE = () => path.join(app.getPath('userData'), 'island.json');
let DB = { apps: [], todos: [], tuck: true };
function load() { try { const d = JSON.parse(fs.readFileSync(FILE(), 'utf8')); DB = { apps: Array.isArray(d.apps) ? d.apps : [], todos: Array.isArray(d.todos) ? d.todos : [], tuck: d.tuck !== false }; } catch (e) {} }
function save() { try { fs.mkdirSync(path.dirname(FILE()), { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(DB)); } catch (e) {} }
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const state = () => ({ np: NP, y0: true, tuck: !!DB.tuck && !(desk && desk.isVisible()), apps: DB.apps, todos: DB.todos, web: !!DESK, title: DESK ? (DESK.title || '웹앱') : '', open: !!(desk && desk.isVisible()) });
function push() { if (isl) isl.webContents.send('state', state()); }

/* ---------- 창 ---------- */
const disp = () => screen.getPrimaryDisplay();
function islBounds() { const b = disp().bounds; return { x: Math.round(b.x + (b.width - W) / 2), y: b.y, width: W, height: H }; }
function pillRect() { const i = islBounds(); return { x: i.x + (W - PILL.w) / 2, y: i.y + 6, w: PILL.w, h: PILL.h, rad: 17 }; }
function deskRect() { const wa = disp().workArea, b = disp().bounds; const w = Math.min(1480, wa.width - 48), top = b.y + 50;
  return { x: Math.round(wa.x + (wa.width - w) / 2), y: top, w, h: wa.y + wa.height - top - 14, rad: 18 }; }
function place() { if (isl) isl.setBounds(islBounds()); if (morph) morph.setBounds(disp().bounds); if (desk && desk.isVisible()) { const d = deskRect(); desk.setBounds({ x: d.x, y: d.y, width: d.w, height: d.h }); } }
function makeIsland() {
  isl = new BrowserWindow({ ...islBounds(), frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true, alwaysOnTop: true,
    hasShadow: false, show: false, backgroundColor: '#00000000', webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false } });
  isl.setAlwaysOnTop(true, 'screen-saver'); isl.setVisibleOnAllWorkspaces(true);
  isl.setIgnoreMouseEvents(true, { forward: true });
  isl.loadFile(path.join(__dirname, 'island.html'));
  isl.once('ready-to-show', () => { place(); isl.showInactive(); push(); });
  isl.webContents.on('did-finish-load', () => push());
  ['display-metrics-changed', 'display-added', 'display-removed'].forEach(ev => screen.on(ev, place));
}
/* ---------- 웹앱 펼치기 (desk.json 이 있을 때만) ---------- */
function makeMorph() {
  morph = new BrowserWindow({ ...disp().bounds, frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true, alwaysOnTop: true, focusable: false,
    hasShadow: false, show: false, backgroundColor: '#00000000', webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false } });
  morph.setAlwaysOnTop(true, 'pop-up-menu'); morph.setIgnoreMouseEvents(true); morph.loadFile(path.join(__dirname, 'morph.html'));
}
function makeDesk() {
  const d = deskRect();
  desk = new BrowserWindow({ x: d.x, y: d.y, width: d.w, height: d.h, frame: false, transparent: true, hasShadow: false, show: false, icon: path.join(__dirname, 'icon.png'),
    title: DESK.title || '웹앱', backgroundColor: '#00000000', webPreferences: { backgroundThrottling: false } });
  /* 펼친 창 모서리를 둥글게: 창은 투명하게 두고 화면 전체를 둥근 모양으로 잘라요 */
  desk.webContents.on('dom-ready', () => desk.webContents.insertCSS('html{background:linear-gradient(transparent,transparent)!important}body{min-height:100vh;clip-path:inset(0 round 18px)!important}'));
  desk.loadURL(DESK.url);
  desk.on('close', (e) => { if (!app.isQuitting) { e.preventDefault(); collapse(); } });
  desk.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}
const rel = (r) => { const b = disp().bounds; return { x: r.x - b.x, y: r.y - b.y, w: r.w, h: r.h, rad: r.rad }; };
function runMorph(from, to, ms) { return new Promise(res => { morph.setBounds(disp().bounds); morph.showInactive(); ipcMain.once('morph-done', res); morph.webContents.send('morph', { from: rel(from), to: rel(to), ms }); }); }
async function expand() {
  if (!DESK || busy) return; if (!morph) { makeMorph(); await new Promise(r => morph.webContents.once('did-finish-load', r)); } if (!desk) makeDesk();
  if (desk.isVisible()) { desk.focus(); return; } busy = true;
  const d = deskRect(); desk.setBounds({ x: d.x, y: d.y, width: d.w, height: d.h });
  await runMorph(pillRect(), d, 380);
  desk.show(); desk.focus(); setTimeout(() => { morph.webContents.send('fade'); setTimeout(() => { morph.hide(); busy = false; }, 200); }, 60); push();
}
async function collapse() {
  if (busy || !desk || !desk.isVisible()) return; busy = true;
  const b = desk.getBounds(); const from = { x: b.x, y: b.y, w: b.width, h: b.height, rad: 18 };
  morph.setBounds(disp().bounds); morph.showInactive(); desk.hide();
  await runMorph(from, pillRect(), 340); morph.hide(); busy = false; push();
}
app.on('second-instance', () => { if (DESK) expand(); });

/* ---------- 음악 조작: 키보드의 재생 · 이전 · 다음 키를 대신 눌러 줘요 (윈도우) ---------- */
let ps = null;
function media(vk) {
  if (process.platform !== 'win32') return false;
  try {
    if (!ps || ps.exitCode !== null || ps.killed) {
      ps = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-NonInteractive', '-Command', '-'], { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
      ps.on('error', () => { ps = null; });
      ps.stdin.write("$k=Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern void keybd_event(byte b,byte s,uint f,System.UIntPtr e);' -Name IslKey -Namespace Isl -PassThru\n");
    }
    ps.stdin.write(`$k::keybd_event(${vk},0,1,[UIntPtr]::Zero);$k::keybd_event(${vk},0,3,[UIntPtr]::Zero)\n`); return true;
  } catch (e) { ps = null; return false; }
}
const VK = { prev: 177, play: 179, next: 176 };

/* ---------- 바로가기 ---------- */
async function iconOf(f) { try { if (!f || !fs.existsSync(f)) return '';
    if (/\.(ico|png|jpe?g|bmp)$/i.test(f)) { const im = nativeImage.createFromPath(f); if (!im.isEmpty()) return im.resize({ width: 64, height: 64, quality: 'best' }).toDataURL(); }
    const im = await app.getFileIcon(f, { size: 'large' }); return im.isEmpty() ? '' : im.toDataURL(); } catch (e) { return ''; } }
/* 게임 바로가기는 대부분 .url(스팀 · 에픽 등 인터넷 바로가기)이라 그대로 읽으면 지구본 아이콘이 나와요.
   .url 안에 적힌 IconFile(게임 아이콘 파일), .lnk 는 가리키는 실제 exe 의 아이콘을 꺼내 써요. */
async function fileIcon(p) {
  try {
    if (/\.url$/i.test(p)) { const t = fs.readFileSync(p, 'utf8'); const m = t.match(/^\s*IconFile\s*=\s*(.+?)\s*$/im); if (m) { const ic = await iconOf(m[1].replace(/^"|"$/g, '')); if (ic) return ic; } }
    if (/\.lnk$/i.test(p) && process.platform === 'win32') { try { const L = shell.readShortcutLink(p); for (const f of [L.icon, L.target]) { const ic = await iconOf(f); if (ic) return ic; } } catch (e) {} }
  } catch (e) {}
  return iconOf(p);
}
async function favicon(url) { try { const h = new URL(url).hostname; const r = await net.fetch('https://www.google.com/s2/favicons?sz=64&domain=' + encodeURIComponent(h)); if (!r.ok) return '';
  const buf = Buffer.from(await r.arrayBuffer()); return buf.length > 100 ? 'data:' + (r.headers.get('content-type') || 'image/png') + ';base64,' + buf.toString('base64') : ''; } catch (e) { return ''; } }
const isWeb = (s) => /^[a-z][a-z0-9+.-]*:\/\//i.test(s);

ipcMain.handle('act', async (_e, a) => {
  if (!a) return '';
  if (a.k === 'get') return state();
  if (a.k === 'quit') { app.isQuitting = true; setTimeout(() => app.quit(), 60); return ''; }
  if (a.k === 'open') { if (desk && desk.isVisible()) collapse(); else expand(); return ''; }
  if (a.k === 'media') return media(VK[a.b]) ? '' : '음악 조작은 윈도우에서만 돼요';
  if (a.k === 'run') { const x = DB.apps.find(o => o.id === a.id); if (!x) return '';
    if (x.url) { shell.openExternal(x.url); return x.name + ' 열었어요'; }
    if (!fs.existsSync(x.path)) return '파일을 찾지 못했어요 · 옮겨졌거나 지워졌는지 확인해 주세요';
    const err = await shell.openPath(x.path); return err ? '열지 못했어요 · 파일이 옮겨졌는지 확인해 주세요' : x.name + ' 실행했어요'; }
  if (a.k === 'addApp') { dlg = true; let r; try { r = await dialog.showOpenDialog(isl, { title: '바로가기에 넣을 프로그램 · 게임 고르기', defaultPath: app.getPath('desktop'), properties: ['openFile', 'multiSelections'],
      filters: [{ name: '프로그램 · 바로가기', extensions: ['exe', 'lnk', 'url', 'bat', 'cmd'] }, { name: '모든 파일', extensions: ['*'] }] }); } finally { dlg = false; if (isl) isl.setIgnoreMouseEvents(true, { forward: true }); }
    if (!r || r.canceled || !r.filePaths.length) return '';
    for (const p of r.filePaths.slice(0, 12)) { if (DB.apps.some(o => o.path === p)) continue; DB.apps.push({ id: rid(), icon2: 1, name: path.basename(p, path.extname(p)).slice(0, 24), path: p, icon: await fileIcon(p) }); }
    save(); push(); return '바로가기에 넣었어요'; }
  if (a.k === 'addUrl') { let u = String(a.url || '').trim(); if (!u) return '주소를 적어 주세요'; if (!isWeb(u)) u = 'https://' + u;
    let host = ''; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return '주소를 다시 확인해 주세요'; }
    DB.apps.push({ id: rid(), name: (String(a.name || '').trim() || host).slice(0, 24), url: u, icon: /^https?:/i.test(u) ? await favicon(u) : '' }); save(); push(); return '바로가기에 넣었어요'; }
  if (a.k === 'del') { DB.apps = DB.apps.filter(o => o.id !== a.id); save(); push(); return '바로가기에서 뺐어요'; }
  if (a.k === 'move') { const i = DB.apps.findIndex(o => o.id === a.id), j = i + (a.d < 0 ? -1 : 1); if (i < 0 || j < 0 || j >= DB.apps.length) return ''; [DB.apps[i], DB.apps[j]] = [DB.apps[j], DB.apps[i]]; save(); push(); return ''; }
  if (a.k === 'todoAdd') { const t = String(a.text || '').trim().slice(0, 120); if (!t) return ''; DB.todos.push({ id: rid(), text: t, done: false, at: Date.now() }); save(); push(); return '메모했어요'; }
  if (a.k === 'todo') { const x = DB.todos.find(o => o.id === a.id); if (x) { x.done = !x.done; save(); push(); } return ''; }
  if (a.k === 'todoClear') { DB.todos = DB.todos.filter(o => !o.done); save(); push(); return '끝낸 메모를 지웠어요'; }
  return '';
});
ipcMain.on('hover', (_e, on) => { if (dlg) return; if (isl) isl.setIgnoreMouseEvents(!on, { forward: true }); if (!on && isl && isl.isFocused() && !(desk && desk.isVisible())) isl.blur(); });

function vis() { if (!isl) return; const want = !userHide && !(fsOn && !DB.tuck); if (want) { if (!isl.isVisible()) isl.showInactive(); } else if (isl.isVisible()) isl.hide(); }
function common() {
  watchNowPlaying();
  SH.watchCursor(() => isl);
  SH.watchFullscreen((on) => { fsOn = on; vis(); });   /* 알약 형태일 때만: 게임 · 영상이 전체화면이면 알약을 숨겨요 */
  upd = SH.autoUpdate({ canRestart: () => !(desk && desk.isVisible()) });
}
function makeTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 }));
  const menu = () => Menu.buildFromTemplate([
    ...(DESK ? [{ label: (DESK.title || '웹앱') + ' 펼치기', click: () => expand() }] : []),
    { label: '자동 숨김 (끄면 알약이 항상 보이고, 눌러야 펼쳐져요)', type: 'checkbox', checked: !!DB.tuck, click: (m) => { DB.tuck = m.checked; save(); push(); vis(); } },
    { label: '아일랜드 보이기', type: 'checkbox', checked: !userHide, click: (m) => { userHide = !m.checked; vis(); } },
    { label: upd && upd.ready() ? '새 버전 적용 (다시 시작)' : '프로그램 버전 ' + ISL.ver + ' · 업데이트 확인', click: () => { if (upd && upd.ready()) { app.isQuitting = true; app.relaunch(); app.quit(); } else if (upd) upd.check(); } },
    { label: '윈도우 시작할 때 자동 실행', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (m) => app.setLoginItemSettings({ openAtLogin: m.checked }) },
    { type: 'separator' }, { label: '종료', click: () => { app.isQuitting = true; app.quit(); } }]);
  tray.setToolTip('Island'); tray.setContextMenu(menu()); tray.on('right-click', () => tray.setContextMenu(menu()));
}
app.whenReady().then(() => { app.setAppUserModelId('app.island.life'); load(); makeIsland(); makeTray(); common();
  setTimeout(async () => { let ch = false; for (const x of DB.apps) { if (!x.path || !/\.(url|lnk)$/i.test(x.path) || x.icon2) continue; const ic = await fileIcon(x.path); if (ic) { x.icon = ic; ch = true; } x.icon2 = 1; } if (ch) { save(); push(); } }, 1500); });
app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => { try { ps && ps.kill(); } catch (e) {} });
