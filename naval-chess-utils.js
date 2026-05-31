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

/** 检查某个格子是否被其他舰船占据（排除 excludeIndex） */
function isCellOccupied(col, row, excludeIndex) {
  return ships.some(function(ship, idx) {
    if (idx === excludeIndex) return false;
    if (ship.submerged) return false;
    return getShipCells(ship).some(function(c) { return c.col === col && c.row === row; });
  });
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
