// ═══════════════════════════════════════
//  Naval Chess — 战斗系统与回合管理
//  加载顺序：第5个（依赖 config.js, utils.js, render.js, ui.js）
// ═══════════════════════════════════════

// ── 查找与指定舰船舷侧相邻的敌方舰船索引 ──
function findAdjacentEnemy(shipIndex) {
  var ship = ships[shipIndex];
  if (!ship) return -1;
  var shipCells = getShipCells(ship);
  var aDv = DIR_VECTORS[ship.direction];

  for (var j = 0; j < ships.length; j++) {
    if (j === shipIndex) continue;
    if (ships[j].playerIndex === ship.playerIndex) continue;
    if (ships[j].submerged) continue;
    if (ships[j].skillData && ships[j].skillData.cursed) continue;

    var enemy = ships[j];
    var enemyCells = getShipCells(enemy);
    var bDv = DIR_VECTORS[enemy.direction];

    for (var sci = 0; sci < shipCells.length; sci++) {
      var sc = shipCells[sci];
      for (var eci = 0; eci < enemyCells.length; eci++) {
        var ec = enemyCells[eci];
        var dc = ec.col - sc.col;
        var dr = ec.row - sc.row;
        if (Math.abs(dc) + Math.abs(dr) !== 1) continue;
        if ((dc * aDv.dx + dr * aDv.dy) !== 0) continue;
        if ((dc * bDv.dx + dr * bDv.dy) !== 0) continue;
        return j;
      }
    }
  }
  return -1;
}

/** 检查两艘特定舰船是否仍满足舷侧相邻（接舷战条件） */
function areShipsBroadsideAdjacent(idxA, idxB) {
  var shipA = ships[idxA];
  var shipB = ships[idxB];
  if (!shipA || !shipB) return false;
  if (shipA.submerged || shipB.submerged) return false;
  var cellsA = getShipCells(shipA);
  var cellsB = getShipCells(shipB);
  var aDv = DIR_VECTORS[shipA.direction];
  var bDv = DIR_VECTORS[shipB.direction];
  for (var ai = 0; ai < cellsA.length; ai++) {
    var ac = cellsA[ai];
    for (var bi = 0; bi < cellsB.length; bi++) {
      var bc = cellsB[bi];
      var dc = bc.col - ac.col;
      var dr = bc.row - ac.row;
      if (Math.abs(dc) + Math.abs(dr) !== 1) continue;
      if ((dc * aDv.dx + dr * aDv.dy) !== 0) continue;
      if ((dc * bDv.dx + dr * bDv.dy) !== 0) continue;
      return true;
    }
  }
  return false;
}

/** 遍历所有接舷关系，解除已不再舷侧相邻的组合 */
function clearBrokenBoarding() {
  for (var i = 0; i < ships.length; i++) {
    var ship = ships[i];
    if (ship.boardingTargets.length === 0) continue;
    for (var ti = ship.boardingTargets.length - 1; ti >= 0; ti--) {
      var targetIdx = ship.boardingTargets[ti];
      if (!areShipsBroadsideAdjacent(i, targetIdx)) {
        // 从双方移除接舷引用
        var target = ships[targetIdx];
        if (target) {
          target.boardingTargets = target.boardingTargets.filter(function(idx) { return idx !== i; });
          if (target.boardingTargets.length === 0) {
            log(`${shipName(targetIdx)} 因碰撞脱离接触，接舷战结束`);
          }
        }
        ship.boardingTargets.splice(ti, 1);
        if (ship.boardingTargets.length === 0) {
          log(`${shipName(i)} 因碰撞脱离接触，接舷战结束，恢复行动力`);
          ship.actionsRemaining = ship.maxActions;
        }
      }
    }
  }
}

// ── 移除舰船（处理接舷引用和索引偏移） ──
function removeShip(shipIndex) {
  const ship = ships[shipIndex];

  // 殉爆：被击沉时对周围3×3区域所有船只造成1点伤害
  if (ship.skillData && ship.skillData.deathBlast) {
    var blastCells = getShipCells(ship);
    var blastedShips = {};
    for (var bi = 0; bi < blastCells.length; bi++) {
      var bc = blastCells[bi];
      for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
          var hitIdx = findShipAt(bc.col + dx, bc.row + dy);
          if (hitIdx >= 0 && hitIdx !== shipIndex) {
            blastedShips[hitIdx] = true;
          }
        }
      }
    }
    var blastIndices = Object.keys(blastedShips);
    for (var bj = 0; bj < blastIndices.length; bj++) {
      var biIdx = parseInt(blastIndices[bj]);
      var blastTarget = ships[biIdx];
      blastTarget.hp--;
      addHitEffect(blastTarget.col, blastTarget.row, '💥');
      log(`${shipName(biIdx)} 受到殉爆伤害（剩余 ${blastTarget.hp} HP）`);
      if (blastTarget.hp <= 0) {
        logSink(biIdx, shipIndex, '殉爆击沉');
      }
    }
  }

  for (const s of ships) {
    if (s === ship) continue;
    s.boardingTargets = s.boardingTargets.filter(function(idx) { return idx !== shipIndex; });
    // 清理吞噬引用
    if (s.devourTarget === shipIndex) {
      s.devourTarget = -1;
      s.devourProgress = 0;
    }
  }
  for (const targetIdx of ship.boardingTargets) {
    const target = ships[targetIdx];
    if (target) {
      target.boardingTargets = target.boardingTargets.filter(function(idx) { return idx !== shipIndex; });
      if (target.boardingTargets.length === 0) {
        log(`${shipName(targetIdx)} 接舷战结束，恢复自由，行动力重置`);
        target.actionsRemaining = target.maxActions;
      }
    }
  }
  // 清理吞噬引用（被移除的船是吞噬目标时）
  for (const s of ships) {
    if (s.devourTarget >= 0) {
      if (s.devourTarget > shipIndex) s.devourTarget--;
      else if (s.devourTarget === shipIndex) { s.devourTarget = -1; s.devourProgress = 0; }
    }
  }
  ships.splice(shipIndex, 1);
  for (const s of ships) {
    s.boardingTargets = s.boardingTargets.map(function(idx) { return idx > shipIndex ? idx - 1 : idx; });
  }
  if (selectedShipIndex === shipIndex) selectedShipIndex = -1;
  else if (selectedShipIndex > shipIndex) selectedShipIndex--;

  // 清理因殉爆等连锁效应导致 HP ≤ 0 的僵尸船
  var found = true;
  while (found && !gameOver) {
    found = false;
    for (var di = ships.length - 1; di >= 0; di--) {
      if (ships[di].hp <= 0) {
        log(shipName(di) + ' 因连锁效应被击沉（HP归零）');
        removeShip(di);
        found = true;
        break;
      }
    }
  }
}

// ── 胜利检查 ──
function checkVictory() {
  if (gameOver) return;
  const pNames = ['葡萄牙帝国', '荷兰东印度公司'];
  for (let p = 0; p < 2; p++) {
    const alive = ships.filter(function(s) { return s.playerIndex === p; });
    if (alive.length === 0) {
      gameOver = true;
      const winner = 1 - p;
      const kills = playerKills[winner];
      document.getElementById('victoryFaction').textContent = pNames[winner] + ' 获得胜利';
      document.getElementById('victoryTurnNum').textContent = currentTurn;
      document.getElementById('victoryShipsLeft').textContent = ships.filter(function(s) { return s.playerIndex === winner; }).length;
      document.getElementById('victoryRamKills').textContent = kills.ram;
      document.getElementById('victoryBroadsideKills').textContent = kills.broadside;
      document.getElementById('victoryBoardingKills').textContent = kills.boarding;
      var vo = document.getElementById('victoryOverlay');
      vo.classList.remove('hidden');
      vo.style.display = 'flex';
      document.getElementById('btnEndTurn').disabled = true;
      document.getElementById('btnReset').disabled = true;
      updateInfoPanel();
      render();
      log(`—— ${pNames[winner]} 获得胜利！ ——`);
      if (inCampaign && winner === 0) { completeCurrentLevel(); }
      return;
    }
  }
}

// ── 处理接舷战伤害 ──
function processBoardingDamage() {
  var defeatedObjs = [];
  for (var i = 0; i < ships.length; i++) {
    var ship = ships[i];
    if (ship.playerIndex === currentPlayerIndex && ship.boardingTargets.length > 0) {
      // 每船每回合只对一个接舷目标造成1点伤害（取第一个）
      var targetIdx = ship.boardingTargets[0];
      var enemy = ships[targetIdx];
      if (!enemy) continue;
      // 英勇：免疫第一次接舷伤害
      if (enemy.braveActive) {
        enemy.braveActive = false;
        addHitEffect(enemy.col, enemy.row, '🛡️');
        log(`无畏号的英勇技能免疫了第一次接舷伤害！`);
        continue;
      }
      enemy.hp--;
      log(`接舷战：${shipName(i)} 对 ${shipName(targetIdx)} 造成 1 点伤害（剩余 ${enemy.hp} HP）`);
      if (enemy.hp <= 0 && defeatedObjs.indexOf(enemy) < 0) {
        defeatedObjs.push(enemy);
      }
    }
  }
  if (defeatedObjs.length > 0) {
    playerKills[currentPlayerIndex].boarding += defeatedObjs.length;
  }
  for (var di = 0; di < defeatedObjs.length; di++) {
    var curIdx = ships.indexOf(defeatedObjs[di]);
    if (curIdx >= 0) {
      var victim = defeatedObjs[di];
      var killerIdx = (victim.boardingTargets.length > 0) ? victim.boardingTargets[0] : -1;
      logSink(curIdx, killerIdx >= 0 ? killerIdx : curIdx, '接舷击沉');
      removeShip(curIdx);
    }
  }
  checkVictory();
}

// ── 鲨鱼移动（每回合结束时被 switchToNextPlayer 调用） ──
function moveSharks() {
  var surviving = [];
  for (var si = 0; si < sharks.length; si++) {
    var shark = sharks[si];
    // 刚释放的鲨鱼本回合不移动
    if (shark.justSpawned) {
      shark.justSpawned = false;
      surviving.push(shark);
      continue;
    }
    shark.col += shark.dx;
    shark.row += shark.dy;
    // 越界消失
    if (shark.col < 0 || shark.col >= GRID_SIZE || shark.row < 0 || shark.row >= GRID_SIZE) continue;
    // 撞击检查
    var hitIdx = findShipAt(shark.col, shark.row);
    if (hitIdx >= 0) {
      if (ships[hitIdx].skillData && ships[hitIdx].skillData.canReleaseSharks) {
        surviving.push(shark);
        continue;
      }
      ships[hitIdx].hp--;
      addHitEffect(shark.col, shark.row, '☣️');
      log(`鲨鱼撞击${shipName(hitIdx)}，造成 1 点伤害（剩余 ${ships[hitIdx].hp} HP）`);
      if (ships[hitIdx].hp <= 0) {
        log(shipName(hitIdx) + ' 被 鲨鱼 鲨鱼击沉');
        playerKills[ships[hitIdx].playerIndex === 0 ? 1 : 0].ram++;
        removeShip(hitIdx);
        checkVictory();
      }
      continue;
    }
    surviving.push(shark);
  }
  sharks = surviving;
}

// ── 检查船只移动/转向是否撞上鲨鱼 ──
function checkSharkCollision(cells, ship) {
  if (sharks.length === 0) return;
  if (ship.skillData && ship.skillData.canReleaseSharks) return; // 沉默玛丽号免疫鲨鱼
  var shipIdx = ships.indexOf(ship);
  for (var si = sharks.length - 1; si >= 0; si--) {
    for (var ci = 0; ci < cells.length; ci++) {
      if (sharks[si].col === cells[ci].col && sharks[si].row === cells[ci].row) {
        ship.hp--;
        addHitEffect(sharks[si].col, sharks[si].row, '☣️');
        log(shipName(shipIdx) + ' 移动时撞上鲨鱼，受到 1 点伤害（剩余 ' + ship.hp + ' HP）');
        sharks.splice(si, 1);
        if (ship.hp <= 0) {
          logSink(shipIdx, shipIdx, '鲨鱼撞击');
          removeShip(shipIdx);
          checkVictory();
          return true; // 船只已沉，无需继续检查
        }
        break;
      }
    }
  }
  return false;
}

// ── 检查船只移动/转向是否撞上水雷 ──
function checkMineCollision(cells, ship) {
  if (mines.length === 0) return false;
  var shipIdx = ships.indexOf(ship);
  for (var mi = mines.length - 1; mi >= 0; mi--) {
    for (var ci = 0; ci < cells.length; ci++) {
      if (mines[mi].col === cells[ci].col && mines[mi].row === cells[ci].row) {
        ship.hp--;
        addHitEffect(mines[mi].col, mines[mi].row, '💥');
        log(`${shipName(shipIdx)} 触发了水雷，受到 1 点伤害（剩余 ${ship.hp} HP）`);
        mines.splice(mi, 1);
        if (ship.hp <= 0) {
          logSink(shipIdx, shipIdx, '水雷');
          removeShip(shipIdx);
          checkVictory();
          return true;
        }
        break;
      }
    }
  }
  return false;
}

// ── 切换到下一个玩家 ──
function switchToNextPlayer() {
  if (gameOver) return;
  clearTimeout(aiFailsafeTimer);
  processBoardingDamage();
  if (gameOver) return;

  var playerCount = 2;
  currentPlayerIndex = (currentPlayerIndex + 1) % playerCount;
  if (currentPlayerIndex === 0) currentTurn++;

  ships.forEach(function(s) {
    if (s.playerIndex === currentPlayerIndex) {
      s.actionsRemaining = s.maxActions;
      s.stepsMoved = 0;
      s.chargeSteps = 0;
      if (s.ironArmorMoves !== undefined) s.ironArmorMoves = 0;
      // 舷炮次数全局不重置（每局每船 1 次，努力号 2 次）
      // 下潜回合递减
      if (s.submerged) {
        s.submergedTurns--;
        if (s.submergedTurns <= 0) {
          // 自动上浮，检查碰撞
          s.submerged = false;
          var sIdx = ships.indexOf(s);
          var cells = getShipCells(s);
          var blockedShips = [];
          for (var ci = 0; ci < cells.length; ci++) {
            for (var bj = 0; bj < ships.length; bj++) {
              if (bj === sIdx) continue;
              if (ships[bj].submerged) continue;
              var bCells = getShipCells(ships[bj]);
              if (bCells.some(function(bc) { return bc.col === cells[ci].col && bc.row === cells[ci].row; })) {
                if (blockedShips.indexOf(bj) < 0) blockedShips.push(bj);
              }
            }
          }
          if (blockedShips.length > 0) {
            var dmg = s.hp;
            s.hp -= dmg;
            var sIdx = ships.indexOf(s);
            log(shipName(sIdx) + ' 下潜时间到，上浮碰撞，自身受到 ' + dmg + ' 点伤害（剩余 ' + s.hp + ' HP）');
            for (var bi = 0; bi < blockedShips.length; bi++) {
              var blocker = ships[blockedShips[bi]];
              blocker.hp -= dmg;
              log(shipName(blockedShips[bi]) + ' 受到上浮碰撞 ' + dmg + ' 点伤害（剩余 ' + blocker.hp + ' HP）');
              if (blocker.hp <= 0) logSink(blockedShips[bi], sIdx, '同归于尽');
            }
            if (s.hp <= 0) logSink(sIdx, sIdx, '同归于尽');
            // 清理被击沉的船（用对象引用避免连锁移除索引错位）
            var allDead = [];
            for (var di = 0; di < ships.length; di++) {
              if (ships[di].hp <= 0) allDead.push(ships[di]);
            }
            for (var di2 = 0; di2 < allDead.length; di2++) {
              var curIdx = ships.indexOf(allDead[di2]);
              if (curIdx >= 0) removeShip(curIdx);
            }
            checkVictory();
          } else {
            log(`飞翔荷兰人号下潜时间到，自动上浮`);
          }
        }
      }
    }
  });

  // 鲨鱼移动（每回合结束，不论哪一方）
  moveSharks();

  selectedShipIndex = -1;
  updatePlayerDisplay();
  updateInfoPanel();
  render();

  var pNames = ['葡萄牙帝国', '荷兰东印度公司'];
  var who = (gameMode === 'ai' || inCampaign) && currentPlayerIndex === 1 ? '电脑' : '玩家' + (currentPlayerIndex + 1);
  log(`—— 轮到${who}（${pNames[currentPlayerIndex]}）行动 ——`);
}

// ── 船头撞击辅助 ──

/** 计算舰船旋转时扫过的所有格子（用于碰撞检测） */
function getSweptCells(ship, newDir) {
  var cells = [];
  var oldDv = DIR_VECTORS[ship.direction];
  var newDv = DIR_VECTORS[newDir];
  for (var i = 1; i < ship.length; i++) {
    var cx = ship.col + oldDv.dx * i;
    var cy = ship.row + oldDv.dy * i;
    var nx = ship.col + newDv.dx * i;
    var ny = ship.row + newDv.dy * i;
    var minX = Math.min(cx, nx);
    var maxX = Math.max(cx, nx);
    var minY = Math.min(cy, ny);
    var maxY = Math.max(cy, ny);
    for (var x = minX; x <= maxX; x++) {
      for (var y = minY; y <= maxY; y++) {
        cells.push({ col: x, row: y });
      }
    }
  }
  return cells;
}

/** 查找船头前方第2格的敌方舰船（用于船头撞击冲锋） */
function findRammingTarget(shipIndex) {
  var ship = ships[shipIndex];
  if (!ship) return null;
  var dv = DIR_VECTORS[ship.direction];
  var bowCol = ship.col + dv.dx * (ship.length - 1);
  var bowRow = ship.row + dv.dy * (ship.length - 1);

  // 中间格必须为空（船头可穿过）
  var gapCol = bowCol + dv.dx;
  var gapRow = bowRow + dv.dy;
  if (gapCol < 0 || gapCol >= GRID_SIZE || gapRow < 0 || gapRow >= GRID_SIZE) return null;
  if (findShipAt(gapCol, gapRow) >= 0) return null;

  // 目标在第2格
  var targetCol = bowCol + dv.dx * 2;
  var targetRow = bowRow + dv.dy * 2;
  if (targetCol < 0 || targetCol >= GRID_SIZE || targetRow < 0 || targetRow >= GRID_SIZE) return null;

  for (var j = 0; j < ships.length; j++) {
    if (j === shipIndex) continue;
    if (ships[j].playerIndex === ship.playerIndex) continue;
    if (ships[j].submerged) continue;
    var eCells = getShipCells(ships[j]);
    if (eCells.some(function(c) { return c.col === targetCol && c.row === targetRow; })) {
      var eDv = DIR_VECTORS[ships[j].direction];
      var ndx = -dv.dx;
      var ndy = -dv.dy;
      var dot = ndx * eDv.dx + ndy * eDv.dy;
      var contactType = dot === 0 ? 'side' : 'bowstern';
      return { enemyIdx: j, contactType: contactType };
    }
  }
  return null;
}

/** 查找船头当前紧贴的敌方舰船（用于吞噬等需要实际接触的技能） */
function findBowContact(shipIndex) {
  var ship = ships[shipIndex];
  if (!ship) return null;
  var dv = DIR_VECTORS[ship.direction];
  var bowCol = ship.col + dv.dx * (ship.length - 1);
  var bowRow = ship.row + dv.dy * (ship.length - 1);
  var targetCol = bowCol + dv.dx;
  var targetRow = bowRow + dv.dy;

  for (var j = 0; j < ships.length; j++) {
    if (j === shipIndex) continue;
    if (ships[j].playerIndex === ship.playerIndex) continue;
    if (ships[j].submerged) continue;
    var eCells = getShipCells(ships[j]);
    if (eCells.some(function(c) { return c.col === targetCol && c.row === targetRow; })) {
      var eDv = DIR_VECTORS[ships[j].direction];
      var ndx = -dv.dx;
      var ndy = -dv.dy;
      var dot = ndx * eDv.dx + ndy * eDv.dy;
      var contactType = dot === 0 ? 'side' : 'bowstern';
      return { enemyIdx: j, contactType: contactType };
    }
  }
  return null;
}

/** 将舰船沿给定方向推动至多 maxSteps 格 */
function pushShip(ship, shipIndex, dx, dy, maxSteps) {
  var steps = 0;
  for (var s = 1; s <= maxSteps; s++) {
    var newCells = getShipCellsAt(ship, ship.col + dx * s, ship.row + dy * s);
    var blocked = false;
    for (const c of newCells) {
      if (c.col < 0 || c.col >= GRID_SIZE || c.row < 0 || c.row >= GRID_SIZE) { blocked = true; break; }
      if (isCellOccupied(c.col, c.row, shipIndex)) { blocked = true; break; }
    }
    if (blocked) break;
    steps = s;
  }
  if (steps > 0) {
    ship.col += dx * steps;
    ship.row += dy * steps;
    log(`${shipName(shipIndex)} 被击退 ${steps} 格`);
  }
  return steps;
}
