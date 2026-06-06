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
        if (isCellInFleet(cx, cy) || isCellAdjacentToFleet(cx, cy, playerIndex) || isTerrainBlocking(cx, cy)) { valid = false; break; }
        // 避免部署在会导致搁浅的浅滩上
        var tCheck = getTerrainAt(cx, cy);
        if (tCheck && ((tCheck.type === TERRAIN.SHOAL && def.length >= 2) || (tCheck.type === TERRAIN.MEDIUM_SHOAL && def.length >= 3))) { valid = false; break; }
        cells.push({ col: cx, row: cy });
      }
      if (valid) {
        ships.push(createShip({
          col: col, row: row, length: def.length, direction: dir, playerIndex: playerIndex,
          name: def.name, skill: def.skill, skillData: def.skillData,
          flagColor: def.flagColor, flagShape: def.flagShape,
          flagIcon: def.flagIcon, flagPattern: def.flagPattern
        }));
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
    // 经典模式：红方 A-E(0-4)、蓝方 P-T(15-19)
    placeFleet(redFleet, 0, 0, 4, [DIR.N, DIR.E, DIR.S]);
    placeFleet(blueFleet, 1, 15, 19, [DIR.N, DIR.W, DIR.S]);
    log('舰队就位。红方 ' + redFleet.length + ' 艘，蓝方 ' + blueFleet.length + ' 艘。');
  }

  selectedShipIndex = -1;
  currentPlayerIndex = 0;
  currentTurn = 1;
  recordInitialFleetStats();
  updateGroundedShips();
  updatePlayerDisplay();
  updateInfoPanel();
  updateActionButtons();
  render();
}
