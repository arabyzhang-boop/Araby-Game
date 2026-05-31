// ═══════════════════════════════════════
//  Naval Chess — 多人联机客户端
//  加载顺序：第10个（依赖 config, utils, ui）
// ═══════════════════════════════════════

var mpSocket = null;
var mpRoom = null;
var mpPlayerIndex = -1;
var mpGameStarted = false;
var mpConnected = false;
var mpPendingSend = null;
var mpIsHost = false;

// 联机服务器地址：本地测试用 localhost，部署后替换为 Render 地址
var MP_SERVER = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  ? 'ws://localhost:3000'
  : 'wss://araby-game.onrender.com';

// ── UI 元素 ──
var mpMenuScreen = null;
var mpWaitingScreen = null;
var mpStatusEl = null;

function createMultiplayerUI() {
  var div = document.createElement('div');
  div.className = 'menu-overlay hidden';
  div.id = 'mpMenuScreen';
  div.innerHTML = '<div class="menu-card">' +
    '<div class="menu-title">多人联机</div>' +
    '<div class="menu-subtitle">Naval Chess Online</div>' +
    '<div class="menu-divider"></div>' +
    '<div class="menu-items">' +
      '<button class="menu-item" id="btnMpHost">创建房间</button>' +
      '<div style="display:flex;gap:8px;align-items:center;justify-content:center;">' +
        '<input id="mpRoomInput" class="mp-room-input" placeholder="输入4位数字" maxlength="4" style="font-family:inherit;font-size:16px;padding:12px;width:120px;text-align:center;background:rgba(255,255,255,0.3);border:2px solid #5d4037;border-radius:4px;color:#3e2723;letter-spacing:4px;">' +
        '<button class="menu-item" id="btnMpJoin" style="padding:14px 24px;">加入房间</button>' +
      '</div>' +
      '<div id="mpStatusText" style="font-size:12px;margin-top:8px;opacity:0.7;"></div>' +
      '<button class="menu-item" id="btnMpBack" style="font-size:14px;opacity:0.7;margin-top:4px;">返回</button>' +
    '</div>' +
  '</div>';
  document.body.appendChild(div);

  var div2 = document.createElement('div');
  div2.className = 'menu-overlay hidden';
  div2.id = 'mpWaitingScreen';
  div2.innerHTML = '<div class="menu-card">' +
    '<div class="menu-title">等待对手</div>' +
    '<div class="menu-subtitle">房间号：<span id="mpRoomCode" style="font-size:24px;letter-spacing:6px;color:#c9a94e;">—</span></div>' +
    '<div class="menu-divider"></div>' +
    '<div class="selection-transition-msg">等待对手加入…</div>' +
    '<button class="menu-item" id="btnMpCancel" style="font-size:14px;opacity:0.7;margin-top:12px;">取消</button>' +
  '</div>';
  document.body.appendChild(div2);

  mpMenuScreen = document.getElementById('mpMenuScreen');
  mpWaitingScreen = document.getElementById('mpWaitingScreen');
  mpStatusEl = document.getElementById('mpStatusText');
}

// ── 状态显示 ──
function mpStatus(msg, isError) {
  if (mpStatusEl) {
    mpStatusEl.textContent = msg;
    mpStatusEl.style.color = isError ? '#c0392b' : '#5d4037';
  }
}

// ── WebSocket ──
function mpConnect() {
  if (mpSocket) { mpSocket.close(); }
  mpStatus('正在连接服务器…');
  mpSocket = new WebSocket(MP_SERVER);
  mpSocket.onopen = function() {
    mpConnected = true;
    mpStatus('已连接 ✓');
    if (mpPendingSend) {
      mpSocket.send(JSON.stringify(mpPendingSend));
      mpPendingSend = null;
    }
  };
  mpSocket.onmessage = function(e) {
    var msg = JSON.parse(e.data);
    handleServerMessage(msg);
  };
  mpSocket.onclose = function() {
    mpConnected = false;
    mpStatus('连接已断开', true);
  };
  mpSocket.onerror = function() {
    mpStatus('无法连接服务器，请确认服务器已启动', true);
  };
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'roomCreated':
      mpRoom = msg.room;
      mpPlayerIndex = 0;
      mpIsHost = true;
      document.getElementById('mpRoomCode').textContent = mpRoom;
      mpMenuScreen.classList.add('hidden');
      mpMenuScreen.style.display = 'none';
      mpWaitingScreen.classList.remove('hidden');
      mpWaitingScreen.style.display = 'flex';
      break;

    case 'roomJoined':
      mpRoom = msg.room;
      mpPlayerIndex = 1;
      mpIsHost = false;
      break;

    case 'gameStart':
      mpWaitingScreen.classList.add('hidden');
      mpWaitingScreen.style.display = 'none';
      mpMenuScreen.classList.add('hidden');
      // 房主生成选船数据并同步
      if (mpIsHost) {
        mpGenerateAndSyncSelection();
      }
      break;

    // 选船同步
    case 'selectionData':
      mpApplySelectionData(msg);
      break;

    case 'selectionUpdate':
      mpApplySelectionUpdate(msg);
      break;

    case 'selectionConfirmed':
      mpHandleSelectionConfirmed(msg);
      break;

    case 'startGameWithFleets':
      if (!mpGameStarted) {
        mpStartGameWithFleets(msg.redPicks, msg.bluePicks, msg.fleetData);
      }
      break;

    // 游戏中行动
    case 'action':
      if (mpGameStarted && !gameOver) {
        applyRemoteAction(msg.action);
      }
      break;

    case 'opponentSurrendered':
      if (mpGameStarted && !gameOver) {
        mpEndGame('对方投降！你获得了胜利');
      }
      break;

    case 'opponentDisconnected':
      if (mpGameStarted && !gameOver) {
        mpEndGame('对手已断开连接，你获得了胜利');
      }
      break;

    case 'error':
      mpStatus(msg.message, true);
      break;
  }
}

// ── 选船同步 ──
function mpGenerateAndSyncSelection() {
  // 生成红方选项
  shuffledFamousLibrary = famousShipLibrary.slice().sort(function() { return Math.random() - 0.5; });
  var half = Math.ceil(shuffledFamousLibrary.length / 2);
  shipSelectionState.famousPool = shuffledFamousLibrary.slice(0, half);
  var redOptions = generateShipOptions();
  shipSelectionState.famousPool = shuffledFamousLibrary.slice(half);
  var blueOptions = generateShipOptions2();

  // 房主本地保存双方选项
  mpSavedRedOptions = redOptions;
  mpSavedBlueOptions = blueOptions;

  // 发送给客机
  mpSocket.send(JSON.stringify({
    type: 'selectionData',
    redOptions: redOptions,
    blueOptions: blueOptions,
    currentPlayer: 0
  }));

  // 显示红方选船
  mpShowSelection(0, redOptions);
}

function generateShipOptions2() {
  // 使用 generateShipOptions（从 shipSelectionState.famousPool 读取）
  return generateShipOptions();
}

function mpApplySelectionData(msg) {
  // 接收房主生成的选船数据
  mpShowSelection(msg.currentPlayer, msg.currentPlayer === 0 ? msg.redOptions : msg.blueOptions);
  // 保存双方选项
  mpSavedRedOptions = msg.redOptions;
  mpSavedBlueOptions = msg.blueOptions;
}

var mpSavedRedOptions = null;
var mpSavedBlueOptions = null;
var mpCurrentSelectionPlayer = -1;

function mpShowSelection(playerIdx, options) {
  mpCurrentSelectionPlayer = playerIdx;
  shipSelectionState.currentPlayer = playerIdx;
  shipSelectionState.gold = 15;
  shipSelectionState.selectedIndices = [];
  shipSelectionState.availableShips = options;
  shipSelectionState.famousPool = []; // 不刷新

  var isMyTurn = (playerIdx === mpPlayerIndex);

  var overlay = document.getElementById('selectionScreen');
  var title = document.getElementById('selTitle');
  title.textContent = (playerIdx === 0 ? '红方' : '蓝方') + '选船 — ' +
    (isMyTurn ? '请组建你的舰队' : '等待对方选择');

  document.getElementById('btnSelConfirm').style.display = isMyTurn ? '' : 'none';
  document.getElementById('btnSelRefresh').style.display = isMyTurn ? '' : 'none';
  document.getElementById('btnSelSkip').textContent = isMyTurn ? '跳过不选' : '等待中…';
  document.getElementById('btnSelSkip').disabled = !isMyTurn;

  menuScreen.classList.add('hidden');
  overlay.classList.remove('hidden');
  overlay.style.display = 'flex';
  renderShipCards();
  updateSelectionButtons();
}

function updateSelectionButtons() {
  var isMyTurn = (mpCurrentSelectionPlayer === mpPlayerIndex);
  document.getElementById('btnSelConfirm').style.display = isMyTurn ? '' : 'none';
  document.getElementById('btnSelRefresh').style.display = isMyTurn ? '' : 'none';
}

// 覆写选船交互，在联机模式下同步
var _origToggleSelection = null;
var _origConfirmSelection = null;
var _origSkipSelection = null;
var _origRefreshOptions = null;

function mpInstallSelectionHooks() {
  _origToggleSelection = toggleShipSelection;
  _origConfirmSelection = confirmSelection;
  _origSkipSelection = skipSelection;
  _origRefreshOptions = refreshShipOptions;

  toggleShipSelection = function(shipIndex) {
    if (!mpGameStarted && !mpIsHost && mpRoom === null) { _origToggleSelection(shipIndex); return; }
    if (mpCurrentSelectionPlayer !== mpPlayerIndex) return;
    _origToggleSelection(shipIndex);
    // 同步选择状态
    mpSocket.send(JSON.stringify({
      type: 'selectionUpdate',
      gold: shipSelectionState.gold,
      selectedIndices: shipSelectionState.selectedIndices.slice()
    }));
  };

  confirmSelection = function() {
    if (!mpGameStarted && !mpIsHost && mpRoom === null) { _origConfirmSelection(); return; }
    if (mpCurrentSelectionPlayer !== mpPlayerIndex) return;
    var picks = shipSelectionState.selectedIndices.map(function(i) {
      return shipSelectionState.availableShips[i];
    });
    if (picks.length === 0) picks = getDefaultFleet();

    // 发送确认到对方
    mpSocket.send(JSON.stringify({
      type: 'selectionConfirmed',
      playerIdx: mpPlayerIndex,
      picks: picks
    }));

    // 本地处理
    if (mpPlayerIndex === 0) {
      shipSelectionState.redPicks = picks;
      // 红方确认后显示蓝方选船界面
      if (mpSavedBlueOptions) {
        mpShowSelection(1, mpSavedBlueOptions);
      }
    } else {
      shipSelectionState.bluePicks = picks;
      if (mpIsHost) {
      var overlay2 = document.getElementById('selectionScreen');
      overlay2.classList.add('hidden');
      overlay2.style.display = 'none';
        // 房主生成舰队位置并同步
        var fleetData = mpGenerateFleetPositions(
          shipSelectionState.redPicks,
          shipSelectionState.bluePicks
        );
        mpSocket.send(JSON.stringify({
          type: 'startGameWithFleets',
          redPicks: shipSelectionState.redPicks,
          bluePicks: shipSelectionState.bluePicks,
          fleetData: fleetData
        }));
        mpStartGameWithFleets(shipSelectionState.redPicks, shipSelectionState.bluePicks, fleetData);
      } else {
        // 客机：等待房主开战
        var selScreen = document.getElementById('selectionScreen');
        if (selScreen) {
          selScreen.innerHTML = '<div class="selection-card"><div class="selection-transition-msg">等待房主确认…</div></div>';
          selScreen.style.display = 'flex';
          selScreen.classList.remove('hidden');
        }
      }
    }
  };

  // 红方确认后的处理（客机收到时执行）
  var _origHandleConfirm = mpHandleSelectionConfirmed;
  // 这个函数会在下面重新定义

  skipSelection = function() {
    if (!mpGameStarted && !mpIsHost && mpRoom === null) { _origSkipSelection(); return; }
    if (mpCurrentSelectionPlayer !== mpPlayerIndex) return;
    confirmSelection();
  };

  refreshShipOptions = function() {
    if (!mpGameStarted && !mpIsHost && mpRoom === null) { _origRefreshOptions(); return; }
    if (mpCurrentSelectionPlayer !== mpPlayerIndex) return;
    _origRefreshOptions();
    mpSocket.send(JSON.stringify({
      type: 'selectionUpdate',
      gold: shipSelectionState.gold,
      selectedIndices: shipSelectionState.selectedIndices.slice(),
      options: shipSelectionState.availableShips
    }));
  };
}

function mpApplySelectionUpdate(msg) {
  if (mpCurrentSelectionPlayer === mpPlayerIndex) return; // 自己发出的不需要接收
  shipSelectionState.gold = msg.gold;
  shipSelectionState.selectedIndices = msg.selectedIndices.slice();
  if (msg.options) shipSelectionState.availableShips = msg.options;
  renderShipCards();
}

function mpHandleSelectionConfirmed(msg) {
  if (msg.playerIdx === 0) {
    // 红方确认：客机显示蓝方选船
    if (mpPlayerIndex !== 0) {
      shipSelectionState.redPicks = msg.picks;
      if (mpSavedBlueOptions) {
        mpShowSelection(1, mpSavedBlueOptions);
      }
    }
  } else {
    // 蓝方确认：房主生成舰队并开战
    shipSelectionState.bluePicks = msg.picks;
    if (mpIsHost) {
      var fleetData = mpGenerateFleetPositions(
        shipSelectionState.redPicks,
        shipSelectionState.bluePicks
      );
      mpSocket.send(JSON.stringify({
        type: 'startGameWithFleets',
        redPicks: shipSelectionState.redPicks,
        bluePicks: shipSelectionState.bluePicks,
        fleetData: fleetData
      }));
      mpStartGameWithFleets(shipSelectionState.redPicks, shipSelectionState.bluePicks, fleetData);
    }
  }
}

// ── 舰队位置同步（房主生成，客机接收） ──
function mpGenerateFleetPositions(redPicks, bluePicks) {
  ships = [];
  var redFleet = (redPicks && redPicks.length > 0) ? redPicks : getDefaultFleet();
  var blueFleet = (bluePicks && bluePicks.length > 0) ? bluePicks : getDefaultFleet();
  placeFleet(redFleet, 0, 0, 3, [DIR.N, DIR.E, DIR.S]);
  placeFleet(blueFleet, 1, 16, 19, [DIR.N, DIR.W, DIR.S]);
  // 用 JSON 深拷贝确保所有属性完整传递
  var fleetData = JSON.parse(JSON.stringify(ships));
  ships = [];
  return fleetData;
}

function mpStartGameWithFleets(redPicks, bluePicks, fleetData) {
  var overlay = document.getElementById('selectionScreen');
  overlay.classList.add('hidden');
  overlay.style.display = 'none';

  gameOver = false;
  sharks = [];
  playerKills = [{ ram: 0, broadside: 0, boarding: 0 }, { ram: 0, broadside: 0, boarding: 0 }];
  btnEndTurn.disabled = false;
  btnReset.disabled = false;
  btnReset.textContent = '投降';
  btnReset.classList.add('btn-surrender');
  gameMode = 'pvp';
  gameSpeed = 'classic';

  // 使用同步的舰队位置数据
  ships = [];
  if (!fleetData || fleetData.length === 0) {
    log('错误：未收到对手的舰队数据，游戏无法开始');
    return;
  }
  for (var i = 0; i < fleetData.length; i++) {
    ships.push(fleetData[i]); // fleetData 已是完整 ship 对象的深拷贝
    var s = ships[i];
    // 确保所有必要字段存在
    if (!s.boardingTargets) s.boardingTargets = [];
    if (s.braveActive === undefined) s.braveActive = false;
    if (s.submerged === undefined) s.submerged = false;
    if (s.submergedTurns === undefined) s.submergedTurns = 0;
    if (s.submergeUsed === undefined) s.submergeUsed = false;
    if (s.bowCannonUsed === undefined) s.bowCannonUsed = false;
    if (s.greekFireUsed === undefined) s.greekFireUsed = false;
    if (s.devourTarget === undefined) s.devourTarget = -1;
    if (s.devourProgress === undefined) s.devourProgress = 0;
    if (s.sharksUsed === undefined) s.sharksUsed = false;
    if (s.chargeSteps === undefined) s.chargeSteps = 0;
    if (s.maxBroadsideCount === undefined) s.maxBroadsideCount = 1;
  }

  currentPlayerIndex = 0;
  currentTurn = 1;
  selectedShipIndex = -1;
  mpGameStarted = true;

  menuScreen.classList.add('hidden');
  gameScreen.style.display = '';

  updatePlayerDisplay();
  updateInfoPanel();
  updateActionButtons();
  render();
  log('多人联机开始！你是' + (mpPlayerIndex === 0 ? '红' : '蓝') + '方。');
}

// ── 行动同步 ──
function sendAction(action) {
  if (mpSocket && mpSocket.readyState === WebSocket.OPEN) {
    action.playerIndex = currentPlayerIndex;
    mpSocket.send(JSON.stringify({ type: 'action', action: action }));
  }
}

var mpRemoteExec = false; // 远程执行中标志

function applyRemoteAction(action) {
  mpRemoteExec = true;
  // 切换为对方回合视角执行行动
  var savedPlayer = currentPlayerIndex;
  currentPlayerIndex = action.playerIndex != null ? action.playerIndex : (1 - mpPlayerIndex);

  if (action.type === 'endTurn') {
    switchToNextPlayer();
    // 不恢复 currentPlayerIndex——回合切换应永久生效
    mpRemoteExec = false;
    updateInfoPanel(); render();
    return;
  }
  if (action.shipIdx !== undefined) {
    selectedShipIndex = action.shipIdx;
  }
  if (action.type === 'move') moveShipForward();
  else if (action.type === 'turn') turnShip(action.delta);
  else if (action.type === 'broadside') fireBroadside();
  else if (action.type === 'ram') initiateRamming();
  else if (action.type === 'board') initiateBoarding();
  else if (action.type === 'skill') {
    if (action.skill === 'submerge') submergeShip();
    else if (action.skill === 'surface') surfaceShip();
    else if (action.skill === 'bowCannon') fireBowCannon();
    else if (action.skill === 'greekFire') fireGreekFire();
    else if (action.skill === 'devour') devourShip();
    else if (action.skill === 'sharks') releaseSharks();
  }
  currentPlayerIndex = savedPlayer;
  mpRemoteExec = false;
  selectedShipIndex = -1;
  updateInfoPanel();
  render();
}

// ── 投降 ──
function surrenderGame() {
  if (mpSocket && mpSocket.readyState === WebSocket.OPEN) {
    mpSocket.send(JSON.stringify({ type: 'surrender' }));
  }
  mpEndGame('你已投降，对方获得胜利');
}

function mpEndGame(msg) {
  gameOver = true;
  var pNames = ['葡萄牙帝国', '荷兰东印度公司'];
  var winnerIdx = msg.indexOf('对方') >= 0 ? (1 - mpPlayerIndex) : mpPlayerIndex;
  document.getElementById('victoryFaction').textContent = msg;
  document.getElementById('victoryTurnNum').textContent = currentTurn;
  document.getElementById('victoryShipsLeft').textContent = ships.filter(function(s) { return s.playerIndex === winnerIdx; }).length;
  document.getElementById('victoryRamKills').textContent = playerKills[winnerIdx] ? playerKills[winnerIdx].ram : 0;
  document.getElementById('victoryBroadsideKills').textContent = playerKills[winnerIdx] ? playerKills[winnerIdx].broadside : 0;
  document.getElementById('victoryBoardingKills').textContent = playerKills[winnerIdx] ? playerKills[winnerIdx].boarding : 0;
  document.getElementById('victoryOverlay').classList.remove('hidden');
  document.getElementById('victoryOverlay').style.display = 'flex';
  document.getElementById('btnEndTurn').disabled = true;
  document.getElementById('btnReset').disabled = true;
  updateInfoPanel();
  render();
}

function cleanupMultiplayer() {
  if (mpSocket) { mpSocket.close(); mpSocket = null; }
  mpRoom = null; mpPlayerIndex = -1; mpGameStarted = false; mpIsHost = false;
  btnReset.textContent = '重置';
  btnReset.classList.remove('btn-surrender');
}

// ── 事件绑定 ──
createMultiplayerUI();
mpInstallSelectionHooks();

document.getElementById('btnMulti').addEventListener('click', function() {
  mpConnect();
  menuScreen.classList.add('hidden');
  mpMenuScreen.classList.remove('hidden');
  mpMenuScreen.style.display = 'flex';
});

document.getElementById('btnMpHost').addEventListener('click', function() {
  mpPendingSend = { type: 'create' };
  if (!mpConnected || mpSocket.readyState !== WebSocket.OPEN) {
    mpConnect();
  } else {
    mpSocket.send(JSON.stringify(mpPendingSend));
    mpPendingSend = null;
  }
});

document.getElementById('btnMpJoin').addEventListener('click', function() {
  var code = document.getElementById('mpRoomInput').value.trim();
  if (!code) { mpStatus('请输入房间号', true); return; }
  mpPendingSend = { type: 'join', room: code };
  if (!mpConnected || mpSocket.readyState !== WebSocket.OPEN) {
    mpConnect();
  } else {
    mpSocket.send(JSON.stringify(mpPendingSend));
    mpPendingSend = null;
  }
});

document.getElementById('btnMpBack').addEventListener('click', function() {
  cleanupMultiplayer();
  mpMenuScreen.classList.add('hidden');
  mpMenuScreen.style.display = 'none';
  menuScreen.classList.remove('hidden');
});

document.getElementById('btnMpCancel').addEventListener('click', function() {
  cleanupMultiplayer();
  mpWaitingScreen.classList.add('hidden');
  mpWaitingScreen.style.display = 'none';
  menuScreen.classList.remove('hidden');
});
