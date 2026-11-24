import { Soundscape } from './engine/audio.js';
import { archiveById, archivesOf, chapterOf } from './game/lore.js';
import { DEV_SPOTS } from './game/layout.js';

const $ = (id) => document.getElementById(id);
// One save slot per chapter. Chapter one keeps the original key so old saves still load.
const SAVE_KEYS = { 1: 'concrete.v2.save', 2: 'concrete.v2.save.ch2' },
  PROGRESS_KEY = 'concrete.progress',
  SETTINGS_KEY = 'concrete.settings';
const CHAPTERS = {
  1: {
    code: 'CH. 01',
    synopsis: '穿过沉默的泄洪廊，恢复动力，<br />攀上一百三十米高的混凝土之心，把它重新唤醒。',
    loading: '正在进入值班室',
  },
  2: {
    code: 'CH. 02',
    synopsis: '入夜，暴雨压在上游水库上。<br />沿北坝栈桥，赶在洪水漫顶之前打开三孔泄洪闸。',
    loading: '正在进入第二章 · 汛期',
  },
};
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing still plays in memory. */
  }
};
const escape = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const defaults = {
  volume: 0.65,
  muted: false,
  sensitivity: 1,
  quality: 'balanced',
  marker: true,
  invertY: false,
  dev: false,
  devSpeed: 1,
  devFly: true,
  devNoclip: false,
};
const settings = { ...defaults, ...read(SETTINGS_KEY, {}) };
if (!['low', 'balanced', 'high'].includes(settings.quality)) settings.quality = 'balanced';
const slot = (data, chapter) => (data?.v === 2 && (data.chapter ?? 1) === chapter ? data : null);
const saves = { 1: slot(read(SAVE_KEYS[1], null), 1), 2: slot(read(SAVE_KEYS[2], null), 2) };
// Cleared chapters live apart from the saves, so restarting chapter one never relocks chapter two.
const progress = { chapter: 1, ...read(PROGRESS_KEY, {}) };
if (!Array.isArray(progress.cleared)) progress.cleared = [];
const unlocked = (ch) => ch === 1 || progress.cleared.includes(ch - 1);
let selected = unlocked(progress.chapter) ? progress.chapter : 1;
let game = null,
  journalOrigin = '',
  starting = false,
  panel = '',
  returnTo = '',
  lastFocus = null;
const sound = new Soundscape();
const touch = () => $('app').classList.contains('touch');

function syncSettings() {
  write(SETTINGS_KEY, { ...settings, pointerLock: undefined });
  sound.set(settings.volume, settings.muted);
  $('audio-button').querySelector('use').setAttribute('href', settings.muted ? '#icon-mute' : '#icon-sound');
  $('audio-button').setAttribute('aria-pressed', String(!settings.muted));
  $('audio-button').title = settings.muted ? '开启声音' : '关闭声音';
}
function setSave(chapter, data) {
  saves[chapter] = data;
  write(SAVE_KEYS[chapter], data);
  refreshTitle();
}
function refreshTitle() {
  const save = saves[selected];
  $('start-label').textContent = save ? '继续巡检' : '开始巡检';
  $('new-run').hidden = !save;
  const found = (save?.site?.archives || []).filter((id) => chapterOf(id) === selected).length;
  $('save-note').textContent = save ? `${CHAPTERS[selected].code} · 档案 ${found}/${archivesOf(selected).length}` : '';
  $('synopsis').innerHTML = CHAPTERS[selected].synopsis;
  $('title-screen').classList.toggle('ch2', selected === 2);
  for (const el of $('chapter-pick').querySelectorAll('button')) {
    const ch = Number(el.dataset.ch);
    el.disabled = !unlocked(ch);
    el.setAttribute('aria-pressed', String(ch === selected));
  }
}
function selectChapter(ch) {
  if (!unlocked(ch)) return;
  selected = progress.chapter = ch;
  write(PROGRESS_KEY, progress);
  refreshTitle();
}
refreshTitle();
syncSettings();
if (matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 1) $('app').classList.add('touch');
settings.pointerLock = !touch();
addEventListener(
  'pointerdown',
  (e) => {
    if (e.pointerType === 'touch') {
      $('app').classList.add('touch');
      settings.pointerLock = false;
    }
  },
  { passive: true }
);

$('audio-button').onclick = () => {
  settings.muted = !settings.muted;
  syncSettings();
  if (!settings.muted) sound.start();
};
$('full-button').onclick = async () => {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement)
      await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else if (document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen();
    else show('display');
  } catch {
    show('display');
  }
};

function hideDialog() {
  $('veil').hidden = true;
  $('veil').className = '';
  panel = '';
  returnTo = '';
  if (lastFocus?.isConnected && lastFocus.getClientRects().length) lastFocus.focus({ preventScroll: true });
}
function dialogBase(kind, code, title, content, style = '') {
  if (!$('veil').hidden && panel !== kind) lastFocus = null;
  else if ($('veil').hidden) lastFocus = document.activeElement;
  $('veil').className = style;
  panel = kind;
  $('dialog-type').textContent = code;
  $('dialog-title').textContent = title;
  $('dialog-content').innerHTML = content;
  $('veil').hidden = false;
  $('close').hidden = false;
  $('modal').scrollTop = 0;
  $('close').focus({ preventScroll: true });
}
const button = (id, label, primary = false) => `<button id="${id}" class="${primary ? 'primary' : ''}">${label}</button>`;
const row = (label, key) => `<div class="guide-row"><span>${label}</span><kbd>${key}</kbd></div>`;
const clock = (seconds) => {
  const m = Math.floor(seconds / 60),
    s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ' : ' + String(s).padStart(2, '0');
};

function show(kind, origin = '', arg) {
  returnTo = origin;
  if (kind === 'guide') {
    const controls = touch()
      ? [
          ['移动', '左侧摇杆'],
          ['环视', '拖动画面'],
          ['奔跑', '奔跑键'],
          ['跳跃', '跳跃键'],
          ['交互', '轻触提示'],
          ['暂停', '右上角 Ⅱ'],
        ]
      : [
          ['移动', 'W A S D'],
          ['后退（面朝前方）', 'S'],
          ['环视', '鼠标 / 方向键'],
          ['自由视角（不改行走方向）', '按住 Option / Alt'],
          ['奔跑', 'Shift'],
          ['跳跃', '空格'],
          ['交互', 'E'],
          ['头灯（第二章）', 'L'],
          ['巡检档案', 'J'],
          ['暂停', 'Esc'],
        ];
    dialogBase(
      kind,
      'FIELD MANUAL',
      '操作指南',
      controls.map(([a, b]) => row(a, b)).join('') +
        '<p class="dialog-note">单击画面锁定鼠标视角，按 Esc 释放。旁通阀用 A / D 调节开度；轨车按住 W 牵引、S 制动。支持手柄：左摇杆移动，右摇杆环视，A 跳跃，X 交互，Y 头灯。</p>'
    );
  } else if (kind === 'settings') {
    dialogBase(
      kind,
      'SYSTEM CONFIG',
      '系统设置',
      '<div class="setting-row"><label for="volume">音量</label><input id="volume" type="range" min="0" max="100" step="1"><output id="volume-value"></output></div>' +
        '<div class="setting-row"><label for="sensitivity">环视灵敏度</label><input id="sensitivity" type="range" min="40" max="200" step="5"><output id="sense-value"></output></div>' +
        '<div class="setting-row"><label for="invert">反转垂直视角</label><input id="invert" type="checkbox"></div>' +
        '<div class="setting-row"><label for="graphics">画面质量</label><select id="graphics"><option value="low">流畅</option><option value="balanced">均衡</option><option value="high">精细</option></select></div>' +
        '<div class="setting-row"><label for="marker-setting">目标方位标记</label><input id="marker-setting" type="checkbox"></div>' +
        '<div class="setting-row dev-switch"><label for="dev">开发者模式</label><input id="dev" type="checkbox"></div>' +
        '<div id="dev-rows">' +
        '<div class="setting-row"><label for="dev-speed">移动速度</label><input id="dev-speed" type="range" min="50" max="800" step="25"><output id="dev-speed-value"></output></div>' +
        '<div class="setting-row"><label for="dev-fly">双击空格飞行</label><input id="dev-fly" type="checkbox"></div>' +
        '<div class="setting-row"><label for="dev-noclip">飞行时穿墙</label><input id="dev-noclip" type="checkbox"></div>' +
        (game
          ? '<div class="setting-row"><label for="dev-teleport">传送</label><select id="dev-teleport"><option value="">选择位置…</option>' +
            Object.entries(DEV_SPOTS)
              .map(([k, v]) => `<option value="${k}">${v[0]}</option>`)
              .join('') +
            '</select></div>'
          : '') +
        '<p class="dialog-note">飞行：双击空格起飞，按住空格上升、Shift 下降，再双击空格或落地即结束。开发者模式下从高处坠落不会重置位置，右上角显示坐标与帧率。</p>' +
        '</div>'
    );
    const devRows = () => ($('dev-rows').hidden = !settings.dev);
    $('dev').checked = settings.dev;
    devRows();
    $('dev').onchange = (e) => {
      settings.dev = e.target.checked;
      devRows();
      syncSettings();
    };
    const speedLabel = () => ($('dev-speed-value').value = settings.devSpeed.toFixed(2) + '×');
    $('dev-speed').value = Math.round(settings.devSpeed * 100);
    speedLabel();
    $('dev-speed').oninput = (e) => {
      settings.devSpeed = e.target.value / 100;
      speedLabel();
      syncSettings();
    };
    $('dev-fly').checked = settings.devFly;
    $('dev-fly').onchange = (e) => {
      settings.devFly = e.target.checked;
      syncSettings();
    };
    $('dev-noclip').checked = settings.devNoclip;
    $('dev-noclip').onchange = (e) => {
      settings.devNoclip = e.target.checked;
      syncSettings();
    };
    if ($('dev-teleport'))
      $('dev-teleport').onchange = (e) => {
        if (!e.target.value || !game) return;
        game.teleport(e.target.value);
        if (!$('title-screen').hidden) return;
        resume();
      };
    $('volume').value = Math.round(settings.volume * 100);
    $('volume-value').value = $('volume').value + '%';
    $('volume').oninput = (e) => {
      settings.volume = e.target.value / 100;
      $('volume-value').value = e.target.value + '%';
      settings.muted = settings.volume === 0;
      syncSettings();
      if (!settings.muted) sound.start();
    };
    $('sensitivity').value = settings.sensitivity * 100;
    $('sense-value').value = settings.sensitivity.toFixed(2) + '×';
    $('sensitivity').oninput = (e) => {
      settings.sensitivity = e.target.value / 100;
      $('sense-value').value = settings.sensitivity.toFixed(2) + '×';
      syncSettings();
    };
    $('invert').checked = settings.invertY;
    $('invert').onchange = (e) => {
      settings.invertY = e.target.checked;
      syncSettings();
    };
    $('graphics').value = settings.quality;
    $('graphics').onchange = (e) => {
      settings.quality = e.target.value;
      syncSettings();
      game?.quality();
    };
    $('marker-setting').checked = settings.marker;
    $('marker-setting').onchange = (e) => {
      settings.marker = e.target.checked;
      syncSettings();
    };
  } else if (kind === 'pause') {
    game.pause();
    const found = game.found();
    dialogBase(
      kind,
      'FIELD SESSION',
      '巡检暂停',
      '<div class="action-row">' +
        button('resume', '继续巡检', true) +
        button('pause-journal', `巡检档案 <span class="count">${found}/${archivesOf(game.chapter).length}</span>`) +
        button('pause-guide', '操作指南') +
        button('pause-settings', '系统设置') +
        button('restart', '从头开始') +
        button('leave', '保存并返回主菜单') +
        '</div>'
    );
    $('resume').onclick = resume;
    $('pause-journal').onclick = () => show('journal', 'pause');
    $('pause-guide').onclick = () => show('guide', 'pause');
    $('pause-settings').onclick = () => show('settings', 'pause');
    $('restart').onclick = () => show('restart', 'pause');
    $('leave').onclick = () => toTitle();
  } else if (kind === 'journal') {
    if (game?.active) game.pause(true);
    journalOrigin = origin;
    const found = new Set(game.site.archives),
      list = archivesOf(game.chapter);
    dialogBase(
      kind,
      'ARCHIVE INDEX  ·  ' + CHAPTERS[game.chapter].code,
      `巡检档案  ${game.found()}/${list.length}`,
      '<ol class="journal">' +
        list.map((a) =>
          found.has(a.id)
            ? `<li><button data-id="${a.id}"><span class="mono">${a.code}</span><b>${escape(a.title)}</b><i>${escape(a.where)}</i></button></li>`
            : `<li class="missing"><span class="mono">— — —</span><b>未找到</b><i>${escape(a.where)}</i></li>`
        ).join('') +
        '</ol>'
    );
    for (const el of $('dialog-content').querySelectorAll('[data-id]')) el.onclick = () => show('archive', 'journal', el.dataset.id);
  } else if (kind === 'archive') {
    const a = archiveById(arg);
    if (game?.active) game.pause(true);
    dialogBase(
      kind,
      a.code + '  ·  ' + a.where,
      a.title,
      `<article class="paper">${a.text.map((t) => `<p>${escape(t)}</p>`).join('')}<footer>${escape(a.sign)}</footer></article>` +
        `<div class="action-row">${button('archive-ok', origin === 'journal' ? '返回档案列表' : '收起档案', true)}</div>`,
      'document'
    );
    $('archive-ok').onclick = close;
  } else if (kind === 'restart') {
    // In chapter two the shift can start that chapter again or go back to the very beginning.
    const two = game.chapter === 2;
    dialogBase(
      kind,
      'FIELD SESSION',
      '重新开始巡检？',
      (two
        ? '<p class="dialog-note">重新开始第二章：本章进度与档案清除，回到主控层。<br />从第一章开始：回到值班室重新巡检；第二章进度保留，可在标题页切换回来。</p>'
        : '<p class="dialog-note">本次巡检进度与已找到的档案将被清除，你会回到值班室。</p>') +
        '<div class="action-row">' +
        button('confirm-restart', two ? '重新开始第二章' : '重新开始', true) +
        (two ? button('restart-ch1', '从第一章开始') : '') +
        button('cancel-restart', '保留当前进度') +
        '</div>'
    );
    $('confirm-restart').onclick = () => {
      setSave(game.chapter, null);
      game.reset();
      resume();
    };
    if (two)
      $('restart-ch1').onclick = () => {
        game.save();
        setSave(1, null);
        selectChapter(1);
        game.reset(1);
        resume();
      };
    $('cancel-restart').onclick = () => show('pause');
  } else if (kind === 'new-run') {
    dialogBase(
      kind,
      'NEW SHIFT',
      '开始新的巡检？',
      '<p class="dialog-note">当前存档将被清除。</p><div class="action-row">' +
        button('confirm-new', '清除并开始', true) +
        button('cancel-new', '取消') +
        '</div>'
    );
    $('confirm-new').onclick = () => {
      setSave(selected, null);
      hideDialog();
      start();
    };
    $('cancel-new').onclick = hideDialog;
  } else if (kind === 'display') {
    dialogBase(kind, 'DISPLAY', '全屏显示', '<p class="dialog-note">可在浏览器的「显示」菜单中进入全屏，再返回巡检。</p>');
  }
}
function close() {
  if (panel === 'finished') return toTitle();
  if (panel === 'pause') return resume();
  if (returnTo === 'pause') return show('pause');
  if (returnTo === 'journal') return show('journal', journalOrigin);
  if ((panel === 'archive' || panel === 'journal') && game && $('title-screen').hidden) return resume();
  hideDialog();
}
function resume() {
  hideDialog();
  game.resume();
}
function toTitle() {
  if (game?.active) game.pause();
  if (game?.mode === 'cinematic') game.freeRoam();
  sound.idle();
  hideDialog();
  $('play-screen').hidden = true;
  $('title-screen').hidden = false;
  $('start').focus({ preventScroll: true });
}
const ENDINGS = {
  1: { title: '巡检完成', lead: '砼核已重启。光沿着井壁一路亮上来。', end: '冠顶观测台 +132 m' },
  2: { title: '汛期已过', lead: '三孔闸全开，水位退回警戒线下。雨停了，天边发白。', end: '北坝坝顶 +096 m' },
};
function finished(stats) {
  if (!progress.cleared.includes(stats.chapter)) progress.cleared.push(stats.chapter);
  write(PROGRESS_KEY, progress);
  const ending = ENDINGS[stats.chapter],
    next = CHAPTERS[stats.chapter + 1] ? stats.chapter + 1 : 0;
  dialogBase(
    'finished',
    'INSPECTION LOG  ·  ' + CHAPTERS[stats.chapter].code,
    ending.title,
    `<p class="dialog-note lead">${ending.lead}</p>` +
      row('终点', ending.end) +
      row('巡检用时', clock(stats.time)) +
      row('巡检档案', `${stats.found} / ${stats.total}`) +
      (stats.fails ? row('漫顶重来', `${stats.fails} 次`) : '') +
      '<div class="action-row">' +
      (next ? button('next-chapter', '进入第二章 · 汛期', true) : '') +
      button('free-roam', '继续漫游', !next) +
      button('return-title', '返回主菜单') +
      '</div>',
    'field-record'
  );
  if (next)
    $('next-chapter').onclick = () => {
      selectChapter(next);
      hideDialog();
      game.restore(saves[next], next);
      game.input.lock();
    };
  $('free-roam').onclick = () => {
    hideDialog();
    game.freeRoam();
    game.input.lock();
  };
  $('return-title').onclick = toTitle;
}
async function start() {
  if (starting || panel) return;
  starting = true;
  $('loading').hidden = false;
  const save = saves[selected];
  $('loading-label').textContent = save ? '正在恢复巡检' : CHAPTERS[selected].loading;
  try {
    sound.start();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (!game) {
      const { Game } = await import('./game/game.js');
      game = await Game.create(sound, settings, {
        pause: () => show('pause'),
        journal: () => show('journal'),
        save: (data) => setSave(data.chapter ?? 1, data),
        complete: finished,
        archive: (id) => show('archive', '', id),
      });
    }
    game.restore(save, selected);
    $('title-screen').hidden = true;
    $('play-screen').hidden = false;
    game.resize();
    game.resume();
  } catch (error) {
    sound.idle();
    console.error(error);
    dialogBase(
      'error',
      'RENDERER',
      '场景未能载入',
      '<p class="dialog-note">请确认使用支持 WebGL 的浏览器并开启硬件加速，再从本地游戏地址重试。</p><div class="action-row">' +
        button('retry', '重新载入', true) +
        '</div>'
    );
    $('retry').onclick = () => {
      hideDialog();
      start();
    };
  } finally {
    $('loading').hidden = true;
    starting = false;
  }
}
$('start').onclick = start;
for (const el of $('chapter-pick').querySelectorAll('button')) el.onclick = () => selectChapter(Number(el.dataset.ch));
$('new-run').onclick = () => show('new-run');
$('guide').onclick = () => show('guide');
$('settings').onclick = () => show('settings');
$('pause-btn').onclick = () => show('pause');
$('journal-btn').onclick = () => show('journal');
$('close').onclick = close;
$('veil').addEventListener('click', (e) => {
  if (e.target === $('veil') && panel !== 'finished') close();
});
addEventListener('keydown', (e) => {
  if (starting) return;
  if (panel) {
    if (e.code === 'Escape' || (panel === 'archive' && e.code === 'KeyE') || (panel === 'journal' && e.code === 'KeyJ')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (panel !== 'finished') close();
      return;
    }
    if (e.code === 'Tab') {
      const items = [...$('modal').querySelectorAll('button:not([hidden]),input,select')];
      if (e.shiftKey && document.activeElement === items[0]) {
        e.preventDefault();
        items.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
        e.preventDefault();
        items[0]?.focus();
      }
    }
  } else if (
    !$('title-screen').hidden &&
    e.code === 'Enter' &&
    !e.repeat &&
    (document.activeElement === document.body || document.activeElement === $('start'))
  ) {
    e.preventDefault();
    start();
  }
});
// A hidden tab is always silent, whatever screen it was left on.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sound.idle();
  else if (game?.active) sound.start();
});
addEventListener('pagehide', () => {
  if (game?.active) game.save();
});
// Debug hooks for automated checks; harmless in play.
window.__concrete = { get game() { return game; } };
