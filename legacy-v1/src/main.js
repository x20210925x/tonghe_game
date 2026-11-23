import { Soundscape } from './audio.js';
const $ = (id) => document.getElementById(id);
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing can still play in memory. */
  }
};
const defaults = { volume: 0.65, muted: false, sensitivity: 1, quality: 'balanced', marker: true };
const settings = { ...defaults, ...read('concrete.settings', {}) };
if (!['low', 'balanced', 'high'].includes(settings.quality)) settings.quality = 'balanced';
let save = read('concrete.inspection', null),
  game = null,
  starting = false,
  panel = '',
  returnTo = '',
  lastFocus = null;
const sound = new Soundscape();
function syncSettings() {
  write('concrete.settings', settings);
  sound.set(settings.volume, settings.muted);
  $('audio-button')
    .querySelector('use')
    .setAttribute('href', settings.muted ? '#icon-mute' : '#icon-sound');
  $('audio-button').setAttribute('aria-pressed', String(!settings.muted));
  $('audio-button').title = settings.muted ? '开启环境音' : '关闭环境音';
}
function setSave(data) {
  save = data;
  write('concrete.inspection', data);
  $('start-label').textContent = save ? '继续巡检' : '开始巡检';
}
setSave(save);
syncSettings();
if (matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 1)
  $('app').classList.add('touch');
addEventListener(
  'pointerdown',
  (e) => {
    if (e.pointerType === 'touch') $('app').classList.add('touch');
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
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else if (document.documentElement.webkitRequestFullscreen)
      document.documentElement.webkitRequestFullscreen();
    else show('display');
  } catch {
    show('display');
  }
};
function hideDialog() {
  $('veil').hidden = true;
  $('veil').classList.remove('field-record');
  panel = '';
  returnTo = '';
  if (lastFocus?.isConnected && lastFocus.getClientRects().length)
    lastFocus.focus({ preventScroll: true });
}
function dialogBase(kind, code, title, content) {
  if (!$('veil').hidden && panel !== kind) lastFocus = null;
  else if ($('veil').hidden) lastFocus = document.activeElement;
  $('veil').classList.toggle('field-record', kind === 'finished');
  panel = kind;
  $('dialog-type').textContent = code;
  $('dialog-title').textContent = title;
  $('dialog-content').innerHTML = content;
  $('veil').hidden = false;
  $('close').hidden = false;
  $('close').focus({ preventScroll: true });
}
const button = (id, label, primary = false) =>
  '<button id="' + id + '" class="' + (primary ? 'primary' : '') + '">' + label + '</button>';
const row = (label, key) =>
  '<div class="guide-row"><span>' + label + '</span><kbd>' + key + '</kbd></div>';
function show(kind, origin = '') {
  returnTo = origin;
  if (kind === 'guide') {
    const touch = $('app').classList.contains('touch');
    const controls = touch
      ? [
          ['移动', '左侧摇杆'],
          ['环视', '拖动场景'],
          ['切换步速', '慢跑'],
          ['操作设备', '轻触交互提示'],
          ['暂停', '右上角 Ⅱ'],
        ]
      : [
          ['移动', 'W A S D'],
          ['环视', '拖动鼠标 / 方向键'],
          ['慢跑', '按住 Shift'],
          ['操作设备', 'E'],
          ['暂停', 'Esc'],
        ];
    dialogBase(
      kind,
      'FIELD MANUAL',
      '操作指南',
      controls.map(([a, b]) => row(a, b)).join('') +
        '<p class="dialog-note">旁通阀用 A / D 调节开度，轨车按住 W 牵引、S 制动。设备面板也支持点击或触控。</p>'
    );
  } else if (kind === 'settings') {
    dialogBase(
      kind,
      'SYSTEM CONFIG',
      '系统设置',
      '<div class="setting-row"><label for="volume">环境音量</label><input id="volume" type="range" min="0" max="100" step="1"><output id="volume-value"></output></div>' +
        '<div class="setting-row"><label for="sensitivity">环视灵敏度</label><input id="sensitivity" type="range" min="40" max="180" step="5"><output id="sense-value"></output></div>' +
        '<div class="setting-row"><label for="graphics">画面质量</label><select id="graphics"><option value="low">流畅</option><option value="balanced">均衡</option><option value="high">精细</option></select></div>' +
        '<div class="setting-row"><label for="marker-setting">目标方位标记</label><input id="marker-setting" type="checkbox"></div>'
    );
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
    $('graphics').value = settings.quality;
    $('graphics').onchange = (e) => {
      settings.quality = e.target.value;
      syncSettings();
      if (game) game.quality();
    };
    $('marker-setting').checked = settings.marker;
    $('marker-setting').onchange = (e) => {
      settings.marker = e.target.checked;
      syncSettings();
    };
  } else if (kind === 'pause') {
    game.pause();
    dialogBase(
      kind,
      'FIELD SESSION',
      '巡检暂停',
      '<div class="action-row">' +
        button('resume', '继续巡检', true) +
        button('pause-guide', '操作指南') +
        button('pause-settings', '系统设置') +
        button('restart', '从头开始') +
        button('leave', '保存并返回主菜单') +
        '</div>'
    );
    $('resume').onclick = resume;
    $('pause-guide').onclick = () => show('guide', 'pause');
    $('pause-settings').onclick = () => show('settings', 'pause');
    $('restart').onclick = () => show('restart', 'pause');
    $('leave').onclick = () => toTitle();
  } else if (kind === 'restart') {
    dialogBase(
      kind,
      'FIELD SESSION',
      '重新开始巡检？',
      '<p class="dialog-note">本次巡检进度将被替换，你会回到值班室。</p><div class="action-row">' +
        button('confirm-restart', '重新开始', true) +
        button('cancel-restart', '保留当前进度') +
        '</div>'
    );
    $('confirm-restart').onclick = () => {
      setSave(null);
      game.reset();
      resume();
    };
    $('cancel-restart').onclick = () => show('pause');
  } else if (kind === 'display') {
    dialogBase(
      kind,
      'DISPLAY',
      '全屏显示',
      '<p class="dialog-note">可在浏览器的「显示」菜单中进入全屏，再返回巡检。</p>'
    );
  }
}
function close() {
  if (panel === 'finished') {
    toTitle();
    return;
  }
  if (panel === 'pause') {
    resume();
    return;
  }
  if (returnTo === 'pause') {
    sound.idle();
    show('pause');
    return;
  }
  hideDialog();
}
function resume() {
  hideDialog();
  game.resume();
}
function toTitle() {
  game?.pause();
  sound.idle();
  hideDialog();
  $('play-screen').hidden = true;
  $('title-screen').hidden = false;
  $('start').focus({ preventScroll: true });
}
function finished(seconds) {
  const min = Math.floor(seconds / 60),
    sec = Math.floor(seconds % 60);
  setSave(null);
  dialogBase(
    'finished',
    'INSPECTION LOG',
    '巡检完成',
    row('终点', '上层观测台') +
      row('到达标高', '+078.0 m') +
      row('巡检用时', String(min).padStart(2, '0') + ' : ' + String(sec).padStart(2, '0')) +
      '<div class="action-row">' +
      button('return-title', '返回主菜单', true) +
      '</div>'
  );
  $('return-title').onclick = toTitle;
}
async function start() {
  if (starting || panel) return;
  starting = true;
  $('loading').hidden = false;
  $('loading-label').textContent = save ? '正在恢复巡检' : '正在进入值班室';
  try {
    sound.start();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (!game) {
      const { Game } = await import('./game.js');
      game = await Game.create(sound, settings, {
        pause: () => show('pause'),
        save: setSave,
        complete: finished,
      });
    }
    game.restore(save);
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
$('guide').onclick = () => show('guide');
$('settings').onclick = () => show('settings');
$('pause-btn').onclick = () => show('pause');
$('close').onclick = close;
$('veil').addEventListener('click', (e) => {
  if (e.target === $('veil')) close();
});
addEventListener('keydown', (e) => {
  if (starting) return;
  if (panel) {
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
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
addEventListener('pagehide', () => {
  if (game?.active) game.save();
});
