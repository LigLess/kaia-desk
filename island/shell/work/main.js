/* KAIA Island — 화면 맨 위 가운데 알약
   - 마우스를 올리면: 시계 · 오늘 할 일(바로 완료) · 빠른 메모 → 업무 · 방문 예약 링크 복사
   - 알림이 오면 펼쳐지고, DB 유입 · 방문 예약은 알약에서 바로 "확인" · 연락처 복사
   - 알약을 누르면 알약이 그대로 커지면서 KAIA DESK가 펼쳐지고, 다시 누르면 알약으로 접혀요.
   KAIA DESK 웹앱을 안쪽 창으로 품고 있어서(로그인 한 번이면 기억) 앱 기능을 그대로 써요. */
const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, shell, clipboard } = require('electron');
const path = require('path'), fs = require('fs');
const URL_DESK = 'https://ligless.github.io/kaia-desk/';
const SH = require('./shell'), ISL = global.ISL;
const SHELL_VER = ISL.ver;
let fsOn = false, userHide = false, upd = null;
  /* 알약 화면 · 기능은 웹(KAIA DESK)에서 받아요. 이 숫자는 프로그램 자체를 바꿀 때만 올려요 */
const W = 520, H = 600, PILL = { w: 128, h: 34 };
let isl, desk, morph, tray, busy = false;

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => expand());

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
  let fellBack = false;
  isl.webContents.on('did-fail-load', (_e, code, _d, url, main) => { if (main && !fellBack) { fellBack = true; isl.loadFile(path.join(__dirname, 'island.html')); } });
  isl.loadURL(URL_DESK + 'island/?shell=' + SHELL_VER + '&t=' + Math.floor(Date.now() / 6e5));
  isl.once('ready-to-show', () => { place(); isl.showInactive(); });
  isl.webContents.on('did-finish-load', () => push());
  ['display-metrics-changed', 'display-added', 'display-removed'].forEach(ev => screen.on(ev, place));
}
function makeMorph() {
  morph = new BrowserWindow({ ...disp().bounds, frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true, alwaysOnTop: true, focusable: false,
    hasShadow: false, show: false, backgroundColor: '#00000000', webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false } });
  morph.setAlwaysOnTop(true, 'pop-up-menu'); morph.setIgnoreMouseEvents(true); morph.loadFile(path.join(__dirname, 'morph.html'));
}
function makeDesk() {
  const d = deskRect();
  desk = new BrowserWindow({ x: d.x, y: d.y, width: d.w, height: d.h, frame: false, transparent: true, hasShadow: false, show: false, skipTaskbar: false, icon: path.join(__dirname, 'icon.png'),
    title: 'KAIA DESK', backgroundColor: '#00000000', webPreferences: { backgroundThrottling: false } });
  /* 펼친 창 모서리를 둥글게: 창은 투명하게 두고 화면 전체를 둥근 모양으로 잘라요 */
  desk.webContents.on('dom-ready', () => desk.webContents.insertCSS('html{background:linear-gradient(transparent,transparent)!important}body{min-height:100vh;clip-path:inset(0 round 18px)!important}'));
  desk.loadURL(URL_DESK);
  desk.on('close', (e) => { if (!app.isQuitting) { e.preventDefault(); collapse(); } });
  desk.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  desk.webContents.on('before-input-event', (_e, inp) => { if (inp.type === 'keyDown' && inp.key === 'F11') collapse(); });
}
const rel = (r) => { const b = disp().bounds; return { x: r.x - b.x, y: r.y - b.y, w: r.w, h: r.h, rad: r.rad }; };
function runMorph(from, to, ms) { return new Promise(res => { morph.setBounds(disp().bounds); morph.showInactive(); ipcMain.once('morph-done', res); morph.webContents.send('morph', { from: rel(from), to: rel(to), ms }); }); }
/* 알약 → KAIA DESK로 커지기 */
async function expand(where) {
  if (busy || !desk) return; if (desk.isVisible()) { desk.focus(); go(where); return; } busy = true;
  const d = deskRect(); desk.setBounds({ x: d.x, y: d.y, width: d.w, height: d.h }); go(where);
  await runMorph(pillRect(), d, 380);
  desk.show(); desk.focus(); setTimeout(() => { morph.webContents.send('fade'); setTimeout(() => { morph.hide(); busy = false; }, 200); }, 60);
  state.open = true; push();
}
/* KAIA DESK → 알약으로 접히기 */
async function collapse() {
  if (busy || !desk || !desk.isVisible()) return; busy = true;
  const b = desk.getBounds(); const from = { x: b.x, y: b.y, w: b.width, h: b.height, rad: 18 };
  morph.setBounds(disp().bounds); morph.showInactive(); desk.hide();
  await runMorph(from, pillRect(), 340); morph.hide(); busy = false; state.open = false; push();
}
function go(where) { if (!where) return; desk.webContents.executeJavaScript(`try{ if(window.islandAct){ islandAct({k:'go',where:${JSON.stringify(where)}}); } else {  ${where === 'team-visit' ? "S.teamTab='visit';go('team')" : where === 'team-inflow' ? "S.teamTab='inflow';go('team')" : "go(" + JSON.stringify(where) + ")"} } }catch(e){}`).catch(() => {}); }

/* KAIA DESK 화면에서 필요한 것만 읽어 와요 (알림도 살짝 엿들어서 알약으로) */
const PROBE = `(()=>{ try{ if(typeof S==='undefined'||!S.real) return {ready:false};
  if(!window.__isl&&typeof window.alertShow==='function'){ window.__isl={q:[]}; const o=window.alertShow; window.alertShow=function(a){ try{ __isl.q.push({t:String(a&&a.title||''),b:String(a&&(a.body||a.nbody)||''),go:a&&a.go||'',tab:a&&a.tab||'',tag:a&&a.tag||''}); }catch(e){} return o.apply(this,arguments); }; }
  const t=todayStr(), now=new Date(), hm=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  const all=Object.values(S.real.tasks||{}).filter(x=>x&&x.due&&x.due<=t&&(!x.done||(x.doneAt&&Date.now()-x.doneAt<6e5)));
  const tasks=all.sort((a,b)=>(a.done-b.done)||String(a.due).localeCompare(b.due)||String(a.time||'99').localeCompare(String(b.time||'99')));
  const open=tasks.filter(x=>!x.done&&x.due===t); const next=open.find(x=>x.time&&x.time>=hm)||open.find(x=>!x.time)||null;
  return {ready:true, team:S.mode==='gas', today:open.length,
    next: next?{text:String(next.text||'').slice(0,60),time:next.time||''}:null,
    list: tasks.slice(0,4).map(x=>({id:x.id,text:String(x.text||'').slice(0,70),time:x.time||'',done:!!x.done,late:x.due<t})),
    courses: Object.values(D().courses||{}).filter(c=>c&&c.start&&c.start>=addDays(t,-3)&&c.start<=addDays(t,21)).sort((a,b)=>a.start.localeCompare(b.start)).slice(0,6)
      .map(c=>{ const d=parseYmd(c.start); return {id:c.id,name:String(c.name||'').slice(0,40),when:(d.getMonth()+1)+'/'+d.getDate()+'('+DOW[d.getDay()]+') 개강'}; }),
    inflow: typeof inflowNew==='function'?inflowNew():0, visit: typeof vbNew==='function'?vbNew():0,
    q: window.__isl? __isl.q.splice(0):[] };
}catch(e){ return {ready:false,err:String(e)}; } })()`;
const state = { open: false }; let last = {};
/* 자동 숨김 설정은 이 컴퓨터에만 저장 (사용자 폴더의 shell.json) */
const CFGF = () => path.join(app.getPath('userData'), 'shell.json'); let CFG = { tuck: true };
function cfgLoad() { try { CFG = { tuck: true, ...JSON.parse(fs.readFileSync(CFGF(), 'utf8')) }; } catch (e) {} }
function cfgSave() { try { fs.writeFileSync(CFGF(), JSON.stringify(CFG)); } catch (e) {} }
function push() { if (isl) isl.webContents.send('state', { ...last, open: state.open, y0: true, tuck: !!CFG.tuck && !state.open }); }
async function tick() { if (!desk || !isl) return; try { last = (await desk.webContents.executeJavaScript('window.islandProbe?islandProbe():' + PROBE, true)) || {}; push(); last.q = []; } catch (e) {} }
const js = (code) => desk.webContents.executeJavaScript(code, true).catch(() => null);
/* 알약에서 누른 기능 실행 */
ipcMain.handle('act', async (_e, a) => {
  if (!a) return '';
  if (a.k === 'quit') { app.isQuitting = true; setTimeout(() => app.quit(), 60); return ''; }
  if (a.k === 'reload') { reloadAll(); return '새로 불러왔어요'; }
  if (!['copy', 'open'].includes(a.k)) {
    const r = await js(`window.islandAct?islandAct(${JSON.stringify(a)}):null`);
    if (r) { if (r.copy) clipboard.writeText(String(r.copy)); tick(); return r.msg || ''; }
  }
  /* 아래는 웹에 islandAct가 없을 때(예전 KAIA DESK)만 쓰는 예비 동작 */
  if (a.k === 'done') { await js(`(()=>{ const k=S.real.tasks[${JSON.stringify(a.id)}]; if(k){ store.put('tasks',{...k,done:${!!a.on},doneAt:${a.on ? 'Date.now()' : 'null'}}); render(); } })()`); tick(); return a.on ? '완료했어요' : '되돌렸어요'; }
  if (a.k === 'add') { const r = await js(`(()=>{ const q=${JSON.stringify(String(a.text || '').slice(0, 200))}; const tk=(typeof parseTaskCmd==='function'&&parseTaskCmd('할 일 '+q))||{text:q,due:todayStr(),time:'',cat:'기타'};
      store.put('tasks',{id:uid('t'),...tk,done:false,at:Date.now()}); render(); return (tk.time?tk.time+' ':'')+tk.text; })()`); tick(); return r ? '업무에 넣었어요 · ' + r : '넣지 못했어요'; }
  if (a.k === 'book') { const m = await js(`(async()=>{ try{ S._vsMode='pick'; vsOpen(''); S._vs.mode='pick'; await vsMake(); const t=VS.url?vsMsg():''; closeModal(); return t; }catch(e){ try{closeModal()}catch(_){} return ''; } })()`);
    if (m) { clipboard.writeText(m); return '방문 예약 안내를 복사했어요'; } return '팀 서버 로그인이 필요해요'; }
  if (a.k === 'notice') { const m = await js(`(async()=>{ try{ const c=D().courses[${JSON.stringify(a.id)}]; if(!c) return '';
      NL.cid=c.id; NL.links={}; NL.short=false; await nlPrepare(); if(typeof nlShorten==='function') await nlShorten(); return nlMsg(c,null,NL.links._)+'\u0001'+c.name; }catch(e){ return ''; } })()`);
    if (m) { const [msg, name] = m.split('\u0001'); clipboard.writeText(msg); return '개강안내를 복사했어요 · ' + name; } return '만들지 못했어요 · KAIA DESK를 펼쳐서 확인해 주세요'; }
  if (a.k === 'ok') { const col = a.type === 'if' ? 'inflow' : 'visitbk'; await js(`(()=>{ const x=(teamData().${col}||{})[${JSON.stringify(a.id)}]; if(!x) return; const m=me(); teamPut('${col}',{...x,ok:{by:m.user,name:m.name,at:Date.now()}}); render(); })()`); tick(); return '확인했어요'; }
  if (a.k === 'copy') { clipboard.writeText(String(a.text || '')); return '복사했어요'; }
  if (a.k === 'open') { if (desk.isVisible() && !a.where) collapse(); else expand(a.where); return ''; }
  return '';
});
ipcMain.on('hover', (_e, on) => { if (isl) isl.setIgnoreMouseEvents(!on, { forward: true }); if (!on && isl && isl.isFocused() && desk && !desk.isVisible()) isl.blur(); });

function vis() { if (!isl) return; const want = !userHide && !(fsOn && !CFG.tuck); if (want) { if (!isl.isVisible()) isl.showInactive(); } else if (isl.isVisible()) isl.hide(); }
function common() {
  SH.watchCursor(() => isl);
  SH.watchFullscreen((on) => { fsOn = on; vis(); });   /* 알약 형태일 때만: 게임 · 영상이 전체화면이면 알약을 숨겨요 */
  upd = SH.autoUpdate({ canRestart: () => !(desk && desk.isVisible()) });
}
function reloadAll() { if (desk) desk.webContents.reloadIgnoringCache(); if (isl) isl.webContents.reloadIgnoringCache(); }
function makeTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 }));
  const menu = () => Menu.buildFromTemplate([
    { label: 'KAIA DESK 펼치기', click: () => expand() },
    { label: '새로 불러오기', click: () => reloadAll() },
    { label: upd && upd.ready() ? '새 버전 적용 (다시 시작)' : '프로그램 버전 ' + ISL.ver + ' · 업데이트 확인', click: () => { if (upd && upd.ready()) { app.isQuitting = true; app.relaunch(); app.quit(); } else if (upd) upd.check(); } },
    { label: '자동 숨김 (끄면 알약이 항상 보이고, 눌러야 펼쳐져요)', type: 'checkbox', checked: !!CFG.tuck, click: (m) => { CFG.tuck = m.checked; cfgSave(); push(); vis(); } },
    { label: '아일랜드 보이기', type: 'checkbox', checked: !userHide, click: (m) => { userHide = !m.checked; vis(); } },
    { label: '윈도우 시작할 때 자동 실행', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (m) => app.setLoginItemSettings({ openAtLogin: m.checked }) },
    { type: 'separator' }, { label: '종료', click: () => { app.isQuitting = true; app.quit(); } } ]);
  tray.setToolTip('KAIA Island'); tray.setContextMenu(menu()); tray.on('click', () => expand()); tray.on('right-click', () => tray.setContextMenu(menu()));
}
app.whenReady().then(() => {
  app.setAppUserModelId('kr.kaia.island');
  cfgLoad();
  makeDesk(); makeMorph(); makeIsland(); makeTray(); common();
  setInterval(tick, 3000); setTimeout(tick, 2500);
  setInterval(() => { if (isl && !isl.webContents.isLoading()) isl.webContents.reloadIgnoringCache(); }, 6 * 3600e3);
  /* 처음 실행이라 로그인이 안 돼 있으면 KAIA DESK를 펼쳐서 로그인하게 해요 */
  desk.webContents.once('did-finish-load', () => setTimeout(async () => { const s = await js(PROBE); if (!s || !s.team) expand(); }, 3000));
});
app.on('window-all-closed', (e) => e.preventDefault());
