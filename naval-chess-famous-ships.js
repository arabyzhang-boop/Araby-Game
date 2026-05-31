// ═══════════════════════════════════════
//  Naval Chess — 名船系统（选船界面 & 名船库）
//  加载顺序：第8个（依赖 config, utils, ui, fleet）
// ═══════════════════════════════════════

// ── 名船库 ──
var famousShipLibrary = [
  {
    name: "努力号",
    length: 3,
    price: 7,
    skill: "坚固：生命+1\n火力充足：舷炮可使用两次",
    skillData: { sturdy: true, extraBroadside: true },
    flagColor: '#f1c40f', flagShape: 'banner', flagIcon: 'cross', flagPattern: '#8b6914'
  },
  {
    name: "黑珍珠号",
    length: 2,
    price: 5,
    skill: "疾速：每回合行动次数+1",
    skillData: { speedy: true },
    flagColor: '#1a1008', flagShape: 'pennant', flagIcon: 'dot', flagPattern: '#ecf0f1'
  },
  {
    name: "飞翔荷兰人号",
    length: 2,
    price: 5,
    skill: "下潜：消耗1行动力进入下潜状态（无法选中/可穿过船只，最多3回合），可消耗1行动力上浮（若被阻挡则双方受到等量HP伤害），全局1次\n三联炮：船头炮射程3伤害1，消耗1行动力，全局1次",
    skillData: { canSubmerge: true, canBowCannon: true },
    flagColor: '#2ecc71', flagShape: 'swallowtail', flagIcon: 'wave', flagPattern: '#0e5e2e'
  },
  {
    name: "垂死海鸥号",
    length: 1,
    price: 3,
    skill: "隐蔽：未与敌方棋子接触时，无法被火炮命中",
    skillData: { stealth: true },
    flagColor: '#bdc3c7', flagShape: 'pennant', flagIcon: 'chevron', flagPattern: '#5d6d7e'
  },
  {
    name: "无畏号",
    length: 2,
    price: 5,
    skill: "英勇：接舷战时，免疫第一次受到的接舷伤害",
    skillData: { brave: true },
    flagColor: '#e74c3c', flagShape: 'banner', flagIcon: 'diamond', flagPattern: '#f9ebea'
  },
  {
    name: "安妮女王复仇号",
    length: 2,
    price: 5,
    skill: "黑魔法之船：无法被主动接舷\n希腊火：船头火焰射程2伤害1，消耗1行动力，全局1次，无自伤",
    skillData: { cursed: true, canGreekFire: true },
    flagColor: '#9b59b6', flagShape: 'swallowtail', flagIcon: 'slash', flagPattern: '#f1c40f'
  },
  {
    name: "沉默玛丽号",
    length: 3,
    price: 6,
    skill: "船首吞噬：船头边接触敌方棋子时可使用，消耗本回合所有行动力（至少1点），增加一点吞噬进度，当吞噬进度等于对方棋子体积时，直接压沉该棋子。船头边脱离对方船舷边时吞噬被打断，吞噬进度归0\n僵尸鲨鱼：从船中格两侧各释放1只鲨鱼，每回合结束时鲨鱼沿直线移动1格，撞击任意船只造成1点伤害并消失，全局1次",
    skillData: { canDevour: true, canReleaseSharks: true },
    flagColor: '#d5d0c8', flagShape: 'swallowtail', flagIcon: 'eyes', flagPattern: '#5d4e37'
  },
  {
    name: "诡计号",
    length: 1,
    price: 3,
    skill: "殉爆：被击沉时对周围3×3区域内所有船只造成1点伤害",
    skillData: { deathBlast: true },
    flagColor: '#e67e22', flagShape: 'pennant', flagIcon: 'bang', flagPattern: '#1a1008'
  }
];

// ── 当前对局的名船选择 ──
var activeGamePicks = { red: [], blue: [] };

// ── 全局洗牌结果（确保红蓝双方无重叠） ──
var shuffledFamousLibrary = [];

// ── 选船临时状态 ──
var shipSelectionState = {
  currentPlayer: 0,
  availableShips: [],      // 10 个随机生成的选项
  selectedIndices: [],     // 玩家选中的选项索引
  gold: 15,                // 预算
  redPicks: [],
  bluePicks: []
};

// ── 生成默认舰队（跳过选船时使用） ──
function getDefaultFleet() {
  return [
    { name: '大型舰艇', length: 3, price: 4, skill: null, skillData: null, isFamous: false },
    { name: '中型舰艇 A', length: 2, price: 3, skill: null, skillData: null, isFamous: false },
    { name: '中型舰艇 B', length: 2, price: 3, skill: null, skillData: null, isFamous: false },
    { name: '小型舰艇 A', length: 1, price: 2, skill: null, skillData: null, isFamous: false },
    { name: '小型舰艇 B', length: 1, price: 2, skill: null, skillData: null, isFamous: false }
  ];
}

// ── 为玩家生成 9 个随机船只选项 ──
function generateShipOptions() {
  var famousPool = shipSelectionState.famousPool.slice(); // 每次刷新使用全新副本
  var options = [];
  var normalId = 1;

  for (var i = 0; i < 9; i++) {
    var roll = Math.random();
    if (roll < 0.25 && famousPool.length > 0) {
      // 25% 名船
      var fs = famousPool.shift();
      options.push({
        name: fs.name,
        length: fs.length,
        price: fs.price,
        skill: fs.skill,
        skillData: fs.skillData,
        flagColor: fs.flagColor,
        flagShape: fs.flagShape,
        flagIcon: fs.flagIcon,
        flagPattern: fs.flagPattern,
        isFamous: true
      });
    } else if (roll < 0.55) {
      // 30% 普通小型舰艇（1格，1费）
      options.push({
        name: '小型舰艇 ' + normalId,
        length: 1,
        price: 2,
        skill: null,
        skillData: null,
        isFamous: false
      });
      normalId++;
    } else if (roll < 0.80) {
      // 25% 普通中型舰艇（2格，3费）
      options.push({
        name: '中型舰艇 ' + normalId,
        length: 2,
        price: 3,
        skill: null,
        skillData: null,
        isFamous: false
      });
      normalId++;
    } else {
      // 20% 普通大型舰艇（3格，4费）
      options.push({
        name: '大型舰艇 ' + normalId,
        length: 3,
        price: 4,
        skill: null,
        skillData: null,
        isFamous: false
      });
      normalId++;
    }
  }

  return options;
}

// ── 刷新选船选项（消耗1费） ──
function refreshShipOptions() {
  if (shipSelectionState.gold < 1) { log('金币不足，无法刷新'); return; }
  shipSelectionState.gold -= 1;
  shipSelectionState.selectedIndices = [];
  shipSelectionState.availableShips = inCampaign
    ? generateCampaignShipOptions(campaignLevelId)
    : generateShipOptions();
  renderShipCards();
}

// ── 入口：开始选船流程 ──
function startShipSelection(playerIndex) {
  // 红方时洗牌名船库，平分给双方
  if (playerIndex === 0) {
    shuffledFamousLibrary = famousShipLibrary.slice().sort(function() { return Math.random() - 0.5; });
  }
  var half = Math.ceil(shuffledFamousLibrary.length / 2);
  var famousPool = playerIndex === 0
    ? shuffledFamousLibrary.slice(0, half)
    : shuffledFamousLibrary.slice(half);

  shipSelectionState.currentPlayer = playerIndex;
  shipSelectionState.gold = 15;
  shipSelectionState.selectedIndices = [];
  shipSelectionState.famousPool = famousPool;
  shipSelectionState.availableShips = generateShipOptions();

  showSelectionOverlay();
}

// ── 检查某艘船是否可选（仅检查金币） ──
function canSelectShip(shipIndex) {
  if (shipSelectionState.selectedIndices.indexOf(shipIndex) >= 0) return true;
  var ship = shipSelectionState.availableShips[shipIndex];
  return shipSelectionState.gold >= ship.price;
}

// ── 切换选中/取消选中某艘船 ──
function toggleShipSelection(shipIndex) {
  var idx = shipSelectionState.selectedIndices.indexOf(shipIndex);
  if (idx >= 0) {
    shipSelectionState.selectedIndices.splice(idx, 1);
    shipSelectionState.gold += shipSelectionState.availableShips[shipIndex].price;
  } else {
    if (!canSelectShip(shipIndex)) return;
    shipSelectionState.selectedIndices.push(shipIndex);
    shipSelectionState.gold -= shipSelectionState.availableShips[shipIndex].price;
  }
  renderShipCards();
}

// ── 确认选择 ──
function confirmSelection() {
  var picks = shipSelectionState.selectedIndices.map(function(i) {
    return shipSelectionState.availableShips[i];
  });

  if (picks.length === 0) {
    // 未选择任何船只，使用默认舰队
    picks = getDefaultFleet();
  }

  if (shipSelectionState.currentPlayer === 0) {
    shipSelectionState.redPicks = picks;
    if (inCampaign) {
      // 关卡模式：直接开始战斗（AI舰队已预设）
      hideSelectionOverlay();
      menuScreen.classList.add('hidden');
      gameScreen.style.display = '';
      initCampaignGame(picks);
    } else {
      startShipSelection(1);
    }
  } else {
    shipSelectionState.bluePicks = picks;
    activeGamePicks = { red: shipSelectionState.redPicks, blue: picks };
    hideSelectionOverlay();
    startGame();
  }
}

// ── 跳过不选（使用默认舰队）/ 人机模式电脑选船 ──
function skipSelection() {
  var picks = getDefaultFleet();

  if (shipSelectionState.currentPlayer === 0) {
    shipSelectionState.redPicks = picks;
    if (inCampaign) {
      hideSelectionOverlay();
      menuScreen.classList.add('hidden');
      gameScreen.style.display = '';
      initCampaignGame(picks);
    } else {
      startShipSelection(1);
    }
  } else {
    if (gameMode === 'ai') {
      // 人机模式蓝方：玩家点击"电脑选船"触发AI自动选船
      aiAutoSelect();
    } else {
      shipSelectionState.bluePicks = picks;
      activeGamePicks = { red: shipSelectionState.redPicks, blue: picks };
      hideSelectionOverlay();
      startGame();
    }
  }
}

// ── 显示选船遮罩 ──
function showSelectionOverlay() {
  var overlay = document.getElementById('selectionScreen');
  var title = document.getElementById('selTitle');
  title.textContent = shipSelectionState.currentPlayer === 0
    ? '红方选船 — 葡萄牙帝国'
    : '蓝方选船 — 荷兰东印度公司';

  // 人机模式蓝方选船时，"跳过不选"改为"电脑选船"
  var skipBtn = document.getElementById('btnSelSkip');
  if (gameMode === 'ai' && shipSelectionState.currentPlayer === 1) {
    skipBtn.textContent = '电脑选船';
  } else {
    skipBtn.textContent = '跳过不选';
  }

  menuScreen.classList.add('hidden');
  overlay.classList.remove('hidden');
  overlay.style.display = 'flex';
  renderShipCards();
}

// ── 隐藏选船遮罩 ──
function hideSelectionOverlay() {
  var overlay = document.getElementById('selectionScreen');
  overlay.classList.add('hidden');
  overlay.style.display = 'none';
}

// ── 旗帜 SVG 图标（竖直：旗杆在左，旗帜向右展开） ──
function getFlagSVG(ship) {
  if (!ship.flagColor) return '';
  var fc = ship.flagColor;
  var fp = ship.flagPattern || '#1a1008';
  var s = '<svg width="18" height="16" viewBox="0 0 18 16" style="vertical-align:middle;margin-left:2px;">';
  // 旗杆（左侧竖线）
  s += '<line x1="2" y1="2" x2="2" y2="14" stroke="#1a1008" stroke-width="1.1"/>';
  // 旗帜形状（向右展开）
  if (ship.flagShape === 'banner') {
    s += '<rect x="2" y="3" width="10" height="8" fill="' + fc + '" stroke="rgba(0,0,0,0.2)" stroke-width="0.4"/>';
  } else if (ship.flagShape === 'swallowtail') {
    s += '<polygon points="2,3 2,11 12,11 12,9 10,7 12,5 12,3" fill="' + fc + '" stroke="rgba(0,0,0,0.2)" stroke-width="0.4"/>';
  } else {
    s += '<polygon points="2,2.5 2,12.5 14,7.5" fill="' + fc + '" stroke="rgba(0,0,0,0.2)" stroke-width="0.4"/>';
  }
  // 辨识图案（旗帜中心 ~ cx=7, cy=7）
  var cx = 7, cy = 7;
  if (ship.flagIcon === 'cross') {
    s += '<line x1="5" y1="' + cy + '" x2="9" y2="' + cy + '" stroke="' + fp + '" stroke-width="0.9"/>';
    s += '<line x1="' + cx + '" y1="5" x2="' + cx + '" y2="9" stroke="' + fp + '" stroke-width="0.9"/>';
  } else if (ship.flagIcon === 'dot') {
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="2.2" fill="' + fp + '"/>';
  } else if (ship.flagIcon === 'wave') {
    s += '<path d="M4.5,5.5 Q' + cx + ',3.5 9.5,5.5" fill="none" stroke="' + fp + '" stroke-width="0.8"/>';
    s += '<path d="M4.5,8.5 Q' + cx + ',6.5 9.5,8.5" fill="none" stroke="' + fp + '" stroke-width="0.8"/>';
  } else if (ship.flagIcon === 'chevron') {
    s += '<polyline points="5,5 ' + cx + ',8 9,5" fill="none" stroke="' + fp + '" stroke-width="0.9"/>';
  } else if (ship.flagIcon === 'diamond') {
    s += '<polygon points="' + cx + ',4 9.5,' + cy + ' ' + cx + ',10 4.5,' + cy + '" fill="' + fp + '"/>';
  } else if (ship.flagIcon === 'slash') {
    s += '<line x1="4.5" y1="9.5" x2="9.5" y2="4.5" stroke="' + fp + '" stroke-width="0.9"/>';
  } else if (ship.flagIcon === 'eyes') {
    s += '<circle cx="5.5" cy="6.5" r="1.1" fill="' + fp + '"/>';
    s += '<circle cx="8.5" cy="6.5" r="1.1" fill="' + fp + '"/>';
  } else if (ship.flagIcon === 'bang') {
    s += '<line x1="' + cx + '" y1="4.5" x2="' + cx + '" y2="8" stroke="' + fp + '" stroke-width="1"/>';
    s += '<circle cx="' + cx + '" cy="9.5" r="0.9" fill="' + fp + '"/>';
  }
  s += '</svg>';
  return s;
}

// ── 渲染船只卡片 ──
function renderShipCards() {
  var container = document.getElementById('selGrid');
  var goldEl = document.getElementById('selGold');
  goldEl.textContent = shipSelectionState.gold;

  var html = '';
  for (var i = 0; i < shipSelectionState.availableShips.length; i++) {
    var ship = shipSelectionState.availableShips[i];
    var isSelected = shipSelectionState.selectedIndices.indexOf(i) >= 0;
    var selectable = canSelectShip(i);
    var typeName = ship.length === 3 ? '大型舰' : ship.length === 2 ? '中型舰' : '小型舰';
    var sizeLabel = ship.length + ' 格 · ' + ship.price + ' 费';

    html += '<div class="ship-pick-card' + (isSelected ? ' selected' : '') + (!selectable ? ' disabled' : '') + '" onclick="toggleShipSelection(' + i + ')">';
    html += '<div class="ship-pick-header">';
    html += '<span class="ship-pick-name">' + (ship.isFamous ? '⭐ ' : '') + ship.name + getFlagSVG(ship) + '</span>';
    html += '<span class="ship-pick-price">' + ship.price + ' 费</span>';
    html += '</div>';
    html += '<div class="ship-pick-type">' + typeName + ' · ' + sizeLabel + '</div>';
    html += '</div>';
  }

  container.innerHTML = html;
}

// ── 绑定选船界面按钮 ──
document.getElementById('btnSelConfirm').addEventListener('click', function() {
  confirmSelection();
});
document.getElementById('btnSelRefresh').addEventListener('click', function() {
  refreshShipOptions();
});
document.getElementById('btnSelSkip').addEventListener('click', function() {
  skipSelection();
});
