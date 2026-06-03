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
var mpGameSpeed = 'classic'; // 联机模式速度
var mpWaitingForTurnSwitch = false; // 等待服务器确认回合切换
var mpTurnSwitchTimer = null; // 回合切换超时重试定时器
var mpPingTimer = null; // 心跳定时器

// 联机服务器地址：本地测试用 localhost，部署后替换为 Render 地址
// file:// 协议或本地访问 → 连本地服务器；否则连生产环境
var MP_SERVER = (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
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
      '<div class="menu-items hidden" id="mpModeSelect">' +
        '<div class="menu-subtitle" style="margin-bottom:12px;">选择房间模式</div>' +
        '<button class="menu-item" id="btnMpClassic">经典模式</button>' +
        '<button class="menu-item" id="btnMpSpeed">极速模式</button>' +
      '</div>' +
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

// ── 回合切换通知 ──
function mpShowTurnNotification() {
  var existing = document.getElementById('turnNotification');
  if (existing) existing.remove();
  var toast = document.createElement('div');
  toast.id = 'turnNotification';
  toast.className = 'turn-notification';
  toast.textContent = '对方回合结束，轮到你的回合';
  document.body.appendChild(toast);
  setTimeout(function() {
    if (toast.parentNode) toast.remove();
  }, 2600);
}

// ── WebSocket ──
function mpConnect() {
  if (mpSocket) { mpSocket.close(); }
  console.log('[MP] 连接目标:', MP_SERVER);
  mpStatus('正在连接服务器…');
  mpSocket = new WebSocket(MP_SERVER);
  mpSocket.onopen = function() {
    mpConnected = true;
    mpStatus('已连接 ✓');
    if (mpPendingSend) {
      mpSocket.send(JSON.stringify(mpPendingSend));
      mpPendingSend = null;
    }
    // 启动心跳（每12秒发送ping，防止 Render/负载均衡器空闲断开）
    clearInterval(mpPingTimer);
    mpPingTimer = setInterval(function() {
      if (mpSocket && mpSocket.readyState === WebSocket.OPEN) {
        mpSocket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 12000);
  };
  mpSocket.onmessage = function(e) {
    try {
      var msg = JSON.parse(e.data);
      handleServerMessage(msg);
    } catch (err) {
      console.error('[MP] 消息处理异常:', err);
    }
  };
  mpSocket.onclose = function() {
    mpConnected = false;
    mpStatus('连接已断开', true);
    clearInterval(mpPingTimer);
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

    case 'endTurn':
      // 兼容旧版服务器：endTurn 仍作为顶层消息中继
      mpWaitingForTurnSwitch = false;
      clearTimeout(mpTurnSwitchTimer);
      if (mpGameStarted && !gameOver) {
        switchToNextPlayer();
        selectedShipIndex = -1;
        btnEndTurn.disabled = false;
        updateInfoPanel();
        render();
      }
      break;

    case 'turnSwitched':
      // 新版服务器：权威回合切换（双方都收到）
      mpWaitingForTurnSwitch = false;
      clearTimeout(mpTurnSwitchTimer);
      if (mpGameStarted && !gameOver) {
        switchToNextPlayer();
        selectedShipIndex = -1;
        btnEndTurn.disabled = false;
        updateInfoPanel();
        render();
        if (mpPlayerIndex === currentPlayerIndex) {
          mpShowTurnNotification();
        } else {
          log('对方回合，请等待');
        }
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

    case 'actionRejected':
      log('[服务器] 行动被拒绝: ' + (msg.reason || '未知原因'));
      mpWaitingForTurnSwitch = false;
      clearTimeout(mpTurnSwitchTimer);
      btnEndTurn.disabled = false;
      if (msg.currentTurn !== undefined && mpPlayerIndex === msg.currentTurn) {
        // 服务器说现在是我们回合，但本地还没切换（turnSwitched 可能丢失）
        if (currentPlayerIndex !== msg.currentTurn) {
          log('[服务器] 回合状态不同步，正在自动修复…');
          switchToNextPlayer();
          updateInfoPanel();
          render();
        }
      }
      break;

    case 'roomClosed':
      mpWaitingForTurnSwitch = false;
      clearTimeout(mpTurnSwitchTimer);
      mpGameStarted = false;
      gameOver = true;
      mpStatus('房间已关闭: ' + (msg.reason || '未知原因'), true);
      log('连接已断开，房间已关闭');
      break;

    case 'pong':
      // 心跳响应，无需处理
      break;

    case 'error':
      mpStatus(msg.message, true);
      break;
  }
}

// ── 选船同步 ──
function mpGenerateAndSyncSelection() {
  // 红方：全体名船
  redSelectedFamousNames = [];
  shipSelectionState.famousPool = famousShipLibrary.slice().sort(function() { return Math.random() - 0.5; });
  var redOptions = generateShipOptions();
  // 蓝方暂不生成，等红方确认后再根据其选择生成
  var blueOptions = null;

  // 房主本地保存双方选项
  mpSavedRedOptions = redOptions;
  mpSavedBlueOptions = blueOptions;

  // 发送红方选项给客机
  mpSocket.send(JSON.stringify({
    type: 'selectionData',
    redOptions: redOptions,
    blueOptions: null,
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
  if (!msg.redOptions) {
    mpStatus('选船数据异常，请重试', true);
    return;
  }
  mpSavedRedOptions = msg.redOptions;
  if (msg.blueOptions) mpSavedBlueOptions = msg.blueOptions;
  var opts = msg.currentPlayer === 1 && msg.blueOptions ? msg.blueOptions : msg.redOptions;
  mpShowSelection(msg.currentPlayer || 0, opts);
}

var mpSavedRedOptions = null;
var mpSavedBlueOptions = null;
var mpCurrentSelectionPlayer = -1;

function mpShowSelection(playerIdx, options) {
  if (!options || options.length === 0) {
    mpStatus('选船数据为空，请重试', true);
    return;
  }
  mpCurrentSelectionPlayer = playerIdx;
  shipSelectionState.currentPlayer = playerIdx;
  shipSelectionState.gold = 15;
  shipSelectionState.selectedIndices = [];
  shipSelectionState.availableShips = options;
  // 设置正确的名船池以便刷新时重新生成选项
  if (playerIdx === 0) {
    shipSelectionState.famousPool = famousShipLibrary.slice().sort(function() { return Math.random() - 0.5; });
  } else {
    shipSelectionState.famousPool = famousShipLibrary.slice().filter(function(s) {
      return redSelectedFamousNames.indexOf(s.name) < 0;
    });
  }

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
      redSelectedFamousNames = picks.filter(function(p) { return p.isFamous; }).map(function(p) { return p.name; });
      // 生成蓝方选项（排除红方已选名船）
      shipSelectionState.famousPool = famousShipLibrary.slice().sort(function() { return Math.random() - 0.5; })
        .filter(function(s) { return redSelectedFamousNames.indexOf(s.name) < 0; });
      var blueOpts = generateShipOptions();
      mpSavedBlueOptions = blueOpts;
      // 同步蓝方选项到客机
      mpSocket.send(JSON.stringify({ type: 'selectionData', redOptions: mpSavedRedOptions, blueOptions: blueOpts, currentPlayer: 1 }));
      mpShowSelection(1, blueOpts);
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
    // 红方确认：双方都要记录红方选中的名船，以便蓝方刷新时正确排除
    shipSelectionState.redPicks = msg.picks;
    redSelectedFamousNames = msg.picks.filter(function(p) { return p.isFamous; }).map(function(p) { return p.name; });
    // 客机显示蓝方选船
    if (mpPlayerIndex !== 0) {
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
  if (mpGameSpeed === 'speed') {
    placeFleet(redFleet, 0, 5, 10, [DIR.N, DIR.E, DIR.S], 6, 15);
    placeFleet(blueFleet, 1, 9, 14, [DIR.N, DIR.W, DIR.S], 6, 15);
  } else {
    placeFleet(redFleet, 0, 0, 3, [DIR.N, DIR.E, DIR.S]);
    placeFleet(blueFleet, 1, 16, 19, [DIR.N, DIR.W, DIR.S]);
  }
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

function sendEndTurn() {
  if (mpSocket && mpSocket.readyState === WebSocket.OPEN) {
    mpSocket.send(JSON.stringify({ type: 'endTurn' }));
    return true;
  }
  return false;
}

// 设置回合切换等待状态，带超时自动重试
function mpWaitForTurnSwitch() {
  mpWaitingForTurnSwitch = true;
  btnEndTurn.disabled = true;
  clearTimeout(mpTurnSwitchTimer);
  mpTurnSwitchTimer = setTimeout(function() {
    if (mpWaitingForTurnSwitch && mpGameStarted && !gameOver) {
      log('[联机] 未收到服务器确认，正在重新发送…');
      if (sendEndTurn()) {
        // 重新设置超时
        mpTurnSwitchTimer = setTimeout(function() {
          if (mpWaitingForTurnSwitch && mpGameStarted && !gameOver) {
            log('[联机] 服务器无响应，请检查连接后重试');
            mpWaitingForTurnSwitch = false;
            btnEndTurn.disabled = false;
          }
        }, 3000);
      } else {
        log('[联机] 无法发送消息，连接已断开');
        mpWaitingForTurnSwitch = false;
        btnEndTurn.disabled = false;
      }
    }
  }, 3000);
}

var mpRemoteExec = false; // 远程执行中标志

function applyRemoteAction(action) {
  mpRemoteExec = true;
  var savedPlayer = currentPlayerIndex;
  var savedSelection = selectedShipIndex; // 保存本地玩家的选中状态
  currentPlayerIndex = action.playerIndex != null ? action.playerIndex : (1 - mpPlayerIndex);

  // 对方结束回合：兼容旧版代码（endTurn 通过 action 中继）和自动耗尽场景
  if (action.type === 'endTurn') {
    mpWaitingForTurnSwitch = false;
    clearTimeout(mpTurnSwitchTimer);
    switchToNextPlayer();
    mpRemoteExec = false;
    selectedShipIndex = savedSelection;
    btnEndTurn.disabled = false;
    if (mpPlayerIndex === currentPlayerIndex) {
      mpShowTurnNotification();
    }
    render();
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
  selectedShipIndex = savedSelection; // 恢复本地玩家的选中状态
  // 刷新棋盘但不动信息面板
  render();
}

// ── 投降 ──
function surrenderGame() {
  if (mpSocket && mpSocket.readyState === WebSocket.OPEN) {
    mpSocket.send(JSON.stringify({ type: 'surrender' }));
    mpEndGame('你已投降，对方获得胜利');
  } else {
    mpEndGame('连接已断开，游戏终止');
  }
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
  clearTimeout(mpTurnSwitchTimer);
  clearInterval(mpPingTimer);
  mpWaitingForTurnSwitch = false;
  if (mpSocket) { mpSocket.close(); mpSocket = null; }
  mpRoom = null; mpPlayerIndex = -1; mpGameStarted = false; mpIsHost = false;
  btnReset.textContent = '重置';
  btnReset.classList.remove('btn-surrender');
}

// ── 事件绑定 ──
createMultiplayerUI();
mpInstallSelectionHooks();

function mpResetMenuState() {
  document.getElementById('mpModeSelect').classList.add('hidden');
  document.getElementById('btnMpHost').style.display = '';
  document.getElementById('btnMpJoin').style.display = '';
  var input = document.querySelector('#mpMenuScreen .mp-room-input');
  if (input) input.style.display = '';
}

document.getElementById('btnMulti').addEventListener('click', function() {
  mpConnect();
  mpResetMenuState();
  menuScreen.classList.add('hidden');
  mpMenuScreen.classList.remove('hidden');
  mpMenuScreen.style.display = 'flex';
});

document.getElementById('btnMpHost').addEventListener('click', function() {
  document.getElementById('mpModeSelect').classList.remove('hidden');
  document.getElementById('btnMpHost').style.display = 'none';
  document.getElementById('btnMpJoin').style.display = 'none';
  document.querySelector('#mpMenuScreen .mp-room-input').style.display = 'none';
});

function mpCreateRoom() {
  mpPendingSend = { type: 'create', speed: mpGameSpeed };
  if (!mpConnected || mpSocket.readyState !== WebSocket.OPEN) {
    mpConnect();
  } else {
    mpSocket.send(JSON.stringify(mpPendingSend));
    mpPendingSend = null;
  }
}

document.getElementById('btnMpClassic').addEventListener('click', function() {
  mpGameSpeed = 'classic';
  mpCreateRoom();
});

document.getElementById('btnMpSpeed').addEventListener('click', function() {
  mpGameSpeed = 'speed';
  mpCreateRoom();
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
  // 如果在模式选择子页面，只返回到联机主页面
  var modeSelect = document.getElementById('mpModeSelect');
  if (!modeSelect.classList.contains('hidden')) {
    mpResetMenuState();
    return;
  }
  cleanupMultiplayer();
  mpMenuScreen.classList.add('hidden');
  mpMenuScreen.style.display = 'none';
  menuScreen.classList.remove('hidden');
});

document.getElementById('btnMpCancel').addEventListener('click', function() {
  cleanupMultiplayer();
  mpWaitingScreen.classList.add('hidden');
  mpWaitingScreen.style.display = 'none';
  mpResetMenuState();
  mpMenuScreen.classList.remove('hidden');
  mpMenuScreen.style.display = 'flex';
});
