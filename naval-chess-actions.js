// ═══════════════════════════════════════
//  Naval Chess — 玩家行动
//  加载顺序：第6个（依赖 config, utils, render, ui, combat）
// ═══════════════════════════════════════

// ── 行动后处理（扣减行动力、检查耗尽、自动切换回合） ──
function afterShipAction(ship, actionDesc, cost) {
  if (gameOver) return;

  ship.actionsRemaining -= cost;
  log(`${actionDesc}（消耗 ${cost}），剩余行动 ${ship.actionsRemaining}`);

  // 多人联机：仅本地行动才发送到对手（远程执行不重复发送）
  if (mpGameStarted && !mpRemoteExec && mpPendingAction) {
    mpPendingAction.shipIdx = ships.indexOf(ship);
    sendAction(mpPendingAction);
    mpPendingAction = null;
  }

  clearBrokenBoarding(); // 移动/转向后清理不再接触的接舷关系

  if (ship.actionsRemaining <= 0) {
    if (!mpRemoteExec) {
      selectedShipIndex = -1;
      log(`舰船行动力耗尽，已取消选中`);
    }
  }

  checkDevourContacts();
  if (isCurrentPlayerExhausted() && !(mpGameStarted && mpRemoteExec)) {
    if (mpGameStarted) {
      // 联机模式：向服务器发送 endTurn，等待 turnSwitched，不本地切换
      if (!sendEndTurn()) {
        log('[联机] 无法发送结束回合消息，请检查网络连接');
        return;
      }
      mpWaitForTurnSwitch();
      log('所有舰船行动耗尽，等待服务器确认回合切换…');
    } else {
      log(`${currentPlayerIndex === 1 && gameMode === 'ai' ? '电脑' : '玩家' + (currentPlayerIndex + 1)} 所有舰船行动耗尽，自动切换回合`);
      switchToNextPlayer();
      if (gameMode === 'ai' && currentPlayerIndex === 1) {
        setTimeout(function() { aiTakeTurn(); }, 500);
      }
    }
  } else if (!mpRemoteExec) {
    // 远程执行时不刷新信息面板，避免干扰本地玩家的选中状态
    updateInfoPanel();
    render();
  } else {
    // 远程执行：只刷新棋盘，不动面板
    render();
  }
}

// ── 移动逻辑 ──
function moveShipForward() {
  if (gameOver) return false;
  if (selectedShipIndex < 0) return false;
  const ship = ships[selectedShipIndex];
  if (ship.playerIndex !== currentPlayerIndex) return false;
  if (ship.boardingTargets.length > 0) { log('无法前进：正处于接舷战中'); return false; }
  if (ship.actionsRemaining < 1) return false;

  const dv = DIR_VECTORS[ship.direction];
  // 铁甲：每回合最多前进2次
  if (ship.skillData && ship.skillData.ironArmor && ship.ironArmorMoves >= 2) {
    log('铁甲限制：本回合已前进2次，无法再前进');
    return false;
  }
  const step = ship.submerged ? 2 : 1;
  const newHeadCol = ship.col + dv.dx * step;
  const newHeadRow = ship.row + dv.dy * step;

  const newCells = getShipCellsAt(ship, newHeadCol, newHeadRow);
  for (const c of newCells) {
    if (c.col < 0 || c.col >= GRID_SIZE || c.row < 0 || c.row >= GRID_SIZE) {
      log(`无法前进：前方是地图边界`);
      return false;
    }
  }

  // 检查终点格：下潜可穿过中途舰船但不允许终点重叠
  for (const c of newCells) {
    if (isCellOccupied(c.col, c.row, selectedShipIndex)) {
      log(`无法前进：前方有舰船阻挡`);
      return false;
    }
  }

  ship.col = newHeadCol;
  ship.row = newHeadRow;
  ship.stepsMoved += step;
  ship.chargeSteps += step;
  if (ship.skillData && ship.skillData.ironArmor) ship.ironArmorMoves++;
  // 检查是否撞上鲨鱼/水雷
  if (!ship.submerged) {
    var destroyed = checkSharkCollision(getShipCells(ship), ship);
    if (destroyed) return true;
    if (checkMineCollision(getShipCells(ship), ship)) return true;
  }
  const coord = `${String.fromCharCode(65 + ship.col)}${ship.row + 1}`;
  const dirName = DIR_NAMES[ship.direction];
  mpPendingAction = { type: 'move' };
  afterShipAction(ship, `${shipName(selectedShipIndex)} 向${dirName}前进至 ${coord}（本回合已前进 ${ship.stepsMoved} 格）`, 1);
  return true;
}

// ── 转向逻辑（以船尾(col,row)为圆心旋转） ──
function turnShip(delta) {
  if (gameOver) return false;
  if (selectedShipIndex < 0) return false;
  const ship = ships[selectedShipIndex];
  if (ship.playerIndex !== currentPlayerIndex) return false;
  if (ship.boardingTargets.length > 0) { log('无法转向：正处于接舷战中'); return false; }
  var turnCost = getTurnCost(ship);
  if (ship.actionsRemaining < turnCost) {
    log(`无法转向：行动力不足（需 ${turnCost}，剩余 ${ship.actionsRemaining}）`);
    return false;
  }

  const newDir = (ship.direction + delta + 4) % 4;
  const newDv = DIR_VECTORS[newDir];

  // 下潜舰船转向时可以穿过其他舰船
  var swept = [];
  if (!ship.submerged) {
    for (let i = 0; i < ship.length; i++) {
      const cx = ship.col + newDv.dx * i;
      const cy = ship.row + newDv.dy * i;
      if (cx < 0 || cx >= GRID_SIZE || cy < 0 || cy >= GRID_SIZE) {
        log(`无法转向：转向后超出地图边界`);
        return false;
      }
      if (isCellOccupied(cx, cy, selectedShipIndex)) {
        log(`无法转向：目标格被其他舰船占据`);
        return false;
      }
    }

    swept = getSweptCells(ship, newDir);
    for (const c of swept) {
      if (c.col < 0 || c.col >= GRID_SIZE || c.row < 0 || c.row >= GRID_SIZE) {
        log(`无法转向：转向扫过区域超出地图边界`);
        return false;
      }
      if (isCellOccupied(c.col, c.row, selectedShipIndex)) {
        log(`无法转向：转向扫过区域被其他舰船阻挡`);
        return false;
      }
    }
  }

  // 检查转向时是否扫过鲨鱼/水雷
  if (!ship.submerged && swept.length > 0) {
    var destroyed = checkSharkCollision(swept, ship);
    if (destroyed) return true;
    if (checkMineCollision(swept, ship)) return true;
  }

  ship.direction = newDir;
  ship.chargeSteps = 0; // 转向重置冲锋速度

  const turnName = delta === -1 ? '左转' : '右转';
  mpPendingAction = { type: 'turn', delta: delta };
  afterShipAction(ship, `${shipName(selectedShipIndex)} ${turnName}90°至${DIR_NAMES[newDir]}方`, turnCost);
  return true;
}

// ── 舷炮炮击 ──
function fireBroadside() {
  if (gameOver) return false;
  if (selectedShipIndex < 0) return false;
  const ship = ships[selectedShipIndex];
  if (ship.playerIndex !== currentPlayerIndex) return false;
  if (ship.boardingTargets.length > 0) { log('无法开火：正处于接舷战中'); return false; }
  if (ship.submerged) { log('无法开火：正处于下潜状态'); return false; }
  if (ship.actionsRemaining < 1) { log('行动力不足，无法开火'); return false; }
  if (ship.broadsideCount >= ship.maxBroadsideCount) { log('无法开火：舷炮已用完'); return false; }

  const dv = DIR_VECTORS[ship.direction];
  const sideDirs = [
    { dx: -dv.dy, dy: dv.dx },
    { dx: dv.dy, dy: -dv.dx }
  ];

  const hits = [];
  let selfDamage = 0;
  const contactedCells = new Set();
  for (const sd of sideDirs) {
    for (let i = 0; i < ship.length; i++) {
      const ox = ship.col + dv.dx * i;
      const oy = ship.row + dv.dy * i;
      var broadRange = ship.skillData && ship.skillData.firepowerBoost ? 3 : 2;
      for (let r = 1; r <= broadRange; r++) {
        const tc = ox + sd.dx * r;
        const tr = oy + sd.dy * r;
        if (tc < 0 || tc >= GRID_SIZE || tr < 0 || tr >= GRID_SIZE) break;
        const hitIdx = findShipAt(tc, tr);
        if (hitIdx >= 0 && hitIdx !== selectedShipIndex) {
          // 隐蔽：未与敌方接触时无法被火炮命中
          var hitShip = ships[hitIdx];
          if (hitShip.skillData && hitShip.skillData.stealth && !isAdjacentToEnemy(hitIdx)) {
            addHitEffect(tc, tr, '🛡️');
            continue;
          }
          if (!hits.some(function(h) { return h.shipIdx === hitIdx && h.col === tc && h.row === tr; })) {
            const isFriendly = ships[hitIdx].playerIndex === ship.playerIndex;
            // 铁甲判定：炮弹方向垂直于铁甲舰方向→命中船舷；平行→命中船头/船尾，铁甲不生效
            var hitsBroadside = true;
            if (hitShip.skillData && hitShip.skillData.ironArmor) {
              var ironcladDv = DIR_VECTORS[hitShip.direction];
              hitsBroadside = (sd.dx * ironcladDv.dx + sd.dy * ironcladDv.dy === 0);
            }
            hits.push({ shipIdx: hitIdx, col: tc, row: tr, isFriendly: isFriendly, range: r, hitsBroadside: hitsBroadside });
            if (!isFriendly && r === 1) {
              const cellKey = `${ox},${oy}`;
              if (!contactedCells.has(cellKey)) {
                contactedCells.add(cellKey);
                selfDamage++;
              }
            }
          }
          break;
        }
      }
    }
  }

  // 铁甲：一轮舷炮自伤至多1点（多枚视作一次），伤害-1（可减至0）
  if (ship.skillData && ship.skillData.ironArmor) selfDamage = Math.min(selfDamage, 1);
  if (selfDamage > 0) {
    var actualDmg = selfDamage;
    if (ship.skillData && ship.skillData.ironArmor) {
      actualDmg = selfDamage - 1;
      if (selfDamage > actualDmg) addHitEffect(ship.col, ship.row, '🛡️');
    }
    if (actualDmg > 0) {
      ship.hp -= actualDmg;
      log(`舷炮贴脸开火！${shipName(selectedShipIndex)} 有 ${selfDamage} 格与敌舰贴身，自身受到 ${actualDmg} 点反冲伤害（剩余 ${ship.hp} HP）`);
    } else {
      log(`舷炮贴脸开火！${shipName(selectedShipIndex)} 的铁甲完全抵御了反冲伤害`);
    }
  }

  // 铁甲：每轮舷炮中命中船舷的多枚视作1次，总伤害-1（至少1点）；命中船头/船尾不触发减伤
  var ironArmorHits = {};
  for (const hit of hits) {
    ships[hit.shipIdx].hp--;
    addHitEffect(hit.col, hit.row);
    const tag = hit.isFriendly ? '友军' : '敌军';
    log(`炮弹命中${tag}${shipName(hit.shipIdx)}，造成 1 点伤害（剩余 ${ships[hit.shipIdx].hp} HP）`);
    if (ships[hit.shipIdx].skillData && ships[hit.shipIdx].skillData.ironArmor && hit.hitsBroadside) {
      ironArmorHits[hit.shipIdx] = (ironArmorHits[hit.shipIdx] || 0) + 1;
    }
  }
  var iaKeys = Object.keys(ironArmorHits);
  for (var iak = 0; iak < iaKeys.length; iak++) {
    var iaIdx = parseInt(iaKeys[iak]);
    var actualDmg = ironArmorHits[iaIdx] - 1; // 铁甲：伤害-1（可减至0）
    if (actualDmg < 0) actualDmg = 0;
    ships[iaIdx].hp += (ironArmorHits[iaIdx] - actualDmg);
    if (ironArmorHits[iaIdx] > actualDmg) addHitEffect(ships[iaIdx].col, ships[iaIdx].row, '🛡️');
    if (actualDmg > 0) {
      log(`${shipName(iaIdx)} 的铁甲减免了 ${ironArmorHits[iaIdx] - actualDmg} 点舷炮伤害（剩余 ${ships[iaIdx].hp} HP）`);
    } else {
      log(`${shipName(iaIdx)} 的铁甲完全抵御了舷炮伤害`);
    }
  }

  // 收集被击沉的船只对象（用对象引用而非索引，避免连锁移除导致索引错位）
  var defeatedSet = {};
  for (const hit of hits) {
    if (ships[hit.shipIdx].hp <= 0) defeatedSet[hit.shipIdx] = ships[hit.shipIdx];
  }
  if (ship.hp <= 0) defeatedSet[selectedShipIndex] = ship;

  let broadsideKills = 0;
  for (const hit of hits) {
    if (!hit.isFriendly && ships[hit.shipIdx] && ships[hit.shipIdx].hp <= 0) {
      broadsideKills++;
    }
  }
  playerKills[ship.playerIndex].broadside += broadsideKills;

  const friendlyHits = hits.filter(function(h) { return h.isFriendly; }).length;
  const enemyHits = hits.filter(function(h) { return !h.isFriendly; }).length;
  const summary = [enemyHits > 0 ? `${enemyHits} 发命中敌军` : '', friendlyHits > 0 ? `${friendlyHits} 发误伤友军` : ''].filter(Boolean).join('，');
  ship.broadsideCount++;
  mpPendingAction = { type: 'broadside' };
  afterShipAction(ship, `${shipName(selectedShipIndex)} 舷炮齐射（${summary || '未命中任何目标'}）`, 1);

  var deadShips = Object.keys(defeatedSet).map(function(k) { return defeatedSet[k]; });
  for (var di = 0; di < deadShips.length; di++) {
    var curIdx = ships.indexOf(deadShips[di]);
    if (curIdx >= 0) {
      logSink(curIdx, selectedShipIndex, '舷炮击沉');
      removeShip(curIdx);
    }
  }
  checkVictory();
  return true;
}

// ── 船头撞击（冲锋机制：敌方在第2格时触发，消耗1行动力前进1格后撞击） ──
function initiateRamming() {
  if (gameOver) return false;
  if (selectedShipIndex < 0) return false;
  const ship = ships[selectedShipIndex];
  if (ship.playerIndex !== currentPlayerIndex) return false;
  if (ship.boardingTargets.length > 0) { log('无法撞击：正处于接舷战中'); return false; }
  if (ship.actionsRemaining < 1) { log('行动力不足，无法撞击'); return false; }
  if (ship.submerged) { log('无法撞击：正处于下潜状态'); return false; }

  const target = findRammingTarget(selectedShipIndex);
  if (!target) { log('无法撞击：船头前方第2格没有敌方舰船'); return false; }

  const enemy = ships[target.enemyIdx];
  const dv = DIR_VECTORS[ship.direction];

  // 冲锋前进1格
  ship.col += dv.dx;
  ship.row += dv.dy;
  ship.stepsMoved++;
  ship.chargeSteps++;

  // 冲锋路径上撞到鲨鱼/水雷
  var destroyedByShark = checkSharkCollision(getShipCells(ship), ship);
  if (destroyedByShark) return true;
  if (checkMineCollision(getShipCells(ship), ship)) return true;

  // 接触判定（冲锋后船头紧贴敌方）
  var eDv = DIR_VECTORS[enemy.direction];
  var ndx = -dv.dx;
  var ndy = -dv.dy;
  var dot = ndx * eDv.dx + ndy * eDv.dy;
  var contactType = dot === 0 ? 'side' : 'bowstern';

  const dmg = ship.chargeSteps; // 最近转向后的直线冲锋速度
  let atkDmg, defDmg;
  if (contactType === 'side') {
    atkDmg = 1;
    defDmg = dmg;
    log(`冲锋撞击敌方船舷！自身受到 ${atkDmg} 点反冲伤害，敌方受到 ${defDmg} 点伤害`);
  } else {
    atkDmg = Math.min(dmg, ship.length);
    defDmg = Math.min(dmg, ship.length);
    log(`冲锋船头对撞！双方各受到 ${atkDmg} 点伤害${dmg > ship.length ? '（已达撞击船体积上限）' : ''}`);
  }

  // 铁甲：仅船舷受撞击时伤害-1（可减至0）
  // 龟船：任何撞击伤害-1（可减至0）
  if (contactType === 'side' && enemy.skillData && enemy.skillData.ironArmor) {
    if (defDmg > 0) { defDmg--; addHitEffect(enemy.col, enemy.row, '🛡️'); }
  }
  if (enemy.skillData && enemy.skillData.turtleShip) {
    if (defDmg > 0) { defDmg--; addHitEffect(enemy.col, enemy.row, '🛡️'); }
  }
  if (ship.skillData && ship.skillData.turtleShip) {
    if (atkDmg > 0) { atkDmg--; addHitEffect(ship.col, ship.row, '🛡️'); }
  }
  ship.hp -= atkDmg;
  enemy.hp -= defDmg;

  const knockback = Math.max(1, Math.floor(ship.length * dmg / enemy.length));
  const pushed = pushShip(enemy, target.enemyIdx, dv.dx, dv.dy, knockback);
  if (pushed > 0) {
    log(`${shipName(target.enemyIdx)} 被击退 ${pushed} 格`);
    clearBrokenBoarding();
  } else {
    log(`敌方舰船被地形或舰船阻挡，无法击退`);
  }

  var defeatedObjs = [];
  if (ship.hp <= 0) defeatedObjs.push(ship);
  if (enemy.hp <= 0 && defeatedObjs.indexOf(enemy) < 0) {
    defeatedObjs.push(enemy);
    playerKills[ship.playerIndex].ram++;
  }
  mpPendingAction = { type: 'ram' };
  afterShipAction(ship, `${shipName(selectedShipIndex)} 发起船头冲锋撞击`, ship.actionsRemaining);

  for (var di = 0; di < defeatedObjs.length; di++) {
    var curIdx = ships.indexOf(defeatedObjs[di]);
    if (curIdx >= 0) {
      logSink(curIdx, selectedShipIndex, '船头撞沉');
      removeShip(curIdx);
    }
  }

  checkVictory();
  return true;
}

// ── 接舷战 ──
function initiateBoarding() {
  if (gameOver) return false;
  if (selectedShipIndex < 0) return false;
  const ship = ships[selectedShipIndex];
  if (ship.playerIndex !== currentPlayerIndex) return false;
  if (ship.submerged) { log('无法接舷：正处于下潜状态'); return false; }
  if (ship.boardingTargets.length > 0) { log('该舰船已在进行接舷战'); return false; }
  if (ship.actionsRemaining <= 0) { log('行动力不足，无法发起接舷战'); return false; }

  const enemyIdx = findAdjacentEnemy(selectedShipIndex);
  if (enemyIdx < 0) { log('无法接舷：没有相邻的敌方舰船'); return false; }

  const enemy = ships[enemyIdx];

  const cost = ship.actionsRemaining;
  ship.boardingTargets.push(enemyIdx);
  var isFirstBoarder = enemy.boardingTargets.length === 0;
  enemy.boardingTargets.push(selectedShipIndex);
  // 被首次接舷的名船激活英勇护盾
  if (isFirstBoarder && enemy.skillData && enemy.skillData.brave) {
    enemy.braveActive = true;
  }
  log(isFirstBoarder
    ? `${shipName(selectedShipIndex)} 与 ${shipName(enemyIdx)} 展开接舷战！`
    : `${shipName(selectedShipIndex)} 加入对 ${shipName(enemyIdx)} 的接舷战！`);
  // 主动发起接舷的名船激活英勇护盾
  if (ship.skillData && ship.skillData.brave) {
    ship.braveActive = true;
  }

  mpPendingAction = { type: 'board' };
  afterShipAction(ship, `${shipName(selectedShipIndex)} 发起接舷战`, cost);
  return true;
}

// ── 下潜（飞翔荷兰人号） ──
function submergeShip() {
  if (gameOver) return false;
  if (selectedShipIndex < 0) return false;
  var ship = ships[selectedShipIndex];
  if (ship.playerIndex !== currentPlayerIndex) return false;
  if (!ship.skillData || !ship.skillData.canSubmerge) { log('该舰船没有下潜技能'); return false; }
  if (ship.submergeUsed) { log('下潜技能本局已使用过'); return false; }
  if (ship.submerged) { log('已经处于下潜状态'); return false; }
  if (ship.boardingTargets.length > 0) { log('无法下潜：正处于接舷战中'); return false; }
  if (ship.actionsRemaining < 1) { log('行动力不足，无法下潜'); return false; }

  ship.submerged = true;
  ship.submergedTurns = 3;
  ship.submergeUsed = true;
  mpPendingAction = { type: 'skill', skill: 'submerge' };
  afterShipAction(ship, `飞翔荷兰人号下潜进入水下状态（最多持续3回合）`, 1);
  return true;
}

// ── 上浮（飞翔荷兰人号） ──
function surfaceShip() {
  if (gameOver) return false;
  if (selectedShipIndex < 0) return false;
  var ship = ships[selectedShipIndex];
  if (ship.playerIndex !== currentPlayerIndex) return false;
  if (!ship.submerged) { log('当前未处于下潜状态'); return false; }
  if (ship.actionsRemaining < 1) { log('行动力不足，无法上浮'); return false; }

  ship.submerged = false;
  ship.submergedTurns = 0;
  var shipIdx = selectedShipIndex;
  var cells = getShipCells(ship);

  // 检查碰撞
  var blockedShips = [];
  for (var ci = 0; ci < cells.length; ci++) {
    for (var j = 0; j < ships.length; j++) {
      if (j === shipIdx) continue;
      if (ships[j].submerged) continue;
      var eCells = getShipCells(ships[j]);
      if (eCells.some(function(ec) { return ec.col === cells[ci].col && ec.row === cells[ci].row; })) {
        if (blockedShips.indexOf(j) < 0) blockedShips.push(j);
      }
    }
  }

  if (blockedShips.length > 0) {
    var dmg = ship.hp;
    ship.hp -= dmg;
    log(`飞翔荷兰人号上浮时与其他船只碰撞，自身受到 ${dmg} 点伤害（剩余 ${ship.hp} HP）`);
    for (var bi = 0; bi < blockedShips.length; bi++) {
      var blocker = ships[blockedShips[bi]];
      blocker.hp -= dmg;
      log(`碰撞对 ${shipName(blockedShips[bi])} 造成 ${dmg} 点伤害（剩余 ${blocker.hp} HP）`);
      if (blocker.hp <= 0) {
        logSink(blockedShips[bi], selectedShipIndex, '同归于尽');
      }
    }
    if (ship.hp <= 0) logSink(selectedShipIndex, selectedShipIndex, '同归于尽');

    // 清理被击沉的船（用对象引用避免连锁移除索引错位）
    var deadObjs = [];
    for (var di = 0; di < ships.length; di++) {
      if (ships[di].hp <= 0) deadObjs.push(ships[di]);
    }
    for (var di2 = 0; di2 < deadObjs.length; di2++) {
      var curIdx = ships.indexOf(deadObjs[di2]);
      if (curIdx >= 0) removeShip(curIdx);
    }
    checkVictory();
  } else {
    log(`飞翔荷兰人号安全上浮`);
  }

  // shipIdx may have changed after removeShip — only call if ship still alive
  if (!gameOver && ships.indexOf(ship) >= 0) {
    mpPendingAction = { type: 'skill', skill: 'surface' };
    afterShipAction(ship, `飞翔荷兰人号上浮`, 1);
  }
  return true;
}

// ── 三联炮（飞翔荷兰人号船头炮，机制与舷炮一致） ──
function fireBowCannon() {
  if (gameOver) return false;
  if (selectedShipIndex < 0) return false;
  var ship = ships[selectedShipIndex];
  if (ship.playerIndex !== currentPlayerIndex) return false;
  if (!ship.skillData || !ship.skillData.canBowCannon) { log('该舰船没有三联炮技能'); return false; }
  if (ship.bowCannonUsed) { log('三联炮本局已使用过'); return false; }
  if (ship.submerged) { log('无法开火：正处于下潜状态'); return false; }
  if (ship.boardingTargets.length > 0) { log('无法开火：正处于接舷战中'); return false; }
  if (ship.actionsRemaining < 1) { log('行动力不足，无法开火'); return false; }

  var dv = DIR_VECTORS[ship.direction];
  var bowCol = ship.col + dv.dx * (ship.length - 1);
  var bowRow = ship.row + dv.dy * (ship.length - 1);

  // 自伤：船头前方紧邻有其他棋子时，开炮反冲 1 伤
  var selfDamage = 0;
  var contactCol = bowCol + dv.dx;
  var contactRow = bowRow + dv.dy;
  if (contactCol >= 0 && contactCol < GRID_SIZE && contactRow >= 0 && contactRow < GRID_SIZE) {
    var contactIdx = findShipAt(contactCol, contactRow);
    if (contactIdx >= 0 && contactIdx !== selectedShipIndex) {
      selfDamage = 1;
    }
  }
  if (selfDamage > 0) {
    ship.hp -= selfDamage;
    log(`三联炮贴脸开火！${shipName(selectedShipIndex)} 船头与舰船接触，自身受到 ${selfDamage} 点反冲伤害（剩余 ${ship.hp} HP）`);
  }

  // 沿船头方向搜索，射程3
  for (var r = 1; r <= 3; r++) {
    var tc = bowCol + dv.dx * r;
    var tr = bowRow + dv.dy * r;
    if (tc < 0 || tc >= GRID_SIZE || tr < 0 || tr >= GRID_SIZE) break;
    var hitIdx = findShipAt(tc, tr);
    if (hitIdx >= 0 && hitIdx !== selectedShipIndex) {
      var hitShip = ships[hitIdx];
      // 隐蔽：未与敌方接触时无法被火炮命中
      if (hitShip.skillData && hitShip.skillData.stealth && !isAdjacentToEnemy(hitIdx)) {
        addHitEffect(tc, tr, '🛡️');
        break;
      }
      // 命中（无论敌友均造成伤害）
      hitShip.hp--;
      addHitEffect(tc, tr);
      var tag = hitShip.playerIndex === ship.playerIndex ? '友军' : '敌军';
      log(`三联炮弹命中${tag}${shipName(hitIdx)}，造成 1 点伤害（剩余 ${hitShip.hp} HP）`);
      break;
    }
  }

  // 先报告行动
  var shipStillAlive = ships.indexOf(ship) >= 0;
  if (!gameOver && shipStillAlive) {
    ship.bowCannonUsed = true;
    mpPendingAction = { type: 'skill', skill: 'bowCannon' };
    afterShipAction(ship, `飞翔荷兰人号三联炮发射`, 1);
  }

  // 再处理击沉（行动播报在前）
  if (hitIdx >= 0 && hitShip && hitShip.hp <= 0) {
    logSink(hitIdx, selectedShipIndex, '三联炮击沉');
    playerKills[ship.playerIndex].broadside++;
    removeShip(hitIdx);
    checkVictory();
  }
  if (selfDamage > 0 && ship.hp <= 0 && ships.indexOf(ship) >= 0) {
    logSink(selectedShipIndex, selectedShipIndex, '三联炮反冲');
    playerKills[ship.playerIndex === 0 ? 1 : 0].broadside++;
    removeShip(selectedShipIndex);
    checkVictory();
  }
  return true;
}

// ── 希腊火（安妮女王复仇号） ──
function fireGreekFire() {
  if (gameOver) return false;
  if (selectedShipIndex < 0) return false;
  var ship = ships[selectedShipIndex];
  if (ship.playerIndex !== currentPlayerIndex) return false;
  if (!ship.skillData || !ship.skillData.canGreekFire) { log('该舰船没有希腊火技能'); return false; }
  if (ship.greekFireUsed) { log('希腊火本局已使用过'); return false; }
  if (ship.submerged) { log('无法开火：正处于下潜状态'); return false; }
  if (ship.boardingTargets.length > 0) { log('无法开火：正处于接舷战中'); return false; }
  if (ship.actionsRemaining < 1) { log('行动力不足，无法开火'); return false; }

  var dv = DIR_VECTORS[ship.direction];
  var bowCol = ship.col + dv.dx * (ship.length - 1);
  var bowRow = ship.row + dv.dy * (ship.length - 1);

  // 沿船头方向搜索，射程2，命中第一个敌方舰船
  for (var r = 1; r <= 2; r++) {
    var tc = bowCol + dv.dx * r;
    var tr = bowRow + dv.dy * r;
    if (tc < 0 || tc >= GRID_SIZE || tr < 0 || tr >= GRID_SIZE) break;
    var hitIdx = findShipAt(tc, tr);
    if (hitIdx >= 0 && hitIdx !== selectedShipIndex && ships[hitIdx].playerIndex !== ship.playerIndex) {
      ships[hitIdx].hp--;
      addHitEffect(tc, tr, '🔥');
      log(`希腊火焰命中敌方${shipName(hitIdx)}，造成 1 点伤害（剩余 ${ships[hitIdx].hp} HP）`);
      break;
    }
    if (hitIdx >= 0) {
      log(`希腊火焰被友军${shipName(hitIdx)} 阻挡`);
      break;
    }
  }

  ship.greekFireUsed = true;
  mpPendingAction = { type: 'skill', skill: 'greekFire' };
  afterShipAction(ship, `安妮女王复仇号喷射希腊火`, 1);

  // 行动播报后再处理击沉
  if (hitIdx >= 0 && ships[hitIdx] && ships[hitIdx].hp <= 0) {
    logSink(hitIdx, selectedShipIndex, '希腊火击沉');
    playerKills[ship.playerIndex].broadside++;
    removeShip(hitIdx);
    checkVictory();
  }
  return true;
}

// ── 船首吞噬（沉默玛丽号） ──
function areDevourBowContact(shipIdx, targetIdx) {
  var ship = ships[shipIdx];
  var target = ships[targetIdx];
  if (!ship || !target) return false;
  var dv = DIR_VECTORS[ship.direction];
  var bowCol = ship.col + dv.dx * (ship.length - 1);
  var bowRow = ship.row + dv.dy * (ship.length - 1);
  var tc = bowCol + dv.dx;
  var tr = bowRow + dv.dy;
  var eCells = getShipCells(target);
  var eDv = DIR_VECTORS[target.direction];
  for (var ei = 0; ei < eCells.length; ei++) {
    if (eCells[ei].col === tc && eCells[ei].row === tr) {
      return true; // 接触敌方任意部位即可
    }
  }
  return false;
}

function devourShip() {
  if (gameOver) return false;
  if (selectedShipIndex < 0) return false;
  var ship = ships[selectedShipIndex];
  if (ship.playerIndex !== currentPlayerIndex) return false;
  if (!ship.skillData || !ship.skillData.canDevour) { log('该舰船没有吞噬技能'); return false; }
  if (ship.boardingTargets.length > 0) { log('无法吞噬：正处于接舷战中'); return false; }
  if (ship.actionsRemaining < 1) { log('行动力不足，无法吞噬'); return false; }

  var target = findBowContact(selectedShipIndex);
  if (!target) { log('无法吞噬：船头未接触敌方舰船'); return false; }
  var enemy = ships[target.enemyIdx];

  // 吞噬进度
  ship.devourTarget = target.enemyIdx;
  ship.devourProgress++;
  var cost = ship.actionsRemaining; // 消耗全部剩余行动力
  mpPendingAction = { type: 'skill', skill: 'devour' };
  afterShipAction(ship, `沉默玛丽号吞噬敌方 #${target.enemyIdx + 1}！进度 ${ship.devourProgress}/${enemy.length}`, cost);

  // 目标可能在 afterShipAction 的连锁反应中被移除
  if (ship.devourTarget >= 0 && ship.devourProgress >= enemy.length) {
    var sinkIdx = ships.indexOf(enemy);
    if (sinkIdx >= 0) {
      logSink(sinkIdx, selectedShipIndex, '吞噬');
      addHitEffect(enemy.col, enemy.row, '💀');
      playerKills[ship.playerIndex].ram++;
      removeShip(sinkIdx);
      ship.devourTarget = -1;
      ship.devourProgress = 0;
      checkVictory();
    }
  }

  return true;
}

/** 检查所有吞噬关系是否仍保持接触，脱离则清零 */
function checkDevourContacts() {
  for (var i = 0; i < ships.length; i++) {
    var s = ships[i];
    if (s.devourTarget >= 0) {
      if (!areDevourBowContact(i, s.devourTarget)) {
        log(`吞噬被打断！沉默玛丽号与目标脱离接触，进度归零`);
        s.devourTarget = -1;
        s.devourProgress = 0;
      }
    }
  }
}

// ── 补给 / 弹药支援（乌尔卡号） ──
function findAdjacentFriendly(shipIndex) {
  var ship = ships[shipIndex];
  if (!ship) return -1;
  var sc = getShipCells(ship);
  var aDv = DIR_VECTORS[ship.direction];
  for (var j = 0; j < ships.length; j++) {
    if (j === shipIndex) continue;
    if (ships[j].playerIndex !== ship.playerIndex) continue;
    var ec = getShipCells(ships[j]);
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

function supplyShip() {
  if (gameOver) return false;
  if (selectedShipIndex < 0) return false;
  var ship = ships[selectedShipIndex];
  if (ship.playerIndex !== currentPlayerIndex) return false;
  if (!ship.skillData || !ship.skillData.canSupply) { log('该舰船没有补给技能'); return false; }
  if (ship.actionsRemaining < 1) { log('行动力不足'); return false; }
  if (ship.supplyUsed >= 3) { log('补给次数已用完'); return false; }

  var targetIdx = findAdjacentFriendly(selectedShipIndex);
  if (targetIdx < 0) { log('没有船舷相接触的友军舰船'); return false; }

  var target = ships[targetIdx];
  if (target.hp >= target.maxHp) { log('友军舰船生命值已满'); return false; }

  target.hp++;
  ship.supplyUsed++;
  addHitEffect(target.col, target.row, '❤️‍🩹');
  afterShipAction(ship, `乌尔卡号为 ${shipName(targetIdx)} 回复1点生命（剩余 ${target.hp} HP）`, 1);
  return true;
}

function ammoSupport() {
  if (gameOver) return false;
  if (selectedShipIndex < 0) return false;
  var ship = ships[selectedShipIndex];
  if (ship.playerIndex !== currentPlayerIndex) return false;
  if (!ship.skillData || !ship.skillData.canSupply) { log('该舰船没有弹药支援技能'); return false; }
  if (ship.actionsRemaining < 1) { log('行动力不足'); return false; }
  if (ship.broadsideCount >= ship.maxBroadsideCount) { log('自身舷炮已耗尽，无法支援'); return false; }

  var targetIdx = findAdjacentFriendly(selectedShipIndex);
  if (targetIdx < 0) { log('没有船舷相接触的友军舰船'); return false; }

  var target = ships[targetIdx];
  if (target.broadsideCount === 0) { log('友军舰船未使用舷炮，无需支援'); return false; }

  target.broadsideCount--;
  ship.broadsideCount = ship.maxBroadsideCount;
  addHitEffect(target.col, target.row, '🔧');
  afterShipAction(ship, `乌尔卡号为 ${shipName(targetIdx)} 补充了一次舷炮`, 1);
  return true;
}

// ── 布雷（屠夫号） ──
function enterMinePlacement() {
  if (gameOver) return false;
  if (selectedShipIndex < 0) return false;
  var ship = ships[selectedShipIndex];
  if (ship.playerIndex !== currentPlayerIndex) return false;
  if (!ship.skillData || !ship.skillData.canLayMines) { log('该舰船没有布雷技能'); return false; }
  if (ship.boardingTargets.length > 0) { log('无法布雷：正处于接舷战中'); return false; }
  if (ship.actionsRemaining < 1) { log('行动力不足，无法布雷'); return false; }
  if (ship.minesPlaced >= 3) { log('水雷已用完（本局3次）'); return false; }

  minePlacementMode = true;
  minePlacementShip = ship;
  log('请点击棋盘空格布设水雷（船体周围一圈10格）');
  return true;
}

function placeMineAt(col, row) {
  if (!minePlacementMode || !minePlacementShip) return false;
  var ship = minePlacementShip;

  // 检查范围：仅限船体周围一圈（3×4矩形，不含船体自身2格）
  var cells = getShipCells(ship);
  var inRange = false;
  for (var ci = 0; ci < cells.length; ci++) {
    var dc = Math.abs(cells[ci].col - col);
    var dr = Math.abs(cells[ci].row - row);
    if (dc <= 1 && dr <= 1 && !(dc === 0 && dr === 0)) { inRange = true; break; }
  }
  if (!inRange) { log('水雷只能布设在船体周围一圈的10格内'); return false; }

  // 检查是否被占据
  if (findShipAt(col, row) >= 0 || isCellOccupied(col, row, -1)) {
    log('该格已被占据，无法布雷');
    return false;
  }
  // 检查是否已有水雷
  for (var mi = 0; mi < mines.length; mi++) {
    if (mines[mi].col === col && mines[mi].row === row) {
      log('该格已有水雷');
      return false;
    }
  }

  mines.push({ col: col, row: row });
  ship.minesPlaced++;
  minePlacementMode = false;
  minePlacementShip = null;

  afterShipAction(ship, `屠夫号在 ${String.fromCharCode(65 + col)}${row + 1} 布设水雷`, 1);
  return true;
}

// ── 僵尸鲨鱼（沉默玛丽号） ──
function releaseSharks() {
  if (gameOver) return false;
  if (selectedShipIndex < 0) return false;
  var ship = ships[selectedShipIndex];
  if (ship.playerIndex !== currentPlayerIndex) return false;
  if (!ship.skillData || !ship.skillData.canReleaseSharks) { log('该舰船没有鲨鱼技能'); return false; }
  if (ship.sharksUsed) { log('僵尸鲨鱼已使用过'); return false; }
  if (ship.actionsRemaining < 1) { log('行动力不足，无法释放鲨鱼'); return false; }

  var dv = DIR_VECTORS[ship.direction];
  // 船中格（索引 1）
  var midCol = ship.col + dv.dx;
  var midRow = ship.row + dv.dy;
  // 两侧方向
  var sideDirs = [
    { dx: -dv.dy, dy: dv.dx },
    { dx: dv.dy, dy: -dv.dx }
  ];

  for (var si = 0; si < sideDirs.length; si++) {
    var sd = sideDirs[si];
    var sharkCol = midCol + sd.dx;
    var sharkRow = midRow + sd.dy;
    if (sharkCol >= 0 && sharkCol < GRID_SIZE && sharkRow >= 0 && sharkRow < GRID_SIZE) {
      sharks.push({ col: sharkCol, row: sharkRow, dx: sd.dx, dy: sd.dy, justSpawned: true });
    }
  }

  ship.sharksUsed = true;
  mpPendingAction = { type: 'skill', skill: 'sharks' };
  afterShipAction(ship, `沉默玛丽号释放 ${sharks.length > 0 ? sharks.length : 0} 只僵尸鲨鱼！`, 1);
  return true;
}
