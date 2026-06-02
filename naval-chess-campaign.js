// ═══════════════════════════════════════
//  Naval Chess — 关卡模式
//  加载顺序：第9个（依赖 famous-ships.js, ai.js）
// ═══════════════════════════════════════

// ── 关卡定义 ──
var campaignLevels = [
  { // 关卡 1
    id: 1,
    aiShips: ['努力号'], // 本关AI拥有的名船（不出现在玩家选项中）
    enemyFleet: [
      { name: '努力号', length: 3, col: 15, row: 9, direction: DIR.W,
        skill: famousShipLibrary[0].skill, skillData: famousShipLibrary[0].skillData,
        flagColor: famousShipLibrary[0].flagColor, flagShape: famousShipLibrary[0].flagShape,
        flagIcon: famousShipLibrary[0].flagIcon, flagPattern: famousShipLibrary[0].flagPattern },
      { name: '中型舰艇', length: 2, col: 15, row: 6, direction: DIR.W,
        skill: null, skillData: null },
      { name: '小型舰艇', length: 1, col: 16, row: 3, direction: DIR.W,
        skill: null, skillData: null },
      { name: '中型舰艇', length: 2, col: 15, row: 12, direction: DIR.W,
        skill: null, skillData: null },
      { name: '小型舰艇', length: 1, col: 16, row: 15, direction: DIR.W,
        skill: null, skillData: null }
    ],
    unlockShip: 0 // 通关解锁 famousShipLibrary[0] = 努力号
  },
  { // 关卡 2
    id: 2,
    aiShips: ['无畏号'],
    enemyFleet: [
      { name: '无畏号', length: 2, col: 8, row: 9, direction: DIR.W,
        skill: famousShipLibrary[4].skill, skillData: famousShipLibrary[4].skillData,
        flagColor: famousShipLibrary[4].flagColor, flagShape: famousShipLibrary[4].flagShape,
        flagIcon: famousShipLibrary[4].flagIcon, flagPattern: famousShipLibrary[4].flagPattern },
      { name: '中型舰艇', length: 2, col: 8, row: 5, direction: DIR.W,
        skill: null, skillData: null },
      { name: '大型舰艇', length: 3, col: 11, row: 7, direction: DIR.W,
        skill: null, skillData: null },
      { name: '大型舰艇', length: 3, col: 11, row: 11, direction: DIR.W,
        skill: null, skillData: null },
      { name: '中型舰艇', length: 2, col: 8, row: 13, direction: DIR.W,
        skill: null, skillData: null }
    ],
    unlockShip: 4 // 通关解锁 famousShipLibrary[4] = 无畏号
  }
];

// ── 获取本关AI拥有的名船名称列表 ──
function getLevelAiShipNames(levelId) {
  var level = campaignLevels[levelId - 1];
  return level ? level.aiShips : [];
}

// ── 过滤后的名船库（仅已解锁且不在AI手中的名船） ──
function getCampaignFamousPool(levelId) {
  var aiNames = getLevelAiShipNames(levelId);
  var pool = [];
  for (var i = 0; i < campaignUnlockedShips.length; i++) {
    var shipIdx = campaignUnlockedShips[i];
    var ship = famousShipLibrary[shipIdx];
    if (aiNames.indexOf(ship.name) < 0) {
      pool.push(ship);
    }
  }
  return pool;
}

// ── 关卡选船：生成9个选项 ──
function generateCampaignShipOptions(levelId) {
  var famousPool = getCampaignFamousPool(levelId).slice(); // 可用的名船池
  var options = [];
  var normalId = 1;

  for (var i = 0; i < 9; i++) {
    var roll = Math.random();
    if (roll < 0.25 && famousPool.length > 0) {
      var fs = famousPool.shift();
      options.push({
        name: fs.name, length: fs.length, price: fs.price,
        skill: fs.skill, skillData: fs.skillData,
        flagColor: fs.flagColor, flagShape: fs.flagShape,
        flagIcon: fs.flagIcon, flagPattern: fs.flagPattern,
        isFamous: true
      });
    } else if (roll < 0.55) {
      options.push({
        name: '小型舰艇 ' + normalId, length: 1, price: 2,
        skill: null, skillData: null, isFamous: false
      });
      normalId++;
    } else if (roll < 0.80) {
      options.push({
        name: '中型舰艇 ' + normalId, length: 2, price: 3,
        skill: null, skillData: null, isFamous: false
      });
      normalId++;
    } else {
      options.push({
        name: '大型舰艇 ' + normalId, length: 3, price: 4,
        skill: null, skillData: null, isFamous: false
      });
      normalId++;
    }
  }

  return options;
}

// ── 入口：开始关卡 ──
function startCampaignLevel(levelId) {
  inCampaign = true;
  campaignLevelId = levelId;
  gameMode = 'ai'; // 沿用AI对战框架

  // 隐藏关卡选择界面
  var cs = document.getElementById('campaignScreen');
  cs.classList.add('hidden');
  cs.style.display = 'none';

  // 生成选船选项
  shipSelectionState.currentPlayer = 0;
  shipSelectionState.gold = 15;
  shipSelectionState.selectedIndices = [];
  shipSelectionState.availableShips = generateCampaignShipOptions(levelId);
  shipSelectionState.redPicks = [];
  shipSelectionState.bluePicks = [];

  showSelectionOverlay();
}

// ── 初始化关卡战斗 ──
function initCampaignGame(redPicks) {
  gameOver = false;
  sharks = [];
  playerKills = [{ ram: 0, broadside: 0, boarding: 0 }, { ram: 0, broadside: 0, boarding: 0 }];
  btnEndTurn.disabled = false;
  btnReset.disabled = false;
  ships = [];
  var level = campaignLevels[campaignLevelId - 1];

  // 电脑舰队先部署（固定位置），确保后续玩家随机放置不会重叠
  var blueFleet = level.enemyFleet;
  for (var i = 0; i < blueFleet.length; i++) {
    var def = blueFleet[i];
    var shipObj = {
      col: def.col, row: def.row, length: def.length, direction: def.direction,
      playerIndex: 1, hp: def.length, maxHp: def.length,
      actionsRemaining: 3, maxActions: 3,
      boardingTargets: [], stepsMoved: 0, chargeSteps: 0,
      broadsideCount: 0, maxBroadsideCount: def.skillData && def.skillData.turtleShip ? 0 : 1,
      name: def.name || null, skill: def.skill || null,
      skillData: def.skillData || null,
      flagColor: def.flagColor || null, flagShape: def.flagShape || null,
      flagIcon: def.flagIcon || null, flagPattern: def.flagPattern || null,
      braveActive: false,
      submerged: false, submergedTurns: 0, submergeUsed: false,
      bowCannonUsed: false, greekFireUsed: false,
      devourTarget: -1, devourProgress: 0, sharksUsed: false, minesPlaced: 0, ironArmorMoves: 0, supplyUsed: 0
    };
    // 应用名船技能
    if (def.skillData) {
      var sd = def.skillData;
      if (sd.sturdy) { shipObj.maxHp = def.length + 1; shipObj.hp = shipObj.maxHp; }
      if (sd.speedy) { shipObj.maxActions = 4; shipObj.actionsRemaining = 4; }
      if (sd.extraBroadside) shipObj.maxBroadsideCount = 2;
    }
    ships.push(shipObj);
  }

  // 玩家舰队随机部署（此时敌舰已存在，placeFleet 的 isCellOccupied 会避开）
  var redFleet = (redPicks && redPicks.length > 0) ? redPicks : getDefaultFleet();
  if (campaignLevelId >= 2) {
    placeFleet(redFleet, 0, 5, 10, [DIR.N, DIR.E, DIR.S], 6, 15);
  } else {
    placeFleet(redFleet, 0, 0, 3, [DIR.N, DIR.E, DIR.S]);
  }

  log('关卡 ' + campaignLevelId + '：迎战 ' + level.enemyFleet[0].name + '！');
  log('敌军就位。红方 ' + redFleet.length + ' 艘舰船部署完毕。');

  selectedShipIndex = -1;
  currentPlayerIndex = 0;
  currentTurn = 1;
  updatePlayerDisplay();
  updateInfoPanel();
  updateActionButtons();
  render();
}

// ── 关卡通关处理 ──
var _pendingUnlockShip = null; // 待显示的名船解锁信息

function completeCurrentLevel() {
  var level = campaignLevels[campaignLevelId - 1];
  var isNew = campaignCompletedLevels.indexOf(campaignLevelId) < 0;
  if (isNew) {
    campaignCompletedLevels.push(campaignLevelId);
  }
  if (level.unlockShip !== undefined && campaignUnlockedShips.indexOf(level.unlockShip) < 0) {
    campaignUnlockedShips.push(level.unlockShip);
    _pendingUnlockShip = famousShipLibrary[level.unlockShip]; // 延迟到结算窗口之后显示
  }
  updateCampaignLevelButtons();
  // 注意：inCampaign 在胜利返回菜单时才重置，保持胜利界面正常路由
}

// ── 显示名船解锁提示（结算窗口之后调用） ──
function showPendingUnlock() {
  if (!_pendingUnlockShip) return false;
  var ship = _pendingUnlockShip;
  var typeNames = { 1: '小型舰船', 2: '中型舰船', 3: '大型舰船' };
  document.getElementById('unlockShipName').textContent = ship.name;
  document.getElementById('unlockShipType').textContent = typeNames[ship.length] + ' · ' + ship.price + ' 费';
  document.getElementById('unlockFlag').innerHTML = getFlagSVG(ship);
  document.getElementById('unlockShipSkill').innerHTML = ship.skill.replace(/\n/g, '<br>');
  var overlay = document.getElementById('unlockOverlay');
  overlay.classList.remove('hidden');
  _pendingUnlockShip = null;
  return true;
}

// ── 刷新关卡按钮状态 ──
function updateCampaignLevelButtons() {
  for (var i = 0; i < campaignLevels.length; i++) {
    var btn = document.getElementById('lvl' + (i + 1));
    if (!btn) continue;
    btn.classList.remove('locked');
    if (campaignCompletedLevels.indexOf(i + 1) >= 0) {
      btn.classList.add('completed');
    }
  }
}

// ── 刷新名船库界面 ──
function updateLibraryDisplay() {
  var grid = document.getElementById('libraryGrid');
  if (!grid) return;
  var html = '';
  for (var i = 0; i < famousShipLibrary.length; i++) {
    var ship = famousShipLibrary[i];
    var unlocked = campaignUnlockedShips.indexOf(i) >= 0;
    html += '<div class="library-ship' + (unlocked ? ' unlocked' : ' locked') + '">';
    if (unlocked) {
      var typeNames = { 1: '小型舰船', 2: '中型舰船', 3: '大型舰船' };
      html += '<div class="lib-ship-flag">' + getFlagSVG(ship) + '</div>';
      html += '<div class="lib-ship-name">' + ship.name + '</div>';
      html += '<div class="lib-ship-type">' + typeNames[ship.length] + ' · ' + ship.price + ' 费</div>';
      html += '<div class="lib-ship-skill">' + ship.skill.replace(/\n/g, '<br>') + '</div>';
    } else {
      html += '<div class="lib-ship-icon">?</div>';
      html += '<div class="lib-ship-name">???</div>';
    }
    html += '</div>';
  }
  grid.innerHTML = html;
}

// ── 绑定关卡按钮 ──
for (var li = 0; li < campaignLevels.length; li++) {
  var lvlBtn = document.getElementById('lvl' + (li + 1));
  if (lvlBtn) {
    lvlBtn.addEventListener('click', (function(id) {
      return function() { startCampaignLevel(id); };
    })(li + 1));
  }
}

// 初始化时刷新关卡和名船库
updateCampaignLevelButtons();
updateLibraryDisplay();
