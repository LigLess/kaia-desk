/* 두 버전(업무용 · 일상용)이 같이 쓰는 부분: 마우스 위치 알려 주기 · 전체화면 감지 · 자동 업데이트 */
const { app, screen, net } = require('electron');
const path = require('path'), fs = require('fs'), crypto = require('crypto'), { spawn } = require('child_process');
const ISL = global.ISL;

/* 1) 마우스 위치: 0.05초마다 화면에서 마우스가 어디 있는지 보고, 알약 창 근처일 때만 알약 화면에 알려 줘요.
      (알약 창은 클릭이 통과하는 투명 창이라, 창이 직접 마우스를 느끼는 방식은 컴퓨터마다 달라서 이렇게 해요) */
function watchCursor(getWin) {
  let lx = null, ly = null, wasNear = false;
  setInterval(() => { const w = getWin(); if (!w || w.isDestroyed() || !w.isVisible()) return;
    const p = global.ISL_TESTCUR || screen.getCursorScreenPoint(), b = w.getBounds(), x = p.x - b.x, y = p.y - b.y;
    if (x === lx && y === ly) return; lx = x; ly = y;
    const near = x >= -60 && x <= b.width + 60 && y >= -10 && y <= b.height + 60;
    if (!near && !wasNear) return; wasNear = near;
    w.webContents.send('cur', { x, y });
  }, 50);
}

/* 2) 전체화면 감지 (윈도우): 맨 앞 창이 화면 전체를 덮고 있으면(게임 · 영상 전체화면) true.
      바탕화면 · 작업표시줄은 빼요. 최대화한 일반 창은 작업표시줄만큼 작아서 전체화면이 아니에요. */
function watchFullscreen(cb) {
  if (process.platform !== 'win32') return;
  let ps = null, last = null, stopped = false;
  const start = () => { if (stopped) return;
    try { ps = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'fs.ps1')], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch (e) { return; }
    let buf = '';
    ps.stdout.on('data', (d) => { buf += d; const L = buf.split(/\r?\n/); buf = L.pop(); const v = L.filter(s => s === '0' || s === '1').pop(); if (v == null) return; const on = v === '1'; if (on !== last) { last = on; try { cb(on); } catch (e) {} } });
    ps.on('error', () => {}); ps.on('exit', () => { ps = null; if (!stopped) setTimeout(start, 15000); });
  };
  start(); app.on('before-quit', () => { stopped = true; try { ps && ps.kill(); } catch (e) {} });
}

/* 3) 자동 업데이트: feed 주소의 version.json 을 보고, 더 높은 버전이면 파일을 받아 사용자 폴더에 두어요.
      받은 파일은 적힌 지문(sha256)과 맞는지 확인하고, 전부 맞을 때만 다음 실행에 써요. */
const FEEDF = () => path.join(ISL.ud, 'feed.json');
async function checkUpdate() {
  const feed = ((ISL.rj(FEEDF()) || {}).feed) || ISL.variant.feed; if (!feed) return false;
  const get = async (name) => { const r = await net.fetch(feed + name + (name.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error(name + ' ' + r.status); return Buffer.from(await r.arrayBuffer()); };
  const m = JSON.parse((await get('version.json')).toString('utf8'));
  if (m.feed && /^https:\/\//.test(m.feed) && m.feed !== feed) ISL.wj(FEEDF(), { feed: m.feed });
  const have = Math.max(ISL.ver, ((ISL.rj(ISL.cur) || {}).v | 0));
  if (!(m.v > have) || !m.files) return false;
  const tmp = path.join(ISL.ud, 'v' + m.v + '.tmp'), dst = path.join(ISL.ud, 'v' + m.v);
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  for (const [name, sha] of Object.entries(m.files)) {
    if (!/^[\w][\w.-]*$/.test(name)) throw new Error('bad name');
    const buf = await get(name + '?v=' + m.v);
    if (crypto.createHash('sha256').update(buf).digest('hex') !== sha) throw new Error('hash ' + name);
    fs.writeFileSync(path.join(tmp, name), buf);
  }
  fs.writeFileSync(path.join(tmp, 'version.json'), JSON.stringify({ v: m.v }));
  fs.rmSync(dst, { recursive: true, force: true }); fs.renameSync(tmp, dst);
  ISL.wj(ISL.cur, { v: m.v }); return m.v;
}
/* 켠 직후(4초 뒤) 한 번, 그 뒤로 3시간마다 확인. 켠 지 1분 안에 받았고 방해가 안 되는 상태면 바로 다시 시작해서 적용해요. */
function autoUpdate({ canRestart, onReady }) {
  const t0 = Date.now(); let got = 0;
  const run = async () => { if (got) return; try { const v = await checkUpdate(); if (!v) return; got = v;
      if (Date.now() - t0 < 60000 && (!canRestart || canRestart())) { app.isQuitting = true; app.relaunch(); app.quit(); } else if (onReady) onReady(v); } catch (e) {} };
  setTimeout(run, 4000); setInterval(run, 3 * 3600e3);
  setTimeout(() => ISL.ok(), 8000); app.on('before-quit', () => ISL.ok());
  return { check: run, ready: () => got };
}
module.exports = { watchCursor, watchFullscreen, autoUpdate, checkUpdate };
