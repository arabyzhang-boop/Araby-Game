// ═══════════════════════════════════════
//  Naval Chess — 工具函数
//  加载顺序：第2个（依赖 config.js）
// ═══════════════════════════════════════

// ── 日志 ──
function log(msg) {
  var entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = '▸ ' + msg;
  elLogArea.prepend(entry);
  while (elLogArea.children.length > 50) {
    elLogArea.removeChild(elLogArea.lastChild);
  }
}

/** 返回舰船占据的所有格子坐标（{col, row} 数组） */
function getShipCells(ship) {
  var cells = [];
  var dv = DIR_VECTORS[ship.direction];
  for (var i = 0; i < ship.length; i++) {
    cells.push({ col: ship.col + dv.dx * i, row: ship.row + dv.dy * i });
  }
  return cells;
}

/** 返回舰船在指定船头位置时占据的所有格子 */
function getShipCellsAt(ship, headCol, headRow) {
  var cells = [];
  var dv = DIR_VECTORS[ship.direction];
  for (var i = 0; i < ship.length; i++) {
    cells.push({ col: headCol + dv.dx * i, row: headRow + dv.dy * i });
  }
  return cells;
}

/** 检查某个格子是否被其他舰船占据（排除 excludeIndex，含不可通过地形） */
function isCellOccupied(col, row, excludeIndex, optShipLength) {
  if (isTerrainBlocking(col, row, optShipLength)) return true;
  return ships.some(function(ship, idx) {
    if (idx === excludeIndex) return false;
    if (ship.submerged) return false;
    return getShipCells(ship).some(function(c) { return c.col === col && c.row === row; });
  });
}

// ── 地形查询辅助 ──

/** 查找指定坐标的地形对象，无则返回 null */
function getTerrainAt(col, row) {
  for (var i = 0; i < terrain.length; i++) {
    if (terrain[i].col === col && terrain[i].row === row) return terrain[i];
  }
  return null;
}

/** 该格地形是否阻挡移动（含下潜）和鲨鱼。optShipLength 用于浅滩/中浅滩判断 */
function isTerrainBlocking(col, row, optShipLength) {
  var t = getTerrainAt(col, row);
  if (!t) return false;
  // 始终阻挡所有舰船的地形
  if (t.type === TERRAIN.MOUNTAIN || t.type === TERRAIN.SNOW_MOUNTAIN ||
      t.type === TERRAIN.LOW_ISLAND || t.type === TERRAIN.FLAG ||
      t.type === TERRAIN.SUPPLY || t.type === TERRAIN.POWDER_KEG) return true;
  return false;
}

/** 该格地形是否阻挡远程火力（仅山地/雪山） */
function isTerrainBlockingRanged(col, row) {
  var t = getTerrainAt(col, row);
  if (!t) return false;
  return t.type === TERRAIN.MOUNTAIN || t.type === TERRAIN.SNOW_MOUNTAIN;
}

/** 检查舰船在回合开始时是否处于搁浅状态 */
function isShipGrounded(ship) {
  var cells = getShipCells(ship);
  for (var i = 0; i < cells.length; i++) {
    var t = getTerrainAt(cells[i].col, cells[i].row);
    if (!t) continue;
    if (t.type === TERRAIN.SHOAL && ship.length >= 2) return true;
    if (t.type === TERRAIN.MEDIUM_SHOAL && ship.length >= 3) return true;
  }
  return false;
}

/** 回合开始时更新当前玩家所有舰船的搁浅状态 */
function updateGroundedShips() {
  for (var i = 0; i < ships.length; i++) {
    var s = ships[i];
    if (s.playerIndex === currentPlayerIndex) {
      s.grounded = isShipGrounded(s);
    }
  }
}

/** 该格是否处于云雾区内 */
function isCellInFog(col, row) {
  var t = getTerrainAt(col, row);
  return t && t.type === TERRAIN.CLOUD;
}

/** 检查一艘船的所有格子是否全部在云雾区内 */
function isShipInFog(ship) {
  if (terrain.length === 0) return false;
  var cells = getShipCells(ship);
  for (var i = 0; i < cells.length; i++) {
    if (!isCellInFog(cells[i].col, cells[i].row)) return false;
  }
  return true;
}

/** 检查给定格子列表中是否有任意格处于云雾区外 */
function hasCellOutsideFog(cells) {
  if (terrain.length === 0) return true;
  for (var i = 0; i < cells.length; i++) {
    if (!isCellInFog(cells[i].col, cells[i].row)) return true;
  }
  return false;
}

// ── 交互地形效果（占据时触发，在 afterShipAction 中调用） ──

/** 检测舰船所在格是否有交互地形，执行对应效果。返回 true 表示触发了胜利 */
function processTerrainEffects(ship) {
  if (terrain.length === 0 || !ship) return false;
  var cells = getShipCells(ship);
  var shipIdx = ships.indexOf(ship);
  var shipNameStr = shipName(shipIdx);

  for (var ci = 0; ci < cells.length; ci++) {
    var t = getTerrainAt(cells[ci].col, cells[ci].row);
    if (!t) continue;

    if (t.type === TERRAIN.FLAG) {
      gameOver = true;
      var pNames = ['葡萄牙帝国', '荷兰东印度公司'];
      document.getElementById('victoryFaction').textContent = pNames[ship.playerIndex] + ' 占领了目标点';
      document.getElementById('victoryTitle').textContent = 'VICTORY';
      document.getElementById('victoryTitle').classList.remove('defeat');
      updateVictoryStars(getStarRating(ship.playerIndex));
      var vo = document.getElementById('victoryOverlay');
      vo.classList.remove('hidden'); vo.style.display = 'flex';
      btnEndTurn.disabled = true; btnReset.disabled = true;
      log('🚩 ' + shipNameStr + ' 占据目标点，' + pNames[ship.playerIndex] + ' 获得胜利！');
      updateInfoPanel(); render();
      if (inCampaign && ship.playerIndex === 0) completeCurrentLevel(getStarRating(ship.playerIndex));
      return true;
    }

    if (t.type === TERRAIN.SUPPLY && ship.hp < ship.maxHp) {
      ship.hp++;
      addHitEffect(t.col, t.row, '❤️‍🩹');
      log(shipNameStr + ' 占据补给点，回复1点生命（' + ship.hp + '/' + ship.maxHp + '）');
      removeTerrainAt(t.col, t.row);
      render();
      break;
    }

    if (t.type === TERRAIN.POWDER_KEG && ship.broadsideCount > 0) {
      ship.broadsideCount--;
      addHitEffect(t.col, t.row, '💥');
      log(shipNameStr + ' 获得火药桶，补充一次舷炮（剩余 ' + (ship.maxBroadsideCount - ship.broadsideCount) + ' 次）');
      removeTerrainAt(t.col, t.row);
      render();
      break;
    }
  }
  return false;
}

/** 移除指定坐标的地形 */
function removeTerrainAt(col, row) {
  for (var i = 0; i < terrain.length; i++) {
    if (terrain[i].col === col && terrain[i].row === row) {
      terrain.splice(i, 1);
      return;
    }
  }
}

// ── 坐标转换 ──
function gridToPixel(col, row) {
  return { x: col * CELL_SIZE, y: row * CELL_SIZE };
}

function pixelToGrid(px, py) {
  var col = Math.floor(px / CELL_SIZE);
  var row = Math.floor(py / CELL_SIZE);
  if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null;
  return { col: col, row: row };
}

// ── 查找特定格子上的舰船索引 ──
function findShipAt(col, row) {
  for (var j = 0; j < ships.length; j++) {
    if (ships[j].submerged) continue;
    if (getShipCells(ships[j]).some(function(c) { return c.col === col && c.row === row; })) {
      return j;
    }
  }
  return -1;
}

// ── 舰船显示名称 ──
function shipName(idx) {
  var s = ships[idx];
  if (!s) return '舰船 #' + (idx + 1);
  return s.name || ('舰船 #' + (idx + 1));
}

// ── 击沉日志 ──
function logSink(victimIdx, killerIdx, method) {
  if (victimIdx === killerIdx) {
    log(shipName(victimIdx) + ' ' + method + ' 自毁');
  } else {
    log(shipName(victimIdx) + ' 被 ' + shipName(killerIdx) + ' ' + method);
  }
}

// ── 获取舰船转向消耗 ──
function getTurnCost(ship) {
  return ship.length;
}

// ── 舰船对象工厂（统一初始化，避免多处重复） ──
// props 必须包含: col, row, length, direction, playerIndex
// 可选: name, skill, skillData, flagColor, flagShape, flagIcon, flagPattern, hp, maxHp, actionsRemaining, maxActions
function createShip(props) {
  var sd = props.skillData || null;
  var ship = {
    col: props.col, row: props.row, length: props.length, direction: props.direction,
    playerIndex: props.playerIndex,
    hp: props.hp != null ? props.hp : props.length,
    maxHp: props.maxHp != null ? props.maxHp : props.length,
    actionsRemaining: props.actionsRemaining != null ? props.actionsRemaining : 3,
    maxActions: props.maxActions != null ? props.maxActions : 3,
    boardingTargets: [], stepsMoved: 0, chargeSteps: 0,
    broadsideCount: 0,
    maxBroadsideCount: (sd && sd.turtleShip) ? 0 : 1,
    name: props.name || null, skill: props.skill || null,
    skillData: sd,
    flagColor: props.flagColor || null, flagShape: props.flagShape || null,
    flagIcon: props.flagIcon || null, flagPattern: props.flagPattern || null,
    braveActive: false,
    submerged: false, submergedTurns: 0, submergeUsed: false,
    bowCannonUsed: false, greekFireUsed: false,
    devourTarget: -1, devourProgress: 0,
    sharksUsed: false, minesPlaced: 0, ironArmorMoves: 0, supplyUsed: 0, grounded: false,
    alert: props.alert || false
  };
  // 应用名船被动技能
  if (sd) {
    if (sd.sturdy) { ship.maxHp = ship.length + 1; ship.hp = ship.maxHp; }
    if (sd.speedy) { ship.maxActions = 4; ship.actionsRemaining = 4; }
    if (sd.extraBroadside) ship.maxBroadsideCount = 2;
  }
  return ship;
}

// ── 检查舰船是否与敌方舰船相邻（正交） ──
function isAdjacentToEnemy(shipIndex) {
  var ship = ships[shipIndex];
  if (!ship) return false;
  var cells = getShipCells(ship);
  for (var j = 0; j < ships.length; j++) {
    if (j === shipIndex) continue;
    if (ships[j].playerIndex === ship.playerIndex) continue;
    if (ships[j].submerged) continue;
    var enemyCells = getShipCells(ships[j]);
    for (var ci = 0; ci < cells.length; ci++) {
      for (var cj = 0; cj < enemyCells.length; cj++) {
        if (Math.abs(cells[ci].col - enemyCells[cj].col) + Math.abs(cells[ci].row - enemyCells[cj].row) === 1) {
          return true;
        }
      }
    }
  }
  return false;
}

// ── 记录初始舰队统计（开局时调用） ──
function recordInitialFleetStats() {
  initialFleetStats = [];
  for (var p = 0; p < 2; p++) {
    var pShips = ships.filter(function(s) { return s.playerIndex === p; });
    var totalHp = 0;
    for (var i = 0; i < pShips.length; i++) { totalHp += pShips[i].maxHp; }
    initialFleetStats.push({ shipCount: pShips.length, totalMaxHp: totalHp });
  }
}

// ── 星级评定 ──
function getStarRating(winnerIdx) {
  if (!initialFleetStats[winnerIdx] || initialFleetStats[winnerIdx].shipCount === 0) return 1;
  var init = initialFleetStats[winnerIdx];
  var alive = ships.filter(function(s) { return s.playerIndex === winnerIdx; });
  var aliveHp = 0;
  for (var i = 0; i < alive.length; i++) { aliveHp += alive[i].hp; }
  if (alive.length >= init.shipCount * 0.5 && aliveHp >= init.totalMaxHp * 0.5) return 3;
  if (alive.length >= init.shipCount * 0.5) return 2;
  return 1;
}

// ── 更新胜利面板星级显示 ──
function updateVictoryStars(starCount) {
  var el = document.getElementById('victoryStars');
  if (!el) return;
  var html = '';
  for (var s = 1; s <= 3; s++) {
    html += s <= starCount ? '<span class="star">⭐</span>' : '<span class="star star-off">⭐</span>';
  }
  el.innerHTML = html;
}
