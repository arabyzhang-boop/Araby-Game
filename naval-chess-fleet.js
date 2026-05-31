// ═══════════════════════════════════════
//  Naval Chess — 布阵系统
//  加载顺序：第7个（依赖 config, utils, ui, render）
// ═══════════════════════════════════════

// ── 随机布阵 ──
function isCellInFleet(col, row) {
  return ships.some(function(ship) {
    return getShipCells(ship).some(function(c) { return c.col === col && c.row === row; });
  });
}

/** 检查格子是否与已有舰队相邻（正交），可选限定玩家 */
function isCellAdjacentToFleet(col, row, playerIdx) {
  return ships.some(function(ship) {
    if (playerIdx != null && ship.playerIndex !== playerIdx) return false;
    return getShipCells(ship).some(function(c) {
      return Math.abs(c.col - col) + Math.abs(c.row - row) === 1;
    });
  });
}

/** 在指定列/行范围和朝向约束内随机放置一支舰队 */
function placeFleet(fleetDefs, playerIndex, colMin, colMax, allowedDirs, rowMinOverride, rowMaxOverride) {
  for (const def of fleetDefs) {
    const isSmall = def.length === 1;
    const rowMin = rowMinOverride != null ? rowMinOverride : (isSmall ? 0 : 5);
    const rowMax = rowMaxOverride != null ? rowMaxOverride : (isSmall ? 19 : 14);
    let placed = false;

    for (let attempt = 0; attempt < 300; attempt++) {
      const dir = allowedDirs[Math.floor(Math.random() * allowedDirs.length)];
      const dv = DIR_VECTORS[dir];
      const col = colMin + Math.floor(Math.random() * (colMax - colMin + 1));
      const row = rowMin + Math.floor(Math.random() * (rowMax - rowMin + 1));

      let valid = true;
      const cells = [];
      for (let i = 0; i < def.length; i++) {
        const cx = col + dv.dx * i;
        const cy = row + dv.dy * i;
        if (cx < 0 || cx >= GRID_SIZE || cy < 0 || cy >= GRID_SIZE) { valid = false; break; }
        if (isCellInFleet(cx, cy) || isCellAdjacentToFleet(cx, cy, playerIndex)) { valid = false; break; }
        cells.push({ col: cx, row: cy });
      }
      if (valid) {
        var shipObj = {
          col: col, row: row, length: def.length, direction: dir, playerIndex: playerIndex,
          hp: def.length, maxHp: def.length,
          actionsRemaining: 3, maxActions: 3,
          boardingTargets: [], stepsMoved: 0, chargeSteps: 0,
          broadsideCount: 0, maxBroadsideCount: 1,
          name: def.name || null, skill: def.skill || null,
          skillData: def.skillData || null,
          flagColor: def.flagColor || null, flagShape: def.flagShape || null,
          flagIcon: def.flagIcon || null, flagPattern: def.flagPattern || null,
          braveActive: false,
          submerged: false, submergedTurns: 0, submergeUsed: false,
          bowCannonUsed: false, greekFireUsed: false,
          devourTarget: -1, devourProgress: 0,
          sharksUsed: false
        };
        // 应用名船技能效果
        if (def.skillData) {
          var sd = def.skillData;
          if (sd.sturdy) {
            shipObj.maxHp = def.length + 1;
            shipObj.hp = shipObj.maxHp;
          }
          if (sd.speedy) {
            shipObj.maxActions = 4;
            shipObj.actionsRemaining = 4;
          }
          if (sd.extraBroadside) {
            shipObj.maxBroadsideCount = 2;
          }
          // brave 由接舷战时动态激活，此处不做初始设置
        }
        ships.push(shipObj);
        placed = true;
        break;
      }
    }
    if (!placed) {
      log(`警告：玩家${playerIndex + 1} 的长度${def.length}舰船未能找到合法位置`);
    }
  }
}

function initTestShips(redPicks, bluePicks) {
  ships = [];

  var redFleet = (redPicks && redPicks.length > 0) ? redPicks : getDefaultFleet();
  var blueFleet = (bluePicks && bluePicks.length > 0) ? bluePicks : getDefaultFleet();

  if (gameSpeed === 'speed') {
    // 极速模式：红方 F-K 列(5-10)、蓝方 J-O 列(9-14)，行范围 6-15
    placeFleet(redFleet, 0, 5, 10, [DIR.N, DIR.E, DIR.S], 6, 15);
    placeFleet(blueFleet, 1, 9, 14, [DIR.N, DIR.W, DIR.S], 6, 15);
    log('极速模式：舰队部署在中央战区。');
  } else {
    // 经典模式：红方 A-D(0-3)、蓝方 Q-T(16-19)
    placeFleet(redFleet, 0, 0, 3, [DIR.N, DIR.E, DIR.S]);
    placeFleet(blueFleet, 1, 16, 19, [DIR.N, DIR.W, DIR.S]);
    log('舰队就位。红方 ' + redFleet.length + ' 艘，蓝方 ' + blueFleet.length + ' 艘。');
  }

  selectedShipIndex = -1;
  currentPlayerIndex = 0;
  currentTurn = 1;
  updatePlayerDisplay();
  updateInfoPanel();
  updateActionButtons();
  render();
}
