// ═══════════════════════════════════════
//  Naval Chess — 主入口：菜单、事件绑定、初始化
//  加载顺序：第9个（依赖所有上述文件，最后加载）
// ═══════════════════════════════════════

// ── 菜单控制 ──
function showSubMode(label) {
  menuSubLabel.textContent = label;
  menuMain.classList.add('hidden');
  menuSubMode.classList.remove('hidden');
  // 敌人难度仅人机练习显示
  document.getElementById('btnDifficulty').style.display = gameMode === 'ai' ? '' : 'none';
}

function hideSubMode() {
  menuSubMode.classList.add('hidden');
  menuMain.classList.remove('hidden');
}

document.getElementById('btnPvP').addEventListener('click', function() {
  gameMode = 'pvp';
  showSubMode('对战 · 选择模式');
});

btnAI.addEventListener('click', function() {
  gameMode = 'ai';
  showSubMode('人机练习 · 选择模式');
});

document.getElementById('btnClassic').addEventListener('click', function() {
  gameSpeed = 'classic';
  hideSubMode();
  startShipSelection(0);
});

document.getElementById('btnSpeed').addEventListener('click', function() {
  gameSpeed = 'speed';
  hideSubMode();
  startShipSelection(0);
});

document.getElementById('btnSubBack').addEventListener('click', function() {
  hideSubMode();
});

// ── 敌人难度菜单 ──
document.getElementById('btnDifficulty').addEventListener('click', function() {
  menuSubMode.classList.add('hidden');
  var md = document.getElementById('menuDifficulty');
  md.classList.remove('hidden');
});

document.getElementById('btnDiffReckless').addEventListener('click', function() {
  aiDifficulty = 'reckless';
  updateDifficultySelection();
});

document.getElementById('btnDiffTimid').addEventListener('click', function() {
  aiDifficulty = 'timid';
  updateDifficultySelection();
});

document.getElementById('btnDiffCunning').addEventListener('click', function() {
  aiDifficulty = 'cunning';
  updateDifficultySelection();
});

document.getElementById('btnDiffDeep').addEventListener('click', function() {
  aiDifficulty = 'deep';
  updateDifficultySelection();
});

document.getElementById('btnDiffBack').addEventListener('click', function() {
  var md = document.getElementById('menuDifficulty');
  md.classList.add('hidden');
  menuSubMode.classList.remove('hidden');
});

// 高亮当前选中的难度
function updateDifficultySelection() {
  var btns = document.querySelectorAll('#menuDifficulty .menu-item');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.remove('selected');
  }
  var map = { reckless: 'btnDiffReckless', timid: 'btnDiffTimid', cunning: 'btnDiffCunning', deep: 'btnDiffDeep' };
  var sel = document.getElementById(map[aiDifficulty]);
  if (sel) sel.classList.add('selected');
}

// 添加选中状态样式
document.getElementById('btnDiffTimid').classList.add('selected');

// ── 移动端画布和标签自适应 ──
function resizeForMobile() {
  var isMobile = window.innerWidth <= 900;
  if (!isMobile) {
    canvas.style.width = ''; canvas.style.height = '';
    var rl2 = document.getElementById('rowLabels');
    if (rl2) { rl2.style.height = ''; rl2.style.width = ''; }
    var rls = document.querySelectorAll('.row-label');
    for (var ri = 0; ri < rls.length; ri++) { rls[ri].style.height = ''; rls[ri].style.fontSize = ''; rls[ri].style.width = ''; }
    var cls = document.querySelectorAll('.grid-label');
    for (var ci = 0; ci < cls.length; ci++) { cls[ci].style.width = ''; cls[ci].style.fontSize = ''; cls[ci].style.textAlign = ''; }
    var glr = document.querySelector('.grid-labels-row');
    if (glr) { glr.style.paddingLeft = ''; glr.style.width = ''; glr.style.display = ''; glr.style.gap = ''; }
    var gro2 = document.querySelector('.grid-row-outer');
    if (gro2) { gro2.style.overflow = ''; }
    return;
  }
  var availW = window.innerWidth - 20;
  var labelW = 14;
  var canvasW = Math.floor(Math.min(availW - labelW - 8, 560));
  canvas.style.width = canvasW + 'px';
  canvas.style.height = canvasW + 'px';
  var cellPx = canvasW / GRID_SIZE;

  // 行标签：精确匹配每格高度
  var rowLabels = document.getElementById('rowLabels');
  if (rowLabels) {
    rowLabels.style.height = canvasW + 'px';
    rowLabels.style.display = 'flex';
    rowLabels.style.flexDirection = 'column';
    rowLabels.style.gap = '0';
    rowLabels.style.width = labelW + 'px';
  }
  // 防止棋盘溢出
  var gro = document.querySelector('.grid-row-outer');
  if (gro) { gro.style.overflow = 'hidden'; }
  var rls = document.querySelectorAll('.row-label');
  for (var ri = 0; ri < rls.length; ri++) {
    rls[ri].style.height = cellPx + 'px';
    rls[ri].style.lineHeight = cellPx + 'px';
    rls[ri].style.fontSize = Math.max(6, Math.floor(cellPx * 0.35)) + 'px';
    rls[ri].style.width = (labelW - 2) + 'px';
  }

  // 列标签：精确匹配每格宽度，文字居中
  var cls = document.querySelectorAll('.grid-label');
  var glRow = document.querySelector('.grid-labels-row');
  for (var ci = 0; ci < cls.length; ci++) {
    cls[ci].style.width = cellPx + 'px';
    cls[ci].style.fontSize = Math.max(6, Math.floor(cellPx * 0.4)) + 'px';
    cls[ci].style.textAlign = 'center';
    cls[ci].style.lineHeight = '10px';
    cls[ci].style.height = '10px';
  }
  glRow.style.paddingLeft = labelW + 'px';
  glRow.style.display = 'flex';
  glRow.style.gap = '0';
}
window.addEventListener('resize', resizeForMobile);
resizeForMobile();

function startGame() {
  gameOver = false;
  sharks = []; mines = []; terrain = []; minePlacementMode = false;
  playerKills = [{ ram: 0, broadside: 0, boarding: 0 }, { ram: 0, broadside: 0, boarding: 0 }];
  btnEndTurn.disabled = false;
  btnReset.disabled = false;
  menuScreen.classList.add('hidden');
  gameScreen.style.display = '';
  initTestShips(activeGamePicks.red, activeGamePicks.blue);
  log(gameMode === 'ai' ? '人机对战开始，你是葡萄牙帝国。' : '海上棋准备就绪。选择一艘舰船以下达命令。');
}

// ── 背景音乐控制 ──
function updateMusicButton() {
  if (!musicLoaded) {
    btnMusic.textContent = '⏳ 加载中';
    btnMusic.classList.add('muted');
    btnMusic.disabled = true;
    return;
  }
  btnMusic.disabled = false;
  if (musicOn) {
    btnMusic.textContent = '🔊 音乐';
    btnMusic.classList.remove('muted');
    if (bgm.paused) bgm.play().catch(function(){});
  } else {
    btnMusic.textContent = '🔇 静音';
    btnMusic.classList.add('muted');
    bgm.pause();
  }
}

// 音频缓冲足够即开始播放（canplay 在几秒内触发，不等整个文件下载完）
bgm.addEventListener('canplay', function() {
  if (musicLoaded) return;
  musicLoaded = true;
  updateMusicButton();
  if (musicOn) {
    bgm.play().then(function() {
      console.log('[BGM] 开始播放');
    }).catch(function() {
      // 浏览器自动播放策略阻止，等用户首次交互
      console.log('[BGM] 等待用户交互');
    });
  }
});

// 显示加载进度
bgm.addEventListener('progress', function() {
  if (!musicLoaded && bgm.buffered.length > 0) {
    var pct = Math.round(bgm.buffered.end(0) / bgm.duration * 100);
    if (pct > 0) btnMusic.textContent = '⏳ ' + pct + '%';
  }
});

btnMusic.addEventListener('click', function() {
  if (!musicLoaded) return;
  musicOn = !musicOn;
  updateMusicButton();
});

function tryStartBgm() {
  if (musicLoaded && musicOn && bgm.paused) {
    bgm.play().catch(function() {});
  }
  document.removeEventListener('click', tryStartBgm);
  document.removeEventListener('keydown', tryStartBgm);
}
document.addEventListener('click', tryStartBgm);
document.addEventListener('keydown', tryStartBgm);

updateMusicButton();

// ── 初始化标签 ──
function buildLabels() {
  const colContainer = document.getElementById('colLabels');
  const rowContainer = document.getElementById('rowLabels');
  for (let i = 0; i < GRID_SIZE; i++) {
    const colLbl = document.createElement('span');
    colLbl.className = 'grid-label';
    colLbl.textContent = String.fromCharCode(65 + i);
    colContainer.appendChild(colLbl);
    const rowLbl = document.createElement('span');
    rowLbl.className = 'row-label';
    rowLbl.textContent = i + 1;
    rowContainer.appendChild(rowLbl);
  }
}
buildLabels();

// ── 事件：点击棋盘 ──
canvas.addEventListener('click', function(e) {
  if (gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  const grid = pixelToGrid(px, py);
  if (!grid) return;

  const clickedShipIndex = ships.findIndex(function(ship) {
    const dv = DIR_VECTORS[ship.direction];
    for (let i = 0; i < ship.length; i++) {
      const cx = ship.col + dv.dx * i;
      const cy = ship.row + dv.dy * i;
      if (cx === grid.col && cy === grid.row) return true;
    }
    return false;
  });

  // 布雷模式：点击空格布设水雷
  if (minePlacementMode) {
    placeMineAt(grid.col, grid.row);
    updateInfoPanel(); render();
    return;
  }

  if (clickedShipIndex >= 0) {
    // 无法选中敌方下潜中的舰船
    if (ships[clickedShipIndex].submerged && ships[clickedShipIndex].playerIndex !== currentPlayerIndex) {
      log('无法选中敌方舰船');
      return;
    }
    selectedShipIndex = clickedShipIndex;
  } else {
    selectedShipIndex = -1;
  }
  updateInfoPanel();
  render();
});

// ── 键盘快捷键 ──
window.addEventListener('keydown', function(e) {
  if (gameOver) return;
  const key = e.key.toLowerCase();
  switch (key) {
    case 'w': btnMove.click(); break;
    case 'a': btnTurnLeft.click(); break;
    case 'd': btnTurnRight.click(); break;
    case 'q': btnBroadside.click(); break;
    case 'e': btnRam.click(); break;
    case 'r': btnBoard.click(); break;
    case 'f': btnSubmerge.click(); break;
    case 'g': btnBowCannon.click(); break;
    case 'h': btnGreekFire.click(); break;
    case 't': btnDevour.click(); break;
    case 'y': btnSharks.click(); break;
    case 'u': btnMine.click(); break;
    case 'i': btnSupply.click(); break;
    case 'o': btnAmmo.click(); break;
    default: return;
  }
  e.preventDefault();
});

// ── 行动按钮事件 ──
function mpGuard() {
  if (mpWaitingForTurnSwitch) {
    log('正在等待服务器确认回合切换…');
    return false;
  }
  if (mpGameStarted && currentPlayerIndex !== mpPlayerIndex) {
    log('现在是对方回合，请等待');
    return false;
  }
  if ((gameMode === 'ai' || inCampaign) && currentPlayerIndex === 1) {
    log('请等待电脑回合结束');
    return false;
  }
  return true;
}

btnMove.addEventListener('click', function() {
  if (!mpGuard()) return;
  moveShipForward();
  updateInfoPanel(); render();
});

btnTurnLeft.addEventListener('click', function() {
  if (!mpGuard()) return;
  turnShip(-1);
  updateInfoPanel(); render();
});

btnTurnRight.addEventListener('click', function() {
  if (!mpGuard()) return;
  turnShip(1);
  updateInfoPanel(); render();
});

btnBroadside.addEventListener('click', function() {
  if (!mpGuard()) return;
  fireBroadside();
  updateInfoPanel(); render();
});

btnRam.addEventListener('click', function() {
  if (!mpGuard()) return;
  initiateRamming();
  updateInfoPanel(); render();
});

btnBoard.addEventListener('click', function() {
  if (!mpGuard()) return;
  initiateBoarding();
  updateInfoPanel(); render();
});

btnSubmerge.addEventListener('click', function() {
  if (!mpGuard()) return;
  if (selectedShipIndex >= 0 && ships[selectedShipIndex].submerged) {
    surfaceShip();
  } else {
    submergeShip();
  }
  updateInfoPanel(); render();
});

btnBowCannon.addEventListener('click', function() {
  if (!mpGuard()) return;
  fireBowCannon();
  updateInfoPanel(); render();
});

btnGreekFire.addEventListener('click', function() {
  if (!mpGuard()) return;
  fireGreekFire();
  updateInfoPanel(); render();
});

btnDevour.addEventListener('click', function() {
  if (!mpGuard()) return;
  devourShip();
  updateInfoPanel(); render();
});

btnSharks.addEventListener('click', function() {
  if (!mpGuard()) return;
  releaseSharks();
  updateInfoPanel(); render();
});

btnMine.addEventListener('click', function() {
  if (!mpGuard()) return;
  enterMinePlacement();
  updateInfoPanel(); render();
});

btnSupply.addEventListener('click', function() {
  if (!mpGuard()) return;
  supplyShip();
  updateInfoPanel(); render();
});

btnAmmo.addEventListener('click', function() {
  if (!mpGuard()) return;
  ammoSupport();
  updateInfoPanel(); render();
});

// ── 回合控制 ──
btnEndTurn.addEventListener('click', function() {
  if (gameOver) return;
  if (mpWaitingForTurnSwitch) {
    log('正在等待服务器确认回合切换…');
    return;
  }
  if (mpGameStarted && currentPlayerIndex !== mpPlayerIndex) {
    log('现在是对方回合，请等待');
    return;
  }
  if (gameMode === 'ai' && currentPlayerIndex !== 0) {
    log('请等待电脑回合结束');
    return;
  }
  if (mpGameStarted) {
    if (!sendEndTurn()) {
      log('[联机] 无法发送消息，请检查网络连接');
      return;
    }
    mpWaitForTurnSwitch();
    log('已发送结束回合请求，等待服务器确认…');
    return;
  }
  switchToNextPlayer();
  if (gameMode === 'ai' && currentPlayerIndex !== 0) {
    setTimeout(function() { aiTakeTurn(); }, 500);
  }
});

btnReset.addEventListener('click', function() {
  if (mpGameStarted) { surrenderGame(); return; }
  gameOver = false;
  sharks = []; mines = []; terrain = []; minePlacementMode = false;
  playerKills = [{ ram: 0, broadside: 0, boarding: 0 }, { ram: 0, broadside: 0, boarding: 0 }];
  var vo2 = document.getElementById('victoryOverlay'); vo2.classList.add('hidden'); vo2.style.display = 'none';
  btnEndTurn.disabled = false;
  btnReset.disabled = false;
  if (inCampaign) {
    initCampaignGame(shipSelectionState.redPicks);
  } else {
    initTestShips(activeGamePicks.red, activeGamePicks.blue);
  }
  log('棋盘已重置，初始舰队就位。');
});

document.getElementById('btnVictoryMenu').addEventListener('click', function() {
  // 关卡模式下先显示名船解锁提示，再跳转
  if (inCampaign && showPendingUnlock()) {
    var vo2 = document.getElementById('victoryOverlay'); vo2.classList.add('hidden'); vo2.style.display = 'none';
    return; // 解锁提示关闭后再跳转
  }
  var vo2 = document.getElementById('victoryOverlay'); vo2.classList.add('hidden'); vo2.style.display = 'none';
  gameScreen.style.display = 'none';
  if (inCampaign) {
    inCampaign = false;
    updateCampaignLevelButtons();
    updateLibraryDisplay();
    var cs = document.getElementById('campaignScreen');
    cs.classList.remove('hidden');
    cs.style.display = 'flex';
  } else {
    menuScreen.classList.remove('hidden');
  }
});

// ── 关卡模式 ──
document.getElementById('btnCampaign').addEventListener('click', function() {
  menuScreen.classList.add('hidden');
  var cs = document.getElementById('campaignScreen');
  cs.classList.remove('hidden');
  cs.style.display = 'flex';
});

document.getElementById('btnCampaignBack').addEventListener('click', function() {
  var cs = document.getElementById('campaignScreen');
  cs.classList.add('hidden');
  cs.style.display = 'none';
  menuScreen.classList.remove('hidden');
});

// ── 名船库 ──
document.getElementById('btnOpenLibrary').addEventListener('click', function() {
  var cs = document.getElementById('campaignScreen');
  cs.classList.add('hidden');
  cs.style.display = 'none';
  updateLibraryDisplay();
  var ls = document.getElementById('libraryScreen');
  ls.classList.remove('hidden');
  ls.style.display = 'flex';
});

// ── PWA 版本更新检测 ──
(function() {
  // 左下角版本号（提高可见性）
  var verEl = document.createElement('div');
  verEl.id = 'appVersion';
  verEl.textContent = 'v' + APP_VERSION;
  verEl.style.cssText = 'position:fixed;bottom:6px;left:10px;font-size:11px;color:rgba(255,255,255,0.55);z-index:9999;font-family:monospace;pointer-events:none;text-shadow:0 0 4px rgba(0,0,0,0.6);';
  document.body.appendChild(verEl);

  if (!('serviceWorker' in navigator)) return;

  // SW 激活/接管时触发更新提示
  var firstController = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    // 页面首次加载时也会触发 controllerchange（SW 首次接管），跳过
    if (!firstController) { firstController = navigator.serviceWorker.controller; return; }
    showUpdateToast();
  });

  // 每 2 分钟主动检查更新
  navigator.serviceWorker.ready.then(function(reg) {
    setInterval(function() {
      reg.update().catch(function(){});
    }, 2 * 60 * 1000);
  });

  function showUpdateToast() {
    if (document.getElementById('updateToast')) return;
    var toast = document.createElement('div');
    toast.id = 'updateToast';
    toast.innerHTML = '<span>检测到新版本可用</span><button id="btnUpdateRefresh">🔄 刷新更新</button>';
    document.body.appendChild(toast);

    document.getElementById('btnUpdateRefresh').addEventListener('click', function() {
      window.location.reload();
    });
  }
})();

document.getElementById('btnLibraryBack').addEventListener('click', function() {
  var ls = document.getElementById('libraryScreen');
  ls.classList.add('hidden');
  ls.style.display = 'none';
  var cs = document.getElementById('campaignScreen');
  cs.classList.remove('hidden');
  cs.style.display = 'flex';
});

document.getElementById('btnHelp').addEventListener('click', function() {
  document.getElementById('helpOverlay').classList.remove('hidden');
});

// 帮助手册章节切换
function helpSwitchChapter(ch, el) {
  var allNav = document.querySelectorAll('.help-nav');
  for (var hj = 0; hj < allNav.length; hj++) { allNav[hj].classList.remove('active'); }
  if (el) el.classList.add('active');
  var secs = document.querySelectorAll('.help-section');
  for (var hk = 0; hk < secs.length; hk++) { secs[hk].classList.remove('active'); }
  var sec = document.getElementById('helpSec' + ch);
  if (sec) sec.classList.add('active');
}

document.getElementById('btnUnlockOk').addEventListener('click', function() {
  var uo = document.getElementById('unlockOverlay');
  uo.classList.add('hidden');
  // 关卡模式：解锁提示关闭后跳转到关卡选择
  if (inCampaign) {
    inCampaign = false;
    gameScreen.style.display = 'none';
    updateCampaignLevelButtons();
    updateLibraryDisplay();
    var cs = document.getElementById('campaignScreen');
    cs.classList.remove('hidden');
    cs.style.display = 'flex';
  }
});
