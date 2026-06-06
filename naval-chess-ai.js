// ═══════════════════════════════════════
//  Naval Chess — AI 模块（MCTS 蒙特卡洛搜索）
//  加载顺序：第8个（依赖所有上述文件）
// ═══════════════════════════════════════

// ── 游戏状态快照（用于 MCTS 模拟） ──
function snapshotState() {
  var ss = [];
  for (var i = 0; i < ships.length; i++) {
    var s = ships[i];
    var bt = s.boardingTargets.slice();
    ss.push({
      col: s.col, row: s.row, length: s.length, direction: s.direction,
      playerIndex: s.playerIndex, hp: s.hp, maxHp: s.maxHp,
      actionsRemaining: s.actionsRemaining, maxActions: s.maxActions,
      boardingTargets: bt, stepsMoved: s.stepsMoved, chargeSteps: s.chargeSteps,
      broadsideCount: s.broadsideCount, maxBroadsideCount: s.maxBroadsideCount,
      braveActive: s.braveActive,
      submerged: s.submerged, submergedTurns: s.submergedTurns,
      submergeUsed: s.submergeUsed, bowCannonUsed: s.bowCannonUsed,
      greekFireUsed: s.greekFireUsed, devourTarget: s.devourTarget,
      devourProgress: s.devourProgress, sharksUsed: s.sharksUsed,
      minesPlaced: s.minesPlaced, ironArmorMoves: s.ironArmorMoves,
      supplyUsed: s.supplyUsed,
      skillData: s.skillData, name: s.name, skill: s.skill,
      flagColor: s.flagColor, flagShape: s.flagShape,
      flagIcon: s.flagIcon, flagPattern: s.flagPattern
    });
  }
  var sh = [];
  for (var j = 0; j < sharks.length; j++) {
    sh.push({ col: sharks[j].col, row: sharks[j].row, dx: sharks[j].dx, dy: sharks[j].dy, justSpawned: sharks[j].justSpawned });
  }
  var hh = [];
  for (var k = 0; k < hitEffects.length; k++) {
    hh.push({ col: hitEffects[k].col, row: hitEffects[k].row, emoji: hitEffects[k].emoji, endTime: hitEffects[k].endTime });
  }
  var mm = [];
  for (var m = 0; m < mines.length; m++) {
    mm.push({ col: mines[m].col, row: mines[m].row });
  }
  var tt = [];
  for (var t = 0; t < terrain.length; t++) {
    tt.push({ col: terrain[t].col, row: terrain[t].row, type: terrain[t].type });
  }
  return {
    ships: ss, sharks: sh, mines: mm, terrain: tt, currentPlayerIndex: currentPlayerIndex,
    currentTurn: currentTurn, gameOver: gameOver,
    playerKills: [
      { ram: playerKills[0].ram, broadside: playerKills[0].broadside, boarding: playerKills[0].boarding },
      { ram: playerKills[1].ram, broadside: playerKills[1].broadside, boarding: playerKills[1].boarding }
    ],
    selectedShipIndex: selectedShipIndex,
    hitEffects: hh
  };
}

function restoreState(snap) {
  ships = [];
  for (var i = 0; i < snap.ships.length; i++) {
    var s = snap.ships[i];
    ships.push({
      col: s.col, row: s.row, length: s.length, direction: s.direction,
      playerIndex: s.playerIndex, hp: s.hp, maxHp: s.maxHp,
      actionsRemaining: s.actionsRemaining, maxActions: s.maxActions,
      boardingTargets: s.boardingTargets.slice(), stepsMoved: s.stepsMoved,
      chargeSteps: s.chargeSteps,
      broadsideCount: s.broadsideCount, maxBroadsideCount: s.maxBroadsideCount,
      braveActive: s.braveActive,
      submerged: s.submerged, submergedTurns: s.submergedTurns,
      submergeUsed: s.submergeUsed, bowCannonUsed: s.bowCannonUsed,
      greekFireUsed: s.greekFireUsed, devourTarget: s.devourTarget,
      devourProgress: s.devourProgress, sharksUsed: s.sharksUsed,
      minesPlaced: s.minesPlaced, ironArmorMoves: s.ironArmorMoves,
      supplyUsed: s.supplyUsed,
      skillData: s.skillData, name: s.name, skill: s.skill,
      flagColor: s.flagColor, flagShape: s.flagShape,
      flagIcon: s.flagIcon, flagPattern: s.flagPattern
    });
  }
  sharks = [];
  for (var j = 0; j < snap.sharks.length; j++) {
    sharks.push({ col: snap.sharks[j].col, row: snap.sharks[j].row, dx: snap.sharks[j].dx, dy: snap.sharks[j].dy, justSpawned: snap.sharks[j].justSpawned });
  }
  currentPlayerIndex = snap.currentPlayerIndex;
  currentTurn = snap.currentTurn;
  gameOver = snap.gameOver;
  playerKills = [
    { ram: snap.playerKills[0].ram, broadside: snap.playerKills[0].broadside, boarding: snap.playerKills[0].boarding },
    { ram: snap.playerKills[1].ram, broadside: snap.playerKills[1].broadside, boarding: snap.playerKills[1].boarding }
  ];
  selectedShipIndex = snap.selectedShipIndex;
  hitEffects = [];
  for (var k = 0; k < snap.hitEffects.length; k++) {
    hitEffects.push({ col: snap.hitEffects[k].col, row: snap.hitEffects[k].row, emoji: snap.hitEffects[k].emoji, endTime: snap.hitEffects[k].endTime });
  }
  mines = [];
  if (snap.mines) {
    for (var m = 0; m < snap.mines.length; m++) {
      mines.push({ col: snap.mines[m].col, row: snap.mines[m].row });
    }
  }
  terrain = [];
  if (snap.terrain) {
    for (var t = 0; t < snap.terrain.length; t++) {
      terrain.push({ col: snap.terrain[t].col, row: snap.terrain[t].row, type: snap.terrain[t].type });
    }
  }
}

// ── 静默模拟辅助（不写日志、不渲染） ──
var _sim = false; // 标记是否在模拟中

function _simCells(ship) {
  var cells = [];
  var dv = DIR_VECTORS[ship.direction];
  for (var i = 0; i < ship.length; i++) {
    cells.push({ col: ship.col + dv.dx * i, row: ship.row + dv.dy * i });
  }
  return cells;
}

function _simCellsAt(ship, hc, hr) {
  var cells = [];
  var dv = DIR_VECTORS[ship.direction];
  for (var i = 0; i < ship.length; i++) {
    cells.push({ col: hc + dv.dx * i, row: hr + dv.dy * i });
  }
  return cells;
}

function _simOccupied(col, row, exclIdx, optShipLength) {
  if (isTerrainBlocking(col, row, optShipLength)) return true;
  for (var i = 0; i < ships.length; i++) {
    if (i === exclIdx) continue;
    if (ships[i].submerged) continue;
    var cells = _simCells(ships[i]);
    for (var ci = 0; ci < cells.length; ci++) {
      if (cells[ci].col === col && cells[ci].row === row) return true;
    }
  }
  return false;
}

function _simFindShipAt(col, row) {
  for (var i = 0; i < ships.length; i++) {
    if (ships[i].submerged) continue;
    var cells = _simCells(ships[i]);
    for (var ci = 0; ci < cells.length; ci++) {
      if (cells[ci].col === col && cells[ci].row === row) return i;
    }
  }
  return -1;
}

function _simAdjacentEnemy(shipIdx) {
  var ship = ships[shipIdx];
  if (!ship) return -1;
  var sc = _simCells(ship);
  var aDv = DIR_VECTORS[ship.direction];
  for (var j = 0; j < ships.length; j++) {
    if (j === shipIdx) continue;
    if (ships[j].playerIndex === ship.playerIndex) continue;
    if (ships[j].submerged) continue;
    if (ships[j].skillData && ships[j].skillData.cursed) continue;
    var ec = _simCells(ships[j]);
    var bDv = DIR_VECTORS[ships[j].direction];
    for (var si = 0; si < sc.length; si++) {
      for (var ei = 0; ei < ec.length; ei++) {
        var dc = ec[ei].col - sc[si].col;
        var dr = ec[ei].row - sc[si].row;
        if (Math.abs(dc) + Math.abs(dr) !== 1) continue;
        if ((dc * aDv.dx + dr * aDv.dy) !== 0) continue;
        if ((dc * bDv.dx + dr * bDv.dy) !== 0) continue;
        return j;
      }
    }
  }
  return -1;
}

function _simFindRammingTarget(shipIdx) {
  var ship = ships[shipIdx];
  if (!ship) return null;
  var dv = DIR_VECTORS[ship.direction];
  var bowCol = ship.col + dv.dx * (ship.length - 1);
  var bowRow = ship.row + dv.dy * (ship.length - 1);
  var gapCol = bowCol + dv.dx;
  var gapRow = bowRow + dv.dy;
  if (gapCol < 0 || gapCol >= GRID_SIZE || gapRow < 0 || gapRow >= GRID_SIZE) return null;
  if (_simFindShipAt(gapCol, gapRow) >= 0) return null;
  var targetCol = bowCol + dv.dx * 2;
  var targetRow = bowRow + dv.dy * 2;
  if (targetCol < 0 || targetCol >= GRID_SIZE || targetRow < 0 || targetRow >= GRID_SIZE) return null;
  for (var j = 0; j < ships.length; j++) {
    if (j === shipIdx) continue;
    if (ships[j].playerIndex === ship.playerIndex) continue;
    if (ships[j].submerged) continue;
    var eCells = _simCells(ships[j]);
    for (var ci = 0; ci < eCells.length; ci++) {
      if (eCells[ci].col === targetCol && eCells[ci].row === targetRow) { return j; }
    }
  }
  return null;
}

function _simFindBowContact(shipIdx) {
  var ship = ships[shipIdx];
  if (!ship) return null;
  var dv = DIR_VECTORS[ship.direction];
  var bowCol = ship.col + dv.dx * (ship.length - 1);
  var bowRow = ship.row + dv.dy * (ship.length - 1);
  var tc = bowCol + dv.dx;
  var tr = bowRow + dv.dy;
  for (var j = 0; j < ships.length; j++) {
    if (j === shipIdx) continue;
    if (ships[j].playerIndex === ship.playerIndex) continue;
    if (ships[j].submerged) continue;
    var eCells = _simCells(ships[j]);
    for (var ci = 0; ci < eCells.length; ci++) {
      if (eCells[ci].col === tc && eCells[ci].row === tr) return j;
    }
  }
  return null;
}

function _simSweptCells(ship, newDir) {
  var cells = [];
  var oldDv = DIR_VECTORS[ship.direction];
  var newDv = DIR_VECTORS[newDir];
  for (var i = 1; i < ship.length; i++) {
    var cx = ship.col + oldDv.dx * i;
    var cy = ship.row + oldDv.dy * i;
    var nx = ship.col + newDv.dx * i;
    var ny = ship.row + newDv.dy * i;
    var minX = Math.min(cx, nx), maxX = Math.max(cx, nx);
    var minY = Math.min(cy, ny), maxY = Math.max(cy, ny);
    for (var x = minX; x <= maxX; x++) {
      for (var y = minY; y <= maxY; y++) { cells.push({ col: x, row: y }); }
    }
  }
  return cells;
}

function _simRemoveShip(idx) {
  var ship = ships[idx];
  // 殉爆
  if (ship.skillData && ship.skillData.deathBlast) {
    var blastCells = _simCells(ship);
    var blasted = {};
    for (var bi = 0; bi < blastCells.length; bi++) {
      for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
          var hi = _simFindShipAt(blastCells[bi].col + dx, blastCells[bi].row + dy);
          if (hi >= 0 && hi !== idx) blasted[hi] = true;
        }
      }
    }
    var blist = Object.keys(blasted);
    for (var bj = 0; bj < blist.length; bj++) {
      ships[parseInt(blist[bj])].hp--;
    }
  }
  // 清理引用
  for (var i = 0; i < ships.length; i++) {
    if (i === idx) continue;
    ships[i].boardingTargets = ships[i].boardingTargets.filter(function(t) { return t !== idx; });
    if (ships[i].devourTarget === idx) { ships[i].devourTarget = -1; ships[i].devourProgress = 0; }
  }
  for (var ti = 0; ti < ship.boardingTargets.length; ti++) {
    var t = ships[ship.boardingTargets[ti]];
    if (t) t.boardingTargets = t.boardingTargets.filter(function(x) { return x !== idx; });
  }
  for (var j = 0; j < ships.length; j++) {
    if (ships[j].devourTarget >= 0) {
      if (ships[j].devourTarget > idx) ships[j].devourTarget--;
      else if (ships[j].devourTarget === idx) { ships[j].devourTarget = -1; ships[j].devourProgress = 0; }
    }
  }
  ships.splice(idx, 1);
  for (var k = 0; k < ships.length; k++) {
    ships[k].boardingTargets = ships[k].boardingTargets.map(function(t) { return t > idx ? t - 1 : t; });
  }
  // 连锁清理
  var found = true;
  while (found) {
    found = false;
    for (var di = ships.length - 1; di >= 0; di--) {
      if (ships[di].hp <= 0) { _simRemoveShip(di); found = true; break; }
    }
  }
}

function _simCheckVictory() {
  for (var p = 0; p < 2; p++) {
    if (ships.filter(function(s) { return s.playerIndex === p; }).length === 0) {
      gameOver = true;
      return 1 - p;
    }
  }
  return -1;
}

// ── 静默水雷碰撞检测（模拟用） ──
function _simCheckMineCollision(cells, shipIdx) {
  if (mines.length === 0) return false;
  var ship = ships[shipIdx];
  for (var mi = mines.length - 1; mi >= 0; mi--) {
    for (var ci = 0; ci < cells.length; ci++) {
      if (mines[mi].col === cells[ci].col && mines[mi].row === cells[ci].row) {
        ship.hp--;
        mines.splice(mi, 1);
        if (ship.hp <= 0) { _simRemoveShip(shipIdx); _simCheckVictory(); return true; }
        break;
      }
    }
  }
  return false;
}

// ── 静默查找侧边相邻友舰（模拟用，用于补给/弹药支援） ──
function _simFindAdjacentFriendly(shipIdx) {
  var ship = ships[shipIdx];
  if (!ship) return -1;
  var sc = _simCells(ship);
  var aDv = DIR_VECTORS[ship.direction];
  for (var j = 0; j < ships.length; j++) {
    if (j === shipIdx) continue;
    if (ships[j].playerIndex !== ship.playerIndex) continue;
    if (ships[j].submerged) continue;
    var ec = _simCells(ships[j]);
    var bDv = DIR_VECTORS[ships[j].direction];
    for (var si = 0; si < sc.length; si++) {
      for (var ei = 0; ei < ec.length; ei++) {
        var dc = ec[ei].col - sc[si].col;
        var dr = ec[ei].row - sc[si].row;
        if (Math.abs(dc) + Math.abs(dr) !== 1) continue;
        if ((dc * aDv.dx + dr * aDv.dy) !== 0) continue;
        if ((dc * bDv.dx + dr * bDv.dy) !== 0) continue;
        return j;
      }
    }
  }
  return -1;
}

// ── 静默地形效果（模拟用） ──
function _simProcessTerrainEffects(shipIdx) {
  if (terrain.length === 0) return false;
  var ship = ships[shipIdx];
  var cells = _simCells(ship);
  for (var ci = 0; ci < cells.length; ci++) {
    var t = getTerrainAt(cells[ci].col, cells[ci].row);
    if (!t) continue;
    if (t.type === TERRAIN.FLAG) {
      gameOver = true; return true;
    }
    if (t.type === TERRAIN.SUPPLY && ship.hp < ship.maxHp) {
      ship.hp++;
      terrain.splice(terrain.indexOf(t), 1);
      return false;
    }
    if (t.type === TERRAIN.POWDER_KEG && ship.broadsideCount > 0) {
      ship.broadsideCount--;
      terrain.splice(terrain.indexOf(t), 1);
      return false;
    }
  }
  return false;
}

// ── 静默布雷（模拟用） ──
function _simLayMine(shipIdx) {
  var ship = ships[shipIdx];
  if (ship.minesPlaced >= 3) return false;
  var cells = _simCells(ship);
  for (var ci = 0; ci < cells.length; ci++) {
    for (var dx = -1; dx <= 1; dx++) {
      for (var dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        var mc = cells[ci].col + dx;
        var mr = cells[ci].row + dy;
        if (mc < 0 || mc >= GRID_SIZE || mr < 0 || mr >= GRID_SIZE) continue;
        if (_simFindShipAt(mc, mr) >= 0) continue;
        if (_simOccupied(mc, mr, -1, 0)) continue;
        var hasMine = false;
        for (var mi = 0; mi < mines.length; mi++) {
          if (mines[mi].col === mc && mines[mi].row === mr) { hasMine = true; break; }
        }
        if (hasMine) continue;
        mines.push({ col: mc, row: mr });
        ship.minesPlaced++;
        ship.actionsRemaining--;
        return true;
      }
    }
  }
  return false;
}

// ── 静默补给（模拟用） ──
function _simSupply(shipIdx) {
  var ship = ships[shipIdx];
  if (ship.supplyUsed >= 3) return false;
  var targetIdx = _simFindAdjacentFriendly(shipIdx);
  if (targetIdx < 0) return false;
  var target = ships[targetIdx];
  if (target.hp >= target.maxHp) return false;
  target.hp++;
  ship.supplyUsed++;
  ship.actionsRemaining--;
  return true;
}

// ── 静默弹药支援（模拟用） ──
function _simAmmoSupport(shipIdx) {
  var ship = ships[shipIdx];
  if (ship.broadsideCount >= ship.maxBroadsideCount) return false;
  var targetIdx = _simFindAdjacentFriendly(shipIdx);
  if (targetIdx < 0) return false;
  var target = ships[targetIdx];
  if (target.broadsideCount === 0) return false;
  target.broadsideCount--;
  ship.broadsideCount = ship.maxBroadsideCount;
  ship.actionsRemaining--;
  return true;
}

// ── 静默行动函数（不写日志、不渲染） ──

function _simMoveForward(shipIdx) {
  var ship = ships[shipIdx];
  if (ship.skillData && ship.skillData.ironArmor && ship.ironArmorMoves >= 2) return false;
  var step = ship.submerged ? 2 : 1;
  var dv = DIR_VECTORS[ship.direction];
  var newCol = ship.col + dv.dx * step;
  var newRow = ship.row + dv.dy * step;
  var cells = _simCellsAt(ship, newCol, newRow);
  for (var ci = 0; ci < cells.length; ci++) {
    if (cells[ci].col < 0 || cells[ci].col >= GRID_SIZE || cells[ci].row < 0 || cells[ci].row >= GRID_SIZE) return false;
    if (_simOccupied(cells[ci].col, cells[ci].row, shipIdx, ship.length)) return false;
  }
  ship.col = newCol; ship.row = newRow;
  ship.stepsMoved += step; ship.chargeSteps += step;
  if (ship.skillData && ship.skillData.ironArmor) ship.ironArmorMoves++;
  // 鲨鱼/水雷碰撞
  if (!ship.submerged && !(ship.skillData && ship.skillData.canReleaseSharks)) {
    var sc = _simCells(ship);
    for (var si = sharks.length - 1; si >= 0; si--) {
      for (var cj = 0; cj < sc.length; cj++) {
        if (sharks[si].col === sc[cj].col && sharks[si].row === sc[cj].row) {
          ship.hp--; sharks.splice(si, 1);
          if (ship.hp <= 0) { _simRemoveShip(shipIdx); _simCheckVictory(); return true; }
          break;
        }
      }
    }
    if (_simCheckMineCollision(sc, shipIdx)) return true;
  }
  if (_simProcessTerrainEffects(shipIdx)) { _simCheckVictory(); return true; }
  ship.actionsRemaining--;
  return true;
}

function _simTurn(shipIdx, delta) {
  var ship = ships[shipIdx];
  if (ship.actionsRemaining < ship.length) return false;
  var newDir = (ship.direction + delta + 4) % 4;
  var newDv = DIR_VECTORS[newDir];
  if (!ship.submerged) {
    for (var i = 0; i < ship.length; i++) {
      var cx = ship.col + newDv.dx * i;
      var cy = ship.row + newDv.dy * i;
      if (cx < 0 || cx >= GRID_SIZE || cy < 0 || cy >= GRID_SIZE) return false;
      if (_simOccupied(cx, cy, shipIdx, ship.length)) return false;
    }
    var swept = _simSweptCells(ship, newDir);
    for (var si = 0; si < swept.length; si++) {
      if (swept[si].col < 0 || swept[si].col >= GRID_SIZE || swept[si].row < 0 || swept[si].row >= GRID_SIZE) return false;
      if (_simOccupied(swept[si].col, swept[si].row, shipIdx, ship.length)) return false;
    }
  }
  ship.direction = newDir;
  ship.chargeSteps = 0;
  if (!ship.submerged && !(ship.skillData && ship.skillData.canReleaseSharks)) {
    var sw2 = _simSweptCells(ship, newDir);
    for (var sj = sharks.length - 1; sj >= 0; sj--) {
      for (var sk = 0; sk < sw2.length; sk++) {
        if (sharks[sj].col === sw2[sk].col && sharks[sj].row === sw2[sk].row) {
          ship.hp--; sharks.splice(sj, 1);
          if (ship.hp <= 0) { _simRemoveShip(shipIdx); _simCheckVictory(); return true; }
          break;
        }
      }
    }
    if (_simCheckMineCollision(sw2, shipIdx)) return true;
  }
  if (_simProcessTerrainEffects(shipIdx)) { _simCheckVictory(); return true; }
  ship.actionsRemaining -= ship.length;
  return true;
}

function _simBroadside(shipIdx) {
  var ship = ships[shipIdx];
  if (ship.broadsideCount >= ship.maxBroadsideCount) return false;
  var dv = DIR_VECTORS[ship.direction];
  var sideDirs = [{ dx: -dv.dy, dy: dv.dx }, { dx: dv.dy, dy: -dv.dx }];
  var hits = [];
  var selfDmg = 0;
  for (var sd = 0; sd < sideDirs.length; sd++) {
    var sdir = sideDirs[sd];
    for (var i = 0; i < ship.length; i++) {
      var ox = ship.col + dv.dx * i;
      var oy = ship.row + dv.dy * i;
      for (var r = 1; r <= 2; r++) {
        var tc = ox + sdir.dx * r;
        var tr = oy + sdir.dy * r;
        if (tc < 0 || tc >= GRID_SIZE || tr < 0 || tr >= GRID_SIZE) break;
        if (isTerrainBlockingRanged(tc, tr)) break; // 山地阻挡
        var hi = _simFindShipAt(tc, tr);
        if (hi >= 0) {
          if (r === 1) {
            selfDmg++;
          }
          if (!(ships[hi].skillData && ships[hi].skillData.stealth && !_simAdjacentToEnemy(hi))) {
            hits.push({ shipIdx: hi, isFriendly: ships[hi].playerIndex === ship.playerIndex });
          }
          break;
        }
      }
    }
  }
  if (selfDmg > 0) { ship.hp -= selfDmg; }
  for (var hi = 0; hi < hits.length; hi++) {
    ships[hits[hi].shipIdx].hp--;
  }
  ship.broadsideCount++;
  ship.actionsRemaining--;
  // 清理
  for (var di = ships.length - 1; di >= 0; di--) {
    if (ships[di].hp <= 0) { _simRemoveShip(di); }
  }
  _simCheckVictory();
  return true;
}

function _simAdjacentToEnemy(shipIdx) {
  var ship = ships[shipIdx];
  if (!ship) return false;
  var sc = _simCells(ship);
  for (var j = 0; j < ships.length; j++) {
    if (j === shipIdx) continue;
    if (ships[j].playerIndex === ship.playerIndex) continue;
    if (ships[j].submerged) continue;
    var ec = _simCells(ships[j]);
    for (var si = 0; si < sc.length; si++) {
      for (var ei = 0; ei < ec.length; ei++) {
        if (Math.abs(sc[si].col - ec[ei].col) + Math.abs(sc[si].row - ec[ei].row) === 1) return true;
      }
    }
  }
  return false;
}

function _simRam(shipIdx) {
  var ship = ships[shipIdx];
  var targetIdx = _simFindRammingTarget(shipIdx);
  if (targetIdx === null) return false;
  var enemy = ships[targetIdx];
  var dv = DIR_VECTORS[ship.direction];
  ship.col += dv.dx; ship.row += dv.dy;
  ship.stepsMoved++; ship.chargeSteps++;
  if (_simProcessTerrainEffects(shipIdx)) { _simCheckVictory(); return true; }
  // shark / mine check
  if (!(ship.skillData && ship.skillData.canReleaseSharks)) {
    var sc = _simCells(ship);
    for (var si = sharks.length - 1; si >= 0; si--) {
      for (var cj = 0; cj < sc.length; cj++) {
        if (sharks[si].col === sc[cj].col && sharks[si].row === sc[cj].row) {
          ship.hp--; sharks.splice(si, 1);
          if (ship.hp <= 0) { _simRemoveShip(shipIdx); _simCheckVictory(); return true; }
          break;
        }
      }
    }
    if (_simCheckMineCollision(sc, shipIdx)) return true;
  }
  var dmg = ship.chargeSteps;
  var eDv = DIR_VECTORS[enemy.direction];
  var dot = (-dv.dx) * eDv.dx + (-dv.dy) * eDv.dy;
  if (dot === 0) { ship.hp -= 1; enemy.hp -= dmg; }
  else { ship.hp -= dmg; enemy.hp -= dmg; }
  // knockback
  var kb = Math.max(1, Math.floor(ship.length * dmg / enemy.length));
  for (var s = 1; s <= kb; s++) {
    var nc2 = enemy.col + dv.dx * s;
    var nr2 = enemy.row + dv.dy * s;
    var ec2 = _simCellsAt(enemy, nc2, nr2);
    var blocked = false;
    for (var ci = 0; ci < ec2.length; ci++) {
      if (ec2[ci].col < 0 || ec2[ci].col >= GRID_SIZE || ec2[ci].row < 0 || ec2[ci].row >= GRID_SIZE) { blocked = true; break; }
      if (_simOccupied(ec2[ci].col, ec2[ci].row, targetIdx, enemy.length)) { blocked = true; break; }
    }
    if (blocked) break;
    enemy.col = nc2; enemy.row = nr2;
  }
  ship.actionsRemaining = 0;
  for (var di = ships.length - 1; di >= 0; di--) {
    if (ships[di].hp <= 0) { _simRemoveShip(di); }
  }
  _simCheckVictory();
  return true;
}

function _simBoard(shipIdx) {
  var ship = ships[shipIdx];
  var enemyIdx = _simAdjacentEnemy(shipIdx);
  if (enemyIdx < 0) return false;
  var enemy = ships[enemyIdx];
  if (enemy.skillData && enemy.skillData.cursed) return false;
  ship.boardingTargets.push(enemyIdx);
  if (enemy.boardingTargets.length === 0) {
    enemy.boardingTargets.push(shipIdx);
    if (enemy.skillData && enemy.skillData.brave) enemy.braveActive = true;
  }
  if (ship.skillData && ship.skillData.brave) ship.braveActive = true;
  ship.actionsRemaining = 0;
  return true;
}

function _simSkill(shipIdx, skillType) {
  var ship = ships[shipIdx];
  if (skillType === 'submerge') {
    if (ship.submergeUsed || ship.submerged) return false;
    ship.submerged = true; ship.submergedTurns = 3; ship.submergeUsed = true;
    ship.actionsRemaining--;
    return true;
  }
  if (skillType === 'surface') {
    if (!ship.submerged) return false;
    var sCells = _simCells(ship);
    var blocked = [];
    for (var ci = 0; ci < sCells.length; ci++) {
      for (var bj = 0; bj < ships.length; bj++) {
        if (bj === shipIdx) continue;
        if (ships[bj].submerged) continue;
        var bc = _simCells(ships[bj]);
        for (var bk = 0; bk < bc.length; bk++) {
          if (bc[bk].col === sCells[ci].col && bc[bk].row === sCells[ci].row) {
            if (blocked.indexOf(bj) < 0) blocked.push(bj);
          }
        }
      }
    }
    ship.submerged = false;
    if (blocked.length > 0) {
      var dmg2 = ship.hp;
      ship.hp -= dmg2;
      for (var bi = 0; bi < blocked.length; bi++) ships[blocked[bi]].hp -= dmg2;
    }
    ship.actionsRemaining--;
    for (var di = ships.length - 1; di >= 0; di--) {
      if (ships[di].hp <= 0) { _simRemoveShip(di); }
    }
    _simCheckVictory();
    return true;
  }
  if (skillType === 'bowCannon') {
    if (ship.bowCannonUsed || ship.submerged) return false;
    var dv = DIR_VECTORS[ship.direction];
    var bowCol = ship.col + dv.dx * (ship.length - 1);
    var bowRow = ship.row + dv.dy * (ship.length - 1);
    var selfDmg = 0;
    for (var r = 1; r <= 3; r++) {
      var tc = bowCol + dv.dx * r;
      var tr = bowRow + dv.dy * r;
      if (tc < 0 || tc >= GRID_SIZE || tr < 0 || tr >= GRID_SIZE) break;
      if (isTerrainBlockingRanged(tc, tr)) break;
      var hi = _simFindShipAt(tc, tr);
      if (hi >= 0 && hi !== shipIdx) {
        if (r === 1) selfDmg = 1;
        ships[hi].hp--;
        break;
      }
    }
    if (selfDmg > 0) ship.hp -= selfDmg;
    ship.bowCannonUsed = true;
    ship.actionsRemaining--;
    for (var di2 = ships.length - 1; di2 >= 0; di2--) {
      if (ships[di2].hp <= 0) { _simRemoveShip(di2); }
    }
    _simCheckVictory();
    return true;
  }
  if (skillType === 'greekFire') {
    if (ship.greekFireUsed || ship.submerged) return false;
    var dv2 = DIR_VECTORS[ship.direction];
    var bc2 = ship.col + dv2.dx * (ship.length - 1);
    var br2 = ship.row + dv2.dy * (ship.length - 1);
    for (var r2 = 1; r2 <= 2; r2++) {
      var tc2 = bc2 + dv2.dx * r2;
      var tr2 = br2 + dv2.dy * r2;
      if (tc2 < 0 || tc2 >= GRID_SIZE || tr2 < 0 || tr2 >= GRID_SIZE) break;
      if (isTerrainBlockingRanged(tc2, tr2)) break;
      var hi2 = _simFindShipAt(tc2, tr2);
      if (hi2 >= 0 && hi2 !== shipIdx) {
        if (ships[hi2].playerIndex !== ship.playerIndex) ships[hi2].hp--;
        break;
      }
    }
    ship.greekFireUsed = true;
    ship.actionsRemaining--;
    for (var di3 = ships.length - 1; di3 >= 0; di3--) {
      if (ships[di3].hp <= 0) { _simRemoveShip(di3); }
    }
    _simCheckVictory();
    return true;
  }
  if (skillType === 'sharks') {
    if (ship.sharksUsed) return false;
    var dv3 = DIR_VECTORS[ship.direction];
    var mc = ship.col + dv3.dx;
    var mr = ship.row + dv3.dy;
    var sides = [{ dx: -dv3.dy, dy: dv3.dx }, { dx: dv3.dy, dy: -dv3.dx }];
    for (var si2 = 0; si2 < sides.length; si2++) {
      var sx = mc + sides[si2].dx;
      var sy = mr + sides[si2].dy;
      if (sx >= 0 && sx < GRID_SIZE && sy >= 0 && sy < GRID_SIZE) {
        sharks.push({ col: sx, row: sy, dx: sides[si2].dx, dy: sides[si2].dy, justSpawned: true });
      }
    }
    ship.sharksUsed = true;
    ship.actionsRemaining--;
    return true;
  }
  if (skillType === 'devour') {
    var bcIdx = _simFindBowContact(shipIdx);
    if (bcIdx === null) return false;
    ship.devourTarget = bcIdx;
    ship.devourProgress++;
    var enemy2 = ships[bcIdx];
    ship.actionsRemaining = 0;
    if (ship.devourProgress >= enemy2.length) {
      _simRemoveShip(bcIdx);
      ship.devourTarget = -1; ship.devourProgress = 0;
      _simCheckVictory();
    }
    return true;
  }
  return false;
}

// ── 获取所有合法行动 ──
function getLegalActions(playerIdx) {
  var actions = [];
  for (var i = 0; i < ships.length; i++) {
    var ship = ships[i];
    if (ship.playerIndex !== playerIdx) continue;
    if (ship.actionsRemaining <= 0) continue;
    if (ship.boardingTargets.length > 0) continue;

    var sid = i;

    // 前进（铁甲限制：每回合最多2次）
    var ironBlocked = ship.skillData && ship.skillData.ironArmor && ship.ironArmorMoves >= 2;
    if (!ironBlocked && !ship.grounded) {
      var dv = DIR_VECTORS[ship.direction];
      var step = ship.submerged ? 2 : 1;
      var nc = ship.col + dv.dx * step;
      var nr = ship.row + dv.dy * step;
      var cells = _simCellsAt(ship, nc, nr);
      var canMove = true;
      for (var ci = 0; ci < cells.length; ci++) {
        if (cells[ci].col < 0 || cells[ci].col >= GRID_SIZE || cells[ci].row < 0 || cells[ci].row >= GRID_SIZE) { canMove = false; break; }
        if (_simOccupied(cells[ci].col, cells[ci].row, i, ship.length)) { canMove = false; break; }
      }
      if (canMove) actions.push({ type: 'move', shipIdx: sid });
    }

    // 转向（搁浅时不可转向）
    if (ship.actionsRemaining >= ship.length && !ship.grounded) {
      for (var d = -1; d <= 1; d += 2) {
        var nd = (ship.direction + d + 4) % 4;
        var ndv = DIR_VECTORS[nd];
        var turnOk = true;
        if (!ship.submerged) {
          for (var ti = 0; ti < ship.length; ti++) {
            var tx = ship.col + ndv.dx * ti;
            var ty = ship.row + ndv.dy * ti;
            if (tx < 0 || tx >= GRID_SIZE || ty < 0 || ty >= GRID_SIZE) { turnOk = false; break; }
            if (_simOccupied(tx, ty, i, ship.length)) { turnOk = false; break; }
          }
          if (turnOk) {
            var sw = _simSweptCells(ship, nd);
            for (var si = 0; si < sw.length; si++) {
              if (sw[si].col < 0 || sw[si].col >= GRID_SIZE || sw[si].row < 0 || sw[si].row >= GRID_SIZE) { turnOk = false; break; }
              if (_simOccupied(sw[si].col, sw[si].row, i, ship.length)) { turnOk = false; break; }
            }
          }
        }
        if (turnOk) actions.push({ type: 'turn', shipIdx: sid, delta: d });
      }
    }

    // 舷炮（敌方目标 > 自伤格数 时才可选，避免伤敌八百自损一千）
    if (ship.broadsideCount < ship.maxBroadsideCount) {
      var bsCheck = _simCountBroadside(ship);
      if (bsCheck.enemy > 0 && bsCheck.enemy >= bsCheck.self) {
        actions.push({ type: 'broadside', shipIdx: sid });
      }
    }

    // 撞击
    if (_simFindRammingTarget(sid) !== null && !ship.submerged) {
      actions.push({ type: 'ram', shipIdx: sid });
    }

    // 接舷
    if (_simAdjacentEnemy(sid) >= 0 && !ship.submerged) {
      actions.push({ type: 'board', shipIdx: sid });
    }

    // 名船技能（加入战况前置条件，避免空放）
    if (ship.skillData) {
      var sd = ship.skillData;
      // 最近敌舰距离
      var nearDist = 999;
      var sc2 = _simCells(ship);
      for (var ej = 0; ej < ships.length; ej++) {
        if (ships[ej].playerIndex === ship.playerIndex) continue;
        if (ships[ej].submerged) continue;
        var ec2 = _simCells(ships[ej]);
        for (var sci = 0; sci < sc2.length; sci++) {
          for (var eci = 0; eci < ec2.length; eci++) {
            var dist = Math.abs(sc2[sci].col - ec2[eci].col) + Math.abs(sc2[sci].row - ec2[eci].row);
            if (dist < nearDist) nearDist = dist;
          }
        }
      }

      // 下潜：10格内有敌舰时才考虑（被威胁）
      if (sd.canSubmerge && !ship.submergeUsed && !ship.submerged && ship.boardingTargets.length === 0 && nearDist <= 10) {
        actions.push({ type: 'skill', shipIdx: sid, skill: 'submerge' });
      }
      // 上浮：仅当3格内有敌舰（可撞击），忽略纯友军情况
      if (ship.submerged && nearDist <= 3) {
        actions.push({ type: 'skill', shipIdx: sid, skill: 'surface' });
      }
      // 三联炮：仅当船头方向3格内有**敌舰**（忽略友军）
      if (sd.canBowCannon && !ship.bowCannonUsed && !ship.submerged) {
        var hasTarget = false;
        for (var r = 1; r <= 3; r++) {
          var tc = ship.col + dv.dx * (ship.length - 1 + r);
          var tr = ship.row + dv.dy * (ship.length - 1 + r);
          if (tc < 0 || tc >= GRID_SIZE || tr < 0 || tr >= GRID_SIZE) break;
          if (isTerrainBlockingRanged(tc, tr)) break;
          var fi2 = _simFindShipAt(tc, tr);
          if (fi2 >= 0 && ships[fi2].playerIndex !== ship.playerIndex) { hasTarget = true; break; }
        }
        if (hasTarget) actions.push({ type: 'skill', shipIdx: sid, skill: 'bowCannon' });
      }
      // 希腊火：仅当船头方向2格内有敌舰
      if (sd.canGreekFire && !ship.greekFireUsed && !ship.submerged) {
        var hasTarget2 = false;
        for (var r2 = 1; r2 <= 2; r2++) {
          var tc2 = ship.col + dv.dx * (ship.length - 1 + r2);
          var tr2 = ship.row + dv.dy * (ship.length - 1 + r2);
          if (tc2 < 0 || tc2 >= GRID_SIZE || tr2 < 0 || tr2 >= GRID_SIZE) break;
          if (isTerrainBlockingRanged(tc2, tr2)) break;
          var fi = _simFindShipAt(tc2, tr2);
          if (fi >= 0 && ships[fi].playerIndex !== ship.playerIndex) { hasTarget2 = true; break; }
        }
        if (hasTarget2) actions.push({ type: 'skill', shipIdx: sid, skill: 'greekFire' });
      }
      if (sd.canDevour && ship.boardingTargets.length === 0 && _simFindBowContact(sid) !== null) {
        actions.push({ type: 'skill', shipIdx: sid, skill: 'devour' });
      }
      // 鲨鱼：仅当有敌舰存在
      if (sd.canReleaseSharks && !ship.sharksUsed && ship.boardingTargets.length === 0 && nearDist < 999) {
        actions.push({ type: 'skill', shipIdx: sid, skill: 'sharks' });
      }
      // 布雷：船体周围有空格即可
      if (sd.canLayMines && ship.minesPlaced < 3 && ship.boardingTargets.length === 0) {
        actions.push({ type: 'skill', shipIdx: sid, skill: 'layMine' });
      }
      // 补给：侧边有受伤友舰
      if (sd.canSupply && ship.supplyUsed < 3 && ship.boardingTargets.length === 0) {
        var supTarget = _simFindAdjacentFriendly(sid);
        if (supTarget >= 0 && ships[supTarget].hp < ships[supTarget].maxHp) {
          actions.push({ type: 'skill', shipIdx: sid, skill: 'supply' });
        }
      }
      // 弹药支援：侧边有已开炮的友舰
      if (sd.canSupply && ship.broadsideCount < ship.maxBroadsideCount && ship.boardingTargets.length === 0) {
        var ammoTarget = _simFindAdjacentFriendly(sid);
        if (ammoTarget >= 0 && ships[ammoTarget].broadsideCount > 0) {
          actions.push({ type: 'skill', shipIdx: sid, skill: 'ammoSupport' });
        }
      }
    }
  }

  // 结束回合
  actions.push({ type: 'endTurn' });
  return actions;
}

// ── 执行静默行动 ──
function executeSimAction(action) {
  if (action.type === 'move') return _simMoveForward(action.shipIdx);
  if (action.type === 'turn') return _simTurn(action.shipIdx, action.delta);
  if (action.type === 'broadside') return _simBroadside(action.shipIdx);
  if (action.type === 'ram') return _simRam(action.shipIdx);
  if (action.type === 'board') return _simBoard(action.shipIdx);
  if (action.type === 'skill') {
    if (action.skill === 'layMine') return _simLayMine(action.shipIdx);
    if (action.skill === 'supply') return _simSupply(action.shipIdx);
    if (action.skill === 'ammoSupport') return _simAmmoSupport(action.shipIdx);
    return _simSkill(action.shipIdx, action.skill);
  }
  if (action.type === 'endTurn') {
    // 处理接舷战伤害
    var defeated = [];
    for (var i = 0; i < ships.length; i++) {
      var s = ships[i];
      if (s.playerIndex === currentPlayerIndex && s.boardingTargets.length > 0) {
        for (var ti = 0; ti < s.boardingTargets.length; ti++) {
          var e = ships[s.boardingTargets[ti]];
          if (!e) continue;
          if (e.braveActive) { e.braveActive = false; continue; }
          e.hp--;
          if (e.hp <= 0 && defeated.indexOf(s.boardingTargets[ti]) < 0) defeated.push(s.boardingTargets[ti]);
        }
      }
    }
    for (var di = 0; di < defeated.length; di++) {
      _simRemoveShip(defeated[di]);
    }
    if (_simCheckVictory() >= 0) return true;

    // 切换回合
    currentPlayerIndex = (currentPlayerIndex + 1) % 2;
    if (currentPlayerIndex === 0) currentTurn++;
    // 重置行动力
    for (var ri = 0; ri < ships.length; ri++) {
      if (ships[ri].playerIndex === currentPlayerIndex) {
        ships[ri].actionsRemaining = ships[ri].maxActions;
        ships[ri].stepsMoved = 0;
        ships[ri].chargeSteps = 0;
        if (ships[ri].submerged) {
          ships[ri].submergedTurns--;
          if (ships[ri].submergedTurns <= 0) {
            // 简化：自动上浮不检查碰撞
            ships[ri].submerged = false;
          }
        }
      }
    }
    // 鲨鱼移动
    var surv = [];
    for (var si = 0; si < sharks.length; si++) {
      var sh = sharks[si];
      if (sh.justSpawned) { sh.justSpawned = false; surv.push(sh); continue; }
      sh.col += sh.dx; sh.row += sh.dy;
      if (sh.col < 0 || sh.col >= GRID_SIZE || sh.row < 0 || sh.row >= GRID_SIZE) continue;
      if (isTerrainBlocking(sh.col, sh.row)) continue;
      var hi = _simFindShipAt(sh.col, sh.row);
      if (hi >= 0) {
        if (!(ships[hi].skillData && ships[hi].skillData.canReleaseSharks)) {
          ships[hi].hp--;
          if (ships[hi].hp <= 0) { _simRemoveShip(hi); _simCheckVictory(); }
        } else { surv.push(sh); }
        continue;
      }
      surv.push(sh);
    }
    sharks = surv;
    return true;
  }
  return false;
}

var simPlayoutMaxTurns = 8; // 由 aiTakeTurn 按难度设置

// ── 贪心行动评分（用于模拟引导） ──
function _simCountBroadside(ship) {
  var dv = DIR_VECTORS[ship.direction];
  var sides = [{ dx: -dv.dy, dy: dv.dx }, { dx: dv.dy, dy: -dv.dx }];
  var enemyHits = 0, selfDmg = 0;
  for (var sd = 0; sd < 2; sd++) {
    for (var i = 0; i < ship.length; i++) {
      var ox = ship.col + dv.dx * i, oy = ship.row + dv.dy * i;
      for (var r = 1; r <= 2; r++) {
        var tc = ox + sides[sd].dx * r, tr = oy + sides[sd].dy * r;
        if (tc < 0 || tc >= GRID_SIZE || tr < 0 || tr >= GRID_SIZE) break;
        if (isTerrainBlockingRanged(tc, tr)) break;
        var hi = _simFindShipAt(tc, tr);
        if (hi >= 0) {
          if (ships[hi].playerIndex !== ship.playerIndex) enemyHits++;
          if (r === 1) selfDmg++;
          break;
        }
      }
    }
  }
  return { enemy: enemyHits, self: selfDmg };
}

/** 检查舰船在给定位置是否会搁浅（用于AI决策） */
function _wouldBeGrounded(ship, col, row) {
  var cells = _simCellsAt(ship, col, row);
  for (var i = 0; i < cells.length; i++) {
    var t = null;
    for (var ti = 0; ti < terrain.length; ti++) {
      if (terrain[ti].col === cells[i].col && terrain[ti].row === cells[i].row) { t = terrain[ti]; break; }
    }
    if (!t) continue;
    if (t.type === 'shoal' && ship.length >= 2) return true;
    if (t.type === 'mediumShoal' && ship.length >= 3) return true;
  }
  return false;
}

function greedyScore(action, shipIdx) {
  var ship = ships[shipIdx];
  var score = 1;

  if (action.type === 'move') {
    // 前进：偏好接近敌人
    var dv = DIR_VECTORS[ship.direction];
    var step = ship.submerged ? 2 : 1;
    var nc = ship.col + dv.dx * step, nr = ship.row + dv.dy * step;
    // 计算移动后离最近敌人的距离变化
    var oldDist = 999, newDist = 999;
    var sc = _simCells(ship);
    for (var j = 0; j < ships.length; j++) {
      if (ships[j].playerIndex === ship.playerIndex) continue;
      if (ships[j].submerged) continue;
      var ec = _simCells(ships[j]);
      for (var si = 0; si < sc.length; si++) {
        for (var ei = 0; ei < ec.length; ei++) {
          var d = Math.abs(sc[si].col - ec[ei].col) + Math.abs(sc[si].row - ec[ei].row);
          if (d < oldDist) oldDist = d;
        }
      }
    }
    var nsc = _simCellsAt(ship, nc, nr);
    for (var j2 = 0; j2 < ships.length; j2++) {
      if (ships[j2].playerIndex === ship.playerIndex) continue;
      if (ships[j2].submerged) continue;
      var ec2 = _simCells(ships[j2]);
      for (var si2 = 0; si2 < nsc.length; si2++) {
        for (var ei2 = 0; ei2 < ec2.length; ei2++) {
          var d2 = Math.abs(nsc[si2].col - ec2[ei2].col) + Math.abs(nsc[si2].row - ec2[ei2].row);
          if (d2 < newDist) newDist = d2;
        }
      }
    }
    var distChange = oldDist - newDist; // 正=接近，负=远离
    score = Math.max(6, 8 + (distChange > 0 ? distChange * 4 : distChange * 1));
    if (_wouldBeGrounded(ship, nc, nr)) score -= 15;
  } else if (action.type === 'turn') {
    score = 3;
  } else if (action.type === 'broadside') {
    var bs = _simCountBroadside(ship);
    if (bs.enemy === 0) score = -30; // 没目标别开炮
    else score = 15 + bs.enemy * 12 - bs.self * 8;
  } else if (action.type === 'ram') {
    score = 20 + ship.chargeSteps * 5;
  } else if (action.type === 'board') {
    score = 12;
  } else if (action.type === 'skill') {
    if (action.skill === 'devour') score = 25;
    else if (action.skill === 'bowCannon') score = 18;
    else if (action.skill === 'greekFire') score = 15;
    else if (action.skill === 'sharks') score = 12;
    else if (action.skill === 'surface') score = 14;
    else if (action.skill === 'submerge') score = 6;
    else if (action.skill === 'layMine') score = 8;
    else if (action.skill === 'supply') score = 10;
    else if (action.skill === 'ammoSupport') score = 7;
    else score = 5;
  } else if (action.type === 'endTurn') {
    score = -5; // 有行动就不该结束
  }
  return score;
}

// ── 截断评估函数（深不可测专用） ──
function evaluateState(playerIdx) {
  var aiHp = 0, aiMaxHp = 0, aiShips = 0, aiBroadside = 0, aiSkills = 0;
  var plHp = 0, plMaxHp = 0, plShips = 0;

  for (var i = 0; i < ships.length; i++) {
    var s = ships[i];
    if (s.playerIndex === playerIdx) {
      aiHp += s.hp; aiMaxHp += s.maxHp; aiShips++;
      if (s.grounded) aiSkills -= 0.5; // 搁浅惩罚
      if (s.broadsideCount < s.maxBroadsideCount) aiBroadside++;
      if (s.skillData && s.boardingTargets.length === 0) {
        var sd = s.skillData;
        if (sd.canSubmerge && !s.submergeUsed) aiSkills++;
        if (sd.canBowCannon && !s.bowCannonUsed) aiSkills++;
        if (sd.canGreekFire && !s.greekFireUsed) aiSkills++;
        if (sd.canReleaseSharks && !s.sharksUsed) aiSkills++;
        if (sd.canDevour) aiSkills++;
      }
    } else {
      plHp += s.hp; plMaxHp += s.maxHp; plShips++;
      if (s.grounded) plHp -= 1; // 搁浅视为等效HP损失
    }
  }

  if (plShips === 0) return 1;
  if (aiShips === 0) return 0;

  // 40% 己方总血量与玩家总血量比值
  var hpScore = (aiHp + plHp) > 0 ? aiHp / (aiHp + plHp) : 0.5;

  // 20% 己方舰船数量与玩家舰船数量比值
  var shipScore = (aiShips + plShips) > 0 ? aiShips / (aiShips + plShips) : 0.5;

  // 10% 己方舷炮可用数量（归一化到 0~1，5艘为满分）
  var broadScore = Math.min(1, aiBroadside / 5);

  // 10% 己方名船技能可用次数（归一化到 0~1，5次为满分）
  var skillScore = Math.min(1, aiSkills / 5);

  // 10% 对敌方棋子造成伤害量（玩家已损HP / 玩家maxHp）
  var dmgDealt = plMaxHp > 0 ? (plMaxHp - plHp) / plMaxHp : 0;

  // 10% 己方船只距离玩家船只距离（越近越好）
  var totalDist = 0, distCount = 0;
  for (var i = 0; i < ships.length; i++) {
    if (ships[i].playerIndex !== playerIdx) continue;
    if (ships[i].submerged) continue;
    var sc = _simCells(ships[i]);
    var minD = 999;
    for (var j = 0; j < ships.length; j++) {
      if (ships[j].playerIndex === playerIdx) continue;
      if (ships[j].submerged) continue;
      var ec = _simCells(ships[j]);
      for (var si = 0; si < sc.length; si++) {
        for (var ei = 0; ei < ec.length; ei++) {
          var d = Math.abs(sc[si].col - ec[ei].col) + Math.abs(sc[si].row - ec[ei].row);
          if (d < minD) minD = d;
        }
      }
    }
    if (minD < 999) { totalDist += minD; distCount++; }
  }
  var avgDist = distCount > 0 ? totalDist / distCount : 20;
  var distScore = 1 / (1 + avgDist * 0.08); // 距离0→1分，距离12→0.5分，距离25→0.33分

  return 0.40 * hpScore + 0.20 * shipScore + 0.10 * broadScore
       + 0.10 * skillScore + 0.10 * dmgDealt + 0.10 * distScore;
}

// ── 随机模拟（带轻量启发式） ──
function simPlayout(playerIdx) {
  var maxTurns = simPlayoutMaxTurns;
  var turnCount = 0;
  var origPlayer = playerIdx;

  while (!gameOver && turnCount < maxTurns) {
    var actions = getLegalActions(currentPlayerIndex);
    if (actions.length === 0) break;

    var chosen = 0;
    if (currentPlayerIndex === playerIdx) {
      // AI 侧：贪心选最高分
      var bestScore = -Infinity;
      for (var ai = 0; ai < actions.length; ai++) {
        var s = greedyScore(actions[ai], actions[ai].shipIdx !== undefined ? actions[ai].shipIdx : -1);
        if (s > bestScore) { bestScore = s; chosen = ai; }
      }
    } else {
      // 对手侧：加权随机（保持不确定性）
      var totalW = 0;
      var weights = [];
      for (var ai = 0; ai < actions.length; ai++) {
        var a = actions[ai];
        var w = 1;
        if (a.type === 'broadside') w = 6;
        if (a.type === 'ram') w = 8;
        if (a.type === 'board') w = 4;
        if (a.type === 'skill' && a.skill === 'devour') w = 10;
        if (a.type === 'skill' && a.skill === 'surface') w = 6;
        if (a.type === 'skill' && a.skill === 'bowCannon') w = 6;
        if (a.type === 'skill' && a.skill === 'greekFire') w = 5;
        if (a.type === 'skill' && a.skill === 'sharks') w = 4;
        if (a.type === 'skill' && a.skill === 'layMine') w = 3;
        if (a.type === 'skill' && a.skill === 'supply') w = 4;
        if (a.type === 'skill' && a.skill === 'ammoSupport') w = 3;
        if (a.type === 'endTurn') w = 0.3;
        weights.push(w); totalW += w;
      }
      var r = Math.random() * totalW;
      var cum = 0;
      for (var ci = 0; ci < weights.length; ci++) {
        cum += weights[ci];
        if (r <= cum) { chosen = ci; break; }
      }
    }

    executeSimAction(actions[chosen]);
    turnCount++;
  }

  // 评估结果
  if (gameOver) {
    for (var p = 0; p < 2; p++) {
      if (ships.filter(function(s) { return s.playerIndex === p; }).length === 0) {
        return (1 - p) === origPlayer ? 1 : 0;
      }
    }
  }
  // 截断评估
  return evaluateState(origPlayer);
}

// ── 胆怯 AI：攻守平衡型贪心，兼顾杀敌与自保 ──
function timidScore(action, shipIdx) {
  var ship = ships[shipIdx];
  if (!ship) return -100;

  if (action.type === 'move') {
    var dv = DIR_VECTORS[ship.direction];
    var step = ship.submerged ? 2 : 1;
    var nc = ship.col + dv.dx * step, nr = ship.row + dv.dy * step;

    // 距离变化
    var oldDist = 999, newDist = 999;
    var sc = _simCells(ship);
    for (var j = 0; j < ships.length; j++) {
      if (ships[j].playerIndex === ship.playerIndex) continue;
      if (ships[j].submerged) continue;
      var ec = _simCells(ships[j]);
      for (var si = 0; si < sc.length; si++) {
        for (var ei = 0; ei < ec.length; ei++) {
          var d = Math.abs(sc[si].col - ec[ei].col) + Math.abs(sc[si].row - ec[ei].row);
          if (d < oldDist) oldDist = d;
        }
      }
    }
    var nsc = _simCellsAt(ship, nc, nr);
    for (var j2 = 0; j2 < ships.length; j2++) {
      if (ships[j2].playerIndex === ship.playerIndex) continue;
      if (ships[j2].submerged) continue;
      var ec2 = _simCells(ships[j2]);
      for (var si2 = 0; si2 < nsc.length; si2++) {
        for (var ei2 = 0; ei2 < ec2.length; ei2++) {
          var d2 = Math.abs(nsc[si2].col - ec2[ei2].col) + Math.abs(nsc[si2].row - ec2[ei2].row);
          if (d2 < newDist) newDist = d2;
        }
      }
    }
    var distChange = oldDist - newDist;

    // 威胁变化：移动后暴露在敌方舷炮下的变化
    var oldThreat = 0;
    for (var tj = 0; tj < ships.length; tj++) {
      if (ships[tj].playerIndex === ship.playerIndex) continue;
      if (ships[tj].submerged) continue;
      var tbs = _simCountBroadside(ships[tj]);
      oldThreat += tbs.enemy;
    }
    // 临时移动以检测新威胁
    var oldCol = ship.col, oldRow = ship.row;
    ship.col = nc; ship.row = nr;
    var newThreat = 0;
    for (var tk = 0; tk < ships.length; tk++) {
      if (ships[tk].playerIndex === ship.playerIndex) continue;
      if (ships[tk].submerged) continue;
      var tbs2 = _simCountBroadside(ships[tk]);
      newThreat += tbs2.enemy;
    }
    ship.col = oldCol; ship.row = oldRow;
    var threatChange = oldThreat - newThreat; // 正=更安全

    // 综合：鼓励接近但避开炮火，远离时严厉扣分
    var moveScore = 8 + (distChange > 0 ? distChange * 3 : distChange * 4) + threatChange * 4;
    // 距敌1格以内才略扣（舷炮最佳距离2-4格，1格是撞击/接舷预备位）
    if (newDist <= 1 && oldDist > 1) moveScore -= 3;
    // 已经非常接近时不鼓励继续前冲，转交攻击行动评分接管
    if (_wouldBeGrounded(ship, nc, nr)) moveScore -= 20;
    return Math.max(10, moveScore);
  }

  if (action.type === 'turn') {
    var nd2 = (ship.direction + action.delta + 4) % 4;
    var ndv2 = DIR_VECTORS[nd2];
    var bowCol2 = ship.col + ndv2.dx * (ship.length - 1);
    var bowRow2 = ship.row + ndv2.dy * (ship.length - 1);
    var facing = false;
    for (var fj = 0; fj < ships.length; fj++) {
      if (ships[fj].playerIndex === ship.playerIndex) continue;
      if (ships[fj].submerged) continue;
      var fec = _simCells(ships[fj]);
      for (var fi = 0; fi < fec.length; fi++) {
        if ((fec[fi].col - bowCol2) * ndv2.dx + (fec[fi].row - bowRow2) * ndv2.dy > 0) { facing = true; break; }
      }
      if (facing) break;
    }
    return facing ? 7 : 2;
  }

  if (action.type === 'broadside') {
    var bs = _simCountBroadside(ship);
    if (bs.enemy === 0) return -25;
    // 自伤惩罚加重，仅当净收益为正时才开火
    if (bs.self > bs.enemy) return -15;
    return 12 + bs.enemy * 8 - bs.self * 18;
  }

  if (action.type === 'ram') {
    var target = _simFindRammingTarget(shipIdx);
    if (target === null) return -15;
    var enemy = ships[target];
    var dmg = ship.chargeSteps + 1;
    // 伤害交换比：判定接触类型
    var dv3 = DIR_VECTORS[ship.direction];
    var eDv = DIR_VECTORS[enemy.direction];
    var dot = (-dv3.dx) * eDv.dx + (-dv3.dy) * eDv.dy;
    var atkDmg = dot === 0 ? 1 : dmg;  // 侧撞=1，对撞=dmg（攻击方无上限）
    var defDmg = dot === 0 ? dmg : Math.min(dmg, ship.length);  // 对撞时防守方伤害不超过撞击船体积

    // 条件1：对敌伤害 > 己方伤害（净收益）
    if (defDmg > atkDmg) return 20 + (defDmg - atkDmg) * 5;
    // 条件2：同等伤害但小船换大船
    if (defDmg === atkDmg && ship.length < enemy.length) return 15 + (enemy.length - ship.length) * 3;
    // 条件3：能确保击沉（即使自伤更重，但消灭敌方单位）
    if (defDmg >= enemy.hp && enemy.hp <= 2) return 18;
    return -5; // 否则不撞
  }

  if (action.type === 'board') {
    var adjEnemy = _simAdjacentEnemy(shipIdx);
    if (adjEnemy < 0) return -10;
    // 更保守：血量1.5倍才接舷
    if (ship.hp >= ships[adjEnemy].hp * 1.5) return 12;
    return 1;
  }

  if (action.type === 'skill') {
    if (action.skill === 'devour') return 28;
    if (action.skill === 'bowCannon') return 18;
    if (action.skill === 'greekFire') return 15;
    if (action.skill === 'sharks') return 12;
    if (action.skill === 'surface') return 8;
    if (action.skill === 'submerge') return 25; // 偏好保命
    if (action.skill === 'layMine') return 10;
    if (action.skill === 'supply') return 14;
    if (action.skill === 'ammoSupport') return 8;
    return 6;
  }

  if (action.type === 'endTurn') return -5;
  return 0;
}

function timidSearch() {
  var actions = getLegalActions(1);
  if (actions.length === 0) return null;

  // 分别评估攻击行动和非攻击行动
  var best = null;
  var bestScore = -Infinity;

  for (var i = 0; i < actions.length; i++) {
    var a = actions[i];
    if (a.shipIdx === undefined) continue;
    var sc = timidScore(a, a.shipIdx, 1);
    if (sc > bestScore) { bestScore = sc; best = a; }
  }

  // 如果最佳行动分数太低（< 2），选择结束回合而非做无意义行动
  if (bestScore < 2) {
    var endAct = actions.filter(function(a) { return a.type === 'endTurn'; });
    if (endAct.length > 0) return endAct[0];
  }

  return best;
}

// ── 鲁莽 AI：极端攻击型贪心 ──
function recklessScore(action, shipIdx) {
  var ship = ships[shipIdx];
  if (!ship) return -100;

  if (action.type === 'move') {
    var dv = DIR_VECTORS[ship.direction];
    var step = ship.submerged ? 2 : 1;
    var nc = ship.col + dv.dx * step, nr = ship.row + dv.dy * step;
    var oldDist = 999, newDist = 999;
    var sc = _simCells(ship);
    for (var j = 0; j < ships.length; j++) {
      if (ships[j].playerIndex === ship.playerIndex) continue;
      if (ships[j].submerged) continue;
      var ec = _simCells(ships[j]);
      for (var si = 0; si < sc.length; si++) {
        for (var ei = 0; ei < ec.length; ei++) {
          var d = Math.abs(sc[si].col - ec[ei].col) + Math.abs(sc[si].row - ec[ei].row);
          if (d < oldDist) oldDist = d;
        }
      }
    }
    var nsc = _simCellsAt(ship, nc, nr);
    for (var j2 = 0; j2 < ships.length; j2++) {
      if (ships[j2].playerIndex === ship.playerIndex) continue;
      if (ships[j2].submerged) continue;
      var ec2 = _simCells(ships[j2]);
      for (var si2 = 0; si2 < nsc.length; si2++) {
        for (var ei2 = 0; ei2 < ec2.length; ei2++) {
          var d2 = Math.abs(nsc[si2].col - ec2[ei2].col) + Math.abs(nsc[si2].row - ec2[ei2].row);
          if (d2 < newDist) newDist = d2;
        }
      }
    }
    var distChange = oldDist - newDist;
    // 远离敌人时大幅扣分
    if (distChange < 0) distChange *= 3; // 越跑越远，严重扣分
    if (_wouldBeGrounded(ship, nc, nr)) distChange -= 5;
    return Math.max(12, 10 + distChange * 5);
  }
  if (action.type === 'turn') {
    // 转向面对敌人则高分
    var nd = (ship.direction + action.delta + 4) % 4;
    var ndv = DIR_VECTORS[nd];
    var bowCol = ship.col + ndv.dx * (ship.length - 1);
    var bowRow = ship.row + ndv.dy * (ship.length - 1);
    var facing = false;
    for (var fj = 0; fj < ships.length; fj++) {
      if (ships[fj].playerIndex === ship.playerIndex) continue;
      if (ships[fj].submerged) continue;
      var fec = _simCells(ships[fj]);
      for (var fi = 0; fi < fec.length; fi++) {
        if ((fec[fi].col - bowCol) * ndv.dx + (fec[fi].row - bowRow) * ndv.dy > 0) { facing = true; break; }
      }
      if (facing) break;
    }
    return facing ? 8 : 2;
  }
  if (action.type === 'broadside') {
    var bs = _simCountBroadside(ship);
    if (bs.enemy === 0) return -10;
    return 25 + bs.enemy * 10;
  }
  if (action.type === 'ram') return 30 + ship.chargeSteps * 8;
  if (action.type === 'board') return 20;
  if (action.type === 'skill') {
    if (action.skill === 'devour') return 35;
    if (action.skill === 'bowCannon') return 28;
    if (action.skill === 'greekFire') return 25;
    if (action.skill === 'ram') return 30;
    if (action.skill === 'sharks') return 18;
    if (action.skill === 'surface') return 20;
    if (action.skill === 'submerge') return 3; // 鲁莽不喜欢躲
    if (action.skill === 'layMine') return 8;
    if (action.skill === 'supply') return 6;
    if (action.skill === 'ammoSupport') return 4;
    return 10;
  }
  if (action.type === 'endTurn') return -50; // 绝不主动结束
  return 0;
}

function recklessSearch() {
  var actions = getLegalActions(1).filter(function(a) { return a.type !== 'endTurn'; });
  if (actions.length === 0) return null;

  var best = null;
  var bestScore = -Infinity;
  for (var i = 0; i < actions.length; i++) {
    var a = actions[i];
    if (a.shipIdx === undefined) continue;
    var sc = recklessScore(a, a.shipIdx);
    if (sc > bestScore) { bestScore = sc; best = a; }
  }
  return best;
}

// ── 深不可测 AI：多层前瞻 + 位置评估 ──
var _deepRecentActions = []; // 记录最近行动，用于破规律

function deepEvaluate(playerIdx) {
  var myHp = 0, enemyHp = 0, myMaxHp = 0, enemyMaxHp = 0;
  var myShips = 0, enemyShips = 0;
  var myActions = 0, enemyActions = 0;
  var myThreats = 0, enemyThreats = 0; // 受到对方舷炮威胁的格次数
  var myBroadsideCover = 0, enemyBroadsideCover = 0; // 舷炮覆盖敌方次数

  for (var i = 0; i < ships.length; i++) {
    var s = ships[i];
    if (s.boardingTargets.length > 0) continue; // 接舷中跳过行动力统计

    if (s.playerIndex === playerIdx) {
      myHp += s.hp; myMaxHp += s.maxHp; myShips++;
      myActions += s.actionsRemaining;
      var bs = _simCountBroadside(s);
      myBroadsideCover += bs.enemy;
      myThreats += bs.self;
    } else {
      enemyHp += s.hp; enemyMaxHp += s.maxHp; enemyShips++;
      enemyActions += s.actionsRemaining;
      var bs2 = _simCountBroadside(s);
      enemyBroadsideCover += bs2.enemy;
      enemyThreats += bs2.self;
    }
  }

  if (enemyShips === 0) return 1.2;  // 胜利加成
  if (myShips === 0) return -0.1;

  // HP 比值 (0.30)
  var myHpR = myMaxHp > 0 ? myHp / myMaxHp : 0;
  var enHpR = enemyMaxHp > 0 ? enemyHp / enemyMaxHp : 0;
  var hpScore = (myHpR + 0.05) / (myHpR + enHpR + 0.1);

  // 舰船数量比值 (0.20)
  var shipScore = (myShips + 0.5) / (myShips + enemyShips + 1);

  // 行动力比值 (0.12)
  var totalAct = myActions + enemyActions;
  var actScore = totalAct > 0 ? (myActions + 1) / (totalAct + 2) : 0.5;

  // 舷炮威胁差 (0.18)：我方被威胁少 = 好
  var threatDiff = enemyThreats - myThreats;
  var threatScore = 0.5 + Math.max(-0.5, Math.min(0.5, threatDiff * 0.08));

  // 舷炮覆盖差 (0.15)：我能打到的敌人多 = 好
  var coverDiff = myBroadsideCover - enemyBroadsideCover;
  var coverScore = 0.5 + Math.max(-0.5, Math.min(0.5, coverDiff * 0.1));

  // HP 绝对值 (0.05)
  var totalHp = myHp + enemyHp;
  var absScore = totalHp > 0 ? myHp / totalHp : 0.5;

  return 0.30 * hpScore + 0.20 * shipScore + 0.12 * actScore
       + 0.18 * threatScore + 0.15 * coverScore + 0.05 * absScore;
}

function deepGetTopActions(playerIdx, maxCount) {
  var actions = getLegalActions(playerIdx).filter(function(a) { return a.type !== 'endTurn'; });
  if (actions.length === 0) return [];
  var scored = [];
  for (var i = 0; i < actions.length; i++) {
    var a = actions[i];
    if (a.shipIdx === undefined) continue;
    var sc = greedyScore(a, a.shipIdx);
    // 破规律：重复同类型行动轻微扣分
    for (var j = 0; j < _deepRecentActions.length; j++) {
      if (_deepRecentActions[j].type === a.type && _deepRecentActions[j].shipIdx === a.shipIdx) {
        sc -= 2;
      }
    }
    scored.push({ action: a, score: sc });
  }
  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.slice(0, maxCount || 8);
}

function deepSearch() {
  var playerIdx = 1; // AI is always player 1
  var myTop = deepGetTopActions(playerIdx, 8);
  if (myTop.length === 0) return null;

  var bestAction = null;
  var bestScore = -Infinity;

  for (var mi = 0; mi < myTop.length; mi++) {
    var myAction = myTop[mi].action;
    var snap0 = snapshotState();

    // 1. 执行 AI 行动
    executeSimAction(myAction);
    if (gameOver) {
      var endScore = (ships.filter(function(s) { return s.playerIndex === 1; }).length > 0) ? 2 : -1;
      restoreState(snap0);
      if (endScore > bestScore) { bestScore = endScore; bestAction = myAction; }
      continue;
    }

    // 2. 对手前 5 最佳回应
    var oppTop = deepGetTopActions(0, 5);
    var totalScore = 0;
    var evalCount = 0;

    for (var oi = 0; oi < oppTop.length; oi++) {
      var snap1 = snapshotState();
      executeSimAction(oppTop[oi].action);
      if (gameOver) {
        var es2 = (ships.filter(function(s) { return s.playerIndex === 1; }).length > 0) ? 1.5 : -0.5;
        totalScore += es2; evalCount++;
        restoreState(snap1); continue;
      }

      // 3. AI 跟进最佳回应
      var myTop2 = deepGetTopActions(playerIdx, 5);
      var bestFollow = -Infinity;

      for (var m2 = 0; m2 < myTop2.length; m2++) {
        var snap2 = snapshotState();
        executeSimAction(myTop2[m2].action);
        if (gameOver) {
          var es3 = (ships.filter(function(s) { return s.playerIndex === 1; }).length > 0) ? 2 : -1;
          if (es3 > bestFollow) bestFollow = es3;
          restoreState(snap2); continue;
        }
        var posScore = deepEvaluate(playerIdx);
        if (posScore > bestFollow) bestFollow = posScore;
        restoreState(snap2);
      }

      totalScore += bestFollow > -Infinity ? bestFollow : deepEvaluate(playerIdx);
      evalCount++;
      restoreState(snap1);
    }

    var avgScore = evalCount > 0 ? totalScore / evalCount : deepEvaluate(playerIdx);
    restoreState(snap0);

    if (avgScore > bestScore) {
      bestScore = avgScore;
      bestAction = myAction;
    }
  }

  // 记录行动以破规律
  if (bestAction) {
    _deepRecentActions.push({ type: bestAction.type, shipIdx: bestAction.shipIdx });
    if (_deepRecentActions.length > 6) _deepRecentActions.shift();
  }

  return bestAction;
}

// ── MCTS 节点 ──
function MCTSNode(stateSnap, parent, action) {
  this.snap = stateSnap;
  this.parent = parent;
  this.action = action;
  this.children = [];
  this.visits = 0;
  this.wins = 0;
  this.untriedActions = null; // lazy init
}

var MCTS_C = 1.4;

function mctsSelect(node) {
  while (true) {
    if (node.untriedActions === null) {
      restoreState(node.snap);
      node.untriedActions = getLegalActions(currentPlayerIndex);
    }
    if (node.untriedActions.length > 0) {
      // 扩展一个未尝试的行动
      var actIdx = Math.floor(Math.random() * node.untriedActions.length);
      var act = node.untriedActions.splice(actIdx, 1)[0];
      restoreState(node.snap);
      executeSimAction(act);
      var newSnap = snapshotState();
      var child = new MCTSNode(newSnap, node, act);
      node.children.push(child);
      return child;
    }
    if (node.children.length === 0) return node;
    // UCB1 选择
    var best = null;
    var bestUcb = -Infinity;
    for (var i = 0; i < node.children.length; i++) {
      var c = node.children[i];
      var ucb = c.visits > 0
        ? c.wins / c.visits + MCTS_C * Math.sqrt(Math.log(node.visits) / c.visits)
        : Infinity;
      if (ucb > bestUcb) { bestUcb = ucb; best = c; }
    }
    node = best;
  }
}

function mctsBackpropagate(node, result) {
  while (node) {
    node.visits++;
    node.wins += result;
    node = node.parent;
  }
}

// ── MCTS 主入口 ──
function mctsSearch(iterations) {
  // 保存真实游戏状态，确保无论如何都能恢复
  var realSnap = snapshotState();
  var root = new MCTSNode(realSnap, null, null);
  var playerIdx = currentPlayerIndex;
  var bestAction = null;

  try {
    for (var iter = 0; iter < iterations; iter++) {
      try {
        restoreState(root.snap);
        var leaf = mctsSelect(root);
        var result = simPlayout(playerIdx);
        mctsBackpropagate(leaf, result);
      } catch (e) {
        // 单次迭代出错则跳过，继续下一次
        continue;
      }
    }
  } finally {
    // 无论如何恢复真实状态
    restoreState(realSnap);
  }

  // 选择访问次数最多的子节点
  var bestVisits = -1;
  for (var i = 0; i < root.children.length; i++) {
    if (root.children[i].visits > bestVisits) {
      bestVisits = root.children[i].visits;
      bestAction = root.children[i].action;
    }
  }

  return bestAction;
}

// ── AI 自动选船（人机练习） ──
function aiAutoSelect() {
  var allFamous = famousShipLibrary.slice().sort(function() { return Math.random() - 0.5; });
  var famousPool = allFamous.filter(function(s) { return redSelectedFamousNames.indexOf(s.name) < 0; });
  var options = [];
  var normalId = 1;
  for (var i = 0; i < 9; i++) {
    var roll = Math.random();
    if (roll < 0.25 && famousPool.length > 0) {
      var fs = famousPool.shift();
      options.push({ name: fs.name, length: fs.length, price: fs.price, skill: fs.skill, skillData: fs.skillData, flagColor: fs.flagColor, flagShape: fs.flagShape, flagIcon: fs.flagIcon, flagPattern: fs.flagPattern, isFamous: true });
    } else if (roll < 0.55) {
      options.push({ name: '小型舰艇 ' + normalId, length: 1, price: 2, skill: null, skillData: null, isFamous: false });
      normalId++;
    } else if (roll < 0.80) {
      options.push({ name: '中型舰艇 ' + normalId, length: 2, price: 3, skill: null, skillData: null, isFamous: false });
      normalId++;
    } else {
      options.push({ name: '大型舰艇 ' + normalId, length: 3, price: 4, skill: null, skillData: null, isFamous: false });
      normalId++;
    }
  }
  var gold = 15;
  var selected = [];
  function scoreShip(s) {
    var v = s.length / s.price;
    if (s.isFamous && s.skillData) {
      var sd = s.skillData;
      if (sd.sturdy) v += 0.5;
      if (sd.extraBroadside) v += 0.55;
      if (sd.speedy) v += 0.65;
      if (sd.canSubmerge) v += 0.4;
      if (sd.canBowCannon) v += 0.3;
      if (sd.stealth) v += 0.3;
      if (sd.brave) v += 0.3;
      if (sd.cursed) v += 0.3;
      if (sd.canGreekFire) v += 0.3;
      if (sd.canDevour) v += 0.5;
      if (sd.canReleaseSharks) v += 0.4;
      if (sd.deathBlast) v += 0.25;
    }
    return v;
  }
  var scored = options.map(function(s, idx) { return { idx: idx, ship: s, val: scoreShip(s) }; });
  scored.sort(function(a, b) { return b.val - a.val; });
  for (var si = 0; si < scored.length; si++) {
    var s = scored[si];
    if (s.ship.price <= gold) { selected.push(s.ship); gold -= s.ship.price; }
  }
  if (gold >= 3 && selected.length <= 2) {
    gold -= 1;
    options = [];
    normalId = 1;
    famousPool = allFamous.filter(function(s) { return redSelectedFamousNames.indexOf(s.name) < 0; });
    for (var i2 = 0; i2 < 9; i2++) {
      var r2 = Math.random();
      if (r2 < 0.25 && famousPool.length > 0) {
        var fs2 = famousPool.shift();
        options.push({ name: fs2.name, length: fs2.length, price: fs2.price, skill: fs2.skill, skillData: fs2.skillData, flagColor: fs2.flagColor, flagShape: fs2.flagShape, flagIcon: fs2.flagIcon, flagPattern: fs2.flagPattern, isFamous: true });
      } else if (r2 < 0.55) {
        options.push({ name: '小型舰艇 ' + normalId, length: 1, price: 2, skill: null, skillData: null, isFamous: false });
        normalId++;
      } else if (r2 < 0.80) {
        options.push({ name: '中型舰艇 ' + normalId, length: 2, price: 3, skill: null, skillData: null, isFamous: false });
        normalId++;
      } else {
        options.push({ name: '大型舰艇 ' + normalId, length: 3, price: 4, skill: null, skillData: null, isFamous: false });
        normalId++;
      }
    }
    scored = options.map(function(s, idx) { return { idx: idx, ship: s, val: scoreShip(s) }; });
    scored.sort(function(a, b) { return b.val - a.val; });
    for (var sj = 0; sj < scored.length; sj++) {
      var s2 = scored[sj];
      if (s2.ship.price <= gold) { selected.push(s2.ship); gold -= s2.ship.price; }
    }
  }
  if (selected.length === 0) selected = getDefaultFleet();
  activeGamePicks = { red: shipSelectionState.redPicks, blue: selected };
  hideSelectionOverlay();
  startGame();
}

// ── AI 主入口 ──
var aiThinking = false; // MCTS 搜索中标志，防止超时计时器与搜索冲突

function aiTakeTurn() {
  if (gameOver) return;
  if (currentPlayerIndex !== 1) return; // 不是AI回合则直接返回
  clearTimeout(aiFailsafeTimer);

  try {
    // 检查是否有可行动的舰船
    if (!ships || ships.length === 0) return;
    var hasAction = ships.some(function(s) { return s.playerIndex === 1 && s.actionsRemaining > 0 && s.boardingTargets.length === 0; });
    if (!hasAction) {
      log('—— AI 回合结束（无可行动舰船） ——');
      setTimeout(function() {
        if (gameOver) return;
        if (currentPlayerIndex !== 1) return;
        switchToNextPlayer();
      }, 600);
      return;
    }

    // 按难度选择决策系统
    aiThinking = true;
    var bestAction;
    if (aiDifficulty === 'reckless') {
      bestAction = recklessSearch();
    } else if (aiDifficulty === 'timid') {
      bestAction = timidSearch();
    } else if (aiDifficulty === 'deep') {
      // 深不可测：MCTS 蒙特卡洛搜索
      simPlayoutMaxTurns = 8;
      bestAction = mctsSearch(2500);
    } else {
      // 狡诈：多层前瞻 + 位置评估
      _deepRecentActions = [];
      bestAction = deepSearch();
    }
    aiThinking = false;

    // 搜索后检查是否仍为AI回合
    if (currentPlayerIndex !== 1 || gameOver) return;

    // 如果 MCTS 未返回有效行动，退回到随机选一个合法行动
    if (!bestAction || bestAction.type === 'endTurn') {
      try {
        var fallbackActions = getLegalActions(1).filter(function(a) { return a.type !== 'endTurn'; });
        if (fallbackActions.length > 0) {
          bestAction = fallbackActions[Math.floor(Math.random() * fallbackActions.length)];
        } else {
          log('—— AI 回合结束（无合法行动） ——');
          switchToNextPlayer();
          return;
        }
      } catch (e2) {
        console.error('AI fallback 异常:', e2);
        switchToNextPlayer();
        return;
      }
    }

    // 机动优先：如果能前进，就不要光转向（狭窄水域安全网）
    if (bestAction && bestAction.type === 'turn') {
      var moveActs = getLegalActions(1).filter(function(a) { return a.type === 'move'; });
      if (moveActs.length > 0) {
        var bestM = moveActs[0], bestMS = -Infinity;
        for (var mi = 0; mi < moveActs.length; mi++) {
          var ms = greedyScore(moveActs[mi], moveActs[mi].shipIdx);
          if (ms > bestMS) { bestMS = ms; bestM = moveActs[mi]; }
        }
        bestAction = bestM;
      }
    }

    // 重新设置超时保护（仅针对行动执行阶段）
    aiFailsafeTimer = setTimeout(function() {
      if (gameOver) return;
      if (currentPlayerIndex !== 1) return;
      log('AI 行动超时，强制结束回合');
      switchToNextPlayer();
    }, 10000);

    // 执行选中的行动
    if (bestAction.shipIdx !== undefined) {
      selectedShipIndex = bestAction.shipIdx;
    }
    updateInfoPanel();
    render();

    setTimeout(function() {
      if (gameOver) { clearTimeout(aiFailsafeTimer); return; }
      if (currentPlayerIndex !== 1) { clearTimeout(aiFailsafeTimer); return; }
      var actionOk = true;
      if (bestAction.type === 'move') actionOk = moveShipForward();
      else if (bestAction.type === 'turn') actionOk = turnShip(bestAction.delta);
      else if (bestAction.type === 'broadside') actionOk = fireBroadside();
      else if (bestAction.type === 'ram') actionOk = initiateRamming();
      else if (bestAction.type === 'board') actionOk = initiateBoarding();
      else if (bestAction.type === 'skill') {
        if (bestAction.skill === 'submerge') actionOk = submergeShip();
        else if (bestAction.skill === 'surface') actionOk = surfaceShip();
        else if (bestAction.skill === 'bowCannon') actionOk = fireBowCannon();
        else if (bestAction.skill === 'greekFire') actionOk = fireGreekFire();
        else if (bestAction.skill === 'devour') actionOk = devourShip();
        else if (bestAction.skill === 'sharks') actionOk = releaseSharks();
        else if (bestAction.skill === 'layMine') actionOk = enterMinePlacementAI();
        else if (bestAction.skill === 'supply') actionOk = supplyShip();
        else if (bestAction.skill === 'ammoSupport') actionOk = ammoSupport();
      }
      clearTimeout(aiFailsafeTimer);
      // 行动失败则强制结束回合
      if (!actionOk && currentPlayerIndex === 1 && !gameOver) {
        log('—— AI 行动受阻，强制结束回合 ——');
        switchToNextPlayer();
        return;
      }
      updateInfoPanel(); render();
      // 检查是否仍在AI回合（行动可能触发回合切换）
      if (currentPlayerIndex === 1 && !gameOver) {
        setTimeout(function() { aiTakeTurn(); }, 300);
      }
    }, 350);
  } catch (e) {
    console.error('AI 异常:', e);
    aiThinking = false;
    clearTimeout(aiFailsafeTimer);
    if (currentPlayerIndex === 1) switchToNextPlayer();
  }
}
