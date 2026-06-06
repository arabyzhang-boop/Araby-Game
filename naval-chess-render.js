// ═══════════════════════════════════════
//  Naval Chess — Canvas 渲染
//  加载顺序：第3个（依赖 config.js, utils.js）
// ═══════════════════════════════════════

// ── 绘制 ──
function drawGrid() {
  // 底色
  ctx.fillStyle = '#d9c8a8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 网格线
  ctx.strokeStyle = 'rgba(60, 40, 20, 0.25)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= GRID_SIZE; i++) {
    const pos = i * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(canvas.width, pos);
    ctx.stroke();
  }

  // 加粗每5格的主线
  ctx.strokeStyle = 'rgba(60, 40, 20, 0.5)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i <= GRID_SIZE; i += 5) {
    const pos = i * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(canvas.width, pos);
    ctx.stroke();
  }
}

function drawShip(ship) {
  const { col, row, length, direction, playerIndex, hp, maxHp } = ship;
  const pColors = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad'];
  const color   = pColors[playerIndex] || '#666';
  const dv = DIR_VECTORS[direction];
  const hpRatio = hp / maxHp;

  ctx.save();
  // 下潜状态：半透明，保留原阵营色
  if (ship.submerged) {
    ctx.globalAlpha = 0.45;
  }
  for (let i = 0; i < length; i++) {
    const cx = col + dv.dx * i;
    const cy = row + dv.dy * i;
    const px = cx * CELL_SIZE;
    const py = cy * CELL_SIZE;
    const pad = 2;
    const isBow = (i === length - 1);

    // 船体
    ctx.fillStyle = color;
    ctx.fillRect(px + pad, py + pad, CELL_SIZE - pad * 2, CELL_SIZE - pad * 2);

    // 边框（接舷战中显示橙红色加粗框）
    if (ship.boardingTargets.length > 0) {
      ctx.strokeStyle = '#e67e22';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#e67e22';
      ctx.shadowBlur = 6;
    } else {
      ctx.strokeStyle = '#1a1008';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    ctx.strokeRect(px + pad, py + pad, CELL_SIZE - pad * 2, CELL_SIZE - pad * 2);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 血条（船尾格显示）
    if (i === 0) {
      const barH = 4;
      const barY = py + pad + 2;
      const barW = CELL_SIZE - pad * 2 - 4;
      ctx.fillStyle = '#333';
      ctx.fillRect(px + pad + 2, barY, barW, barH);
      const hpColor = hpRatio > 0.5 ? '#27ae60' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
      ctx.fillStyle = hpColor;
      ctx.fillRect(px + pad + 2, barY, barW * hpRatio, barH);
    }

    // 舷炮剩余次数标记（船尾格右下角金色小圆点，每点=1次）
    var remainingShots = ship.maxBroadsideCount - ship.broadsideCount;
    if (i === 0 && remainingShots > 0) {
      var dotR = remainingShots > 1 ? 2.2 : 3;
      var baseX = px + CELL_SIZE - pad - 4;
      var baseY = py + CELL_SIZE - pad - 4;
      for (var di = 0; di < remainingShots; di++) {
        var dotX = baseX - di * 6;
        var dotY = baseY;
        ctx.fillStyle = '#e6c96a';
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#8b6914';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // 船头三角形（i = length-1 为船头）
    if (isBow) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      const cxPx = px + CELL_SIZE / 2;
      const cyPx = py + CELL_SIZE / 2;
      const arrowSize = 5;
      if (direction === DIR.N) {
        ctx.moveTo(cxPx, cyPx - arrowSize);
        ctx.lineTo(cxPx - arrowSize, cyPx + arrowSize);
        ctx.lineTo(cxPx + arrowSize, cyPx + arrowSize);
      } else if (direction === DIR.S) {
        ctx.moveTo(cxPx, cyPx + arrowSize);
        ctx.lineTo(cxPx - arrowSize, cyPx - arrowSize);
        ctx.lineTo(cxPx + arrowSize, cyPx - arrowSize);
      } else if (direction === DIR.E) {
        ctx.moveTo(cxPx + arrowSize, cyPx);
        ctx.lineTo(cxPx - arrowSize, cyPx - arrowSize);
        ctx.lineTo(cxPx - arrowSize, cyPx + arrowSize);
      } else {
        ctx.moveTo(cxPx - arrowSize, cyPx);
        ctx.lineTo(cxPx + arrowSize, cyPx - arrowSize);
        ctx.lineTo(cxPx + arrowSize, cyPx + arrowSize);
      }
      ctx.fill();

      // 名船旗帜（黑杆从船头格侧边伸出，旗帜挂在杆上飘向船尾）
      if (ship.flagColor) {
        var poleLen = 12, fWidth = 7, fHang = 12; // 杆长、旗宽(沿杆)、旗长(垂向船尾)
        var sX, sY, outX, outY, sternDX, sternDY; // 杆根坐标、外侧、船尾方向

        if (direction === DIR.N) {
          sX = px;       sY = py + 5;           // 左侧边近船头端
          outX = -1; outY = 0;                  // 向左外侧
          sternDX = 0; sternDY = 1;             // 船尾=下
        } else if (direction === DIR.S) {
          sX = px + CELL_SIZE; sY = py + CELL_SIZE - 5; // 右侧边近船头端
          outX = 1; outY = 0;                   // 向右外侧
          sternDX = 0; sternDY = -1;            // 船尾=上
        } else if (direction === DIR.E) {
          sX = px + CELL_SIZE - 5; sY = py;     // 上侧边近船头端
          outX = 0; outY = -1;                  // 向上外侧
          sternDX = -1; sternDY = 0;            // 船尾=左
        } else {
          sX = px + 5;  sY = py + CELL_SIZE;    // 下侧边近船头端
          outX = 0; outY = 1;                   // 向下外侧
          sternDX = 1; sternDY = 0;             // 船尾=右
        }

        // 杆的两端：根部在格子侧边，尖端向外伸出
        var tipX = sX + outX * poleLen, tipY = sY + outY * poleLen;
        var inX = tipX - outX * fWidth, inY = tipY - outY * fWidth; // 旗帜内侧边

        // 旗杆（黑线）
        ctx.strokeStyle = '#1a1008';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sX, sY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // 旗帜四角参考
        var aX = tipX, aY = tipY;                              // 外-船头角
        var bX = inX, bY = inY;                                // 内-船头角
        var cX = inX + sternDX * fHang, cY = inY + sternDY * fHang;  // 内-船尾角
        var dX = tipX + sternDX * fHang, dY = tipY + sternDY * fHang; // 外-船尾角
        var midSternX = (cX + dX) / 2, midSternY = (cY + dY) / 2;

        ctx.fillStyle = ship.flagColor;
        ctx.beginPath();

        if (ship.flagShape === 'banner') {
          // 矩形旗：杆=顶边，下垂
          ctx.moveTo(aX, aY); ctx.lineTo(bX, bY);
          ctx.lineTo(cX, cY); ctx.lineTo(dX, dY);

        } else if (ship.flagShape === 'swallowtail') {
          // 燕尾旗：矩形但船尾端切V形缺口
          ctx.moveTo(aX, aY); ctx.lineTo(bX, bY);
          ctx.lineTo(cX, cY);
          // V缺：船尾边中点退回1/3，两侧向中点缩
          var vx = midSternX + outX * fHang / 3;
          var vy = midSternY + outY * fHang / 3;
          ctx.lineTo(vx + sternDX * 2, vy + sternDY * 2);
          ctx.lineTo(vx, vy);
          ctx.lineTo(vx - sternDX * 2, vy - sternDY * 2);
          ctx.lineTo(dX, dY);

        } else {
          // 三角旗：底边=杆，尖指向船尾外侧
          ctx.moveTo(aX, aY); ctx.lineTo(bX, bY);
          ctx.lineTo(midSternX + outX * 4, midSternY + outY * 4);
        }

        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // 极简辨识图案
        if (ship.flagIcon) {
          var pcx = (aX + cX) / 2, pcy = (aY + cY) / 2; // 旗帜中心
          var ps = 2.3;

          ctx.fillStyle = ship.flagPattern || '#1a1008';
          ctx.strokeStyle = ship.flagPattern || '#1a1008';
          ctx.lineWidth = 0.9;

          if (ship.flagIcon === 'cross') {
            ctx.beginPath();
            ctx.moveTo(pcx - ps, pcy); ctx.lineTo(pcx + ps, pcy);
            ctx.moveTo(pcx, pcy - ps); ctx.lineTo(pcx, pcy + ps);
            ctx.stroke();
          } else if (ship.flagIcon === 'dot') {
            ctx.beginPath();
            ctx.arc(pcx, pcy, ps, 0, Math.PI * 2); ctx.fill();
          } else if (ship.flagIcon === 'wave') {
            ctx.beginPath();
            ctx.moveTo(pcx - ps, pcy - 1.5); ctx.quadraticCurveTo(pcx, pcy - 4, pcx + ps, pcy - 1.5);
            ctx.moveTo(pcx - ps, pcy + 1.5); ctx.quadraticCurveTo(pcx, pcy - 1, pcx + ps, pcy + 1.5);
            ctx.stroke();
          } else if (ship.flagIcon === 'chevron') {
            ctx.beginPath();
            ctx.moveTo(pcx - ps, pcy - ps); ctx.lineTo(pcx, pcy + 1); ctx.lineTo(pcx + ps, pcy - ps);
            ctx.stroke();
          } else if (ship.flagIcon === 'diamond') {
            ctx.beginPath();
            ctx.moveTo(pcx, pcy - ps); ctx.lineTo(pcx + ps, pcy);
            ctx.lineTo(pcx, pcy + ps); ctx.lineTo(pcx - ps, pcy);
            ctx.fill();
          } else if (ship.flagIcon === 'slash') {
            ctx.beginPath();
            ctx.moveTo(pcx - ps, pcy + ps); ctx.lineTo(pcx + ps, pcy - ps);
            ctx.stroke();
          } else if (ship.flagIcon === 'eyes') {
            ctx.beginPath();
            ctx.arc(pcx - 2, pcy, 1.1, 0, Math.PI * 2); ctx.fill();
            ctx.arc(pcx + 2, pcy, 1.1, 0, Math.PI * 2); ctx.fill();
          } else if (ship.flagIcon === 'bang') {
            ctx.beginPath();
            ctx.moveTo(pcx, pcy - ps); ctx.lineTo(pcx, pcy + 0.5);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(pcx, pcy + ps, 0.9, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }

    // 吞噬进度黑点（船头边）
    if (isBow && ship.devourProgress > 0) {
      var dotCount = ship.devourProgress;
      var dotR = 2.5;
      var margin = 4;
      var spacing = (CELL_SIZE - margin * 2) / (dotCount + 1);
      ctx.fillStyle = '#1a1008';
      for (var di = 1; di <= dotCount; di++) {
        var dotX, dotY;
        if (direction === DIR.N) {
          dotX = px + margin + spacing * di;
          dotY = py + margin;
        } else if (direction === DIR.S) {
          dotX = px + margin + spacing * di;
          dotY = py + CELL_SIZE - margin;
        } else if (direction === DIR.E) {
          dotX = px + CELL_SIZE - margin;
          dotY = py + margin + spacing * di;
        } else {
          dotX = px + margin;
          dotY = py + margin + spacing * di;
        }
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawSelectionHighlight(ship) {
  const { col, row, direction, length } = ship;
  const dv = DIR_VECTORS[direction];
  ctx.save();
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#f1c40f';
  ctx.shadowBlur = 8;
  for (let i = 0; i < length; i++) {
    const cx = col + dv.dx * i;
    const cy = row + dv.dy * i;
    ctx.strokeRect(cx * CELL_SIZE + 1, cy * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  }
  ctx.restore();
}

// ── 地形渲染 ──
function drawTerrain() {
  if (terrain.length === 0) return;
  for (var i = 0; i < terrain.length; i++) {
    var t = terrain[i];
    if (t.type === TERRAIN.CLOUD) continue;
    var cx = t.col * CELL_SIZE + CELL_SIZE / 2;
    var cy = t.row * CELL_SIZE + CELL_SIZE / 2;

    if (t.type === TERRAIN.SHOAL) {
      drawShoal(t.col, t.row);
    } else if (t.type === TERRAIN.MEDIUM_SHOAL) {
      drawMediumShoal(t.col, t.row);
    } else if (t.type === TERRAIN.POWDER_KEG) {
      drawPowderKeg(t.col, t.row);
    } else if (t.type === TERRAIN.SUPPLY) {
      drawSupplyPoint(t.col, t.row);
    } else if (t.type === TERRAIN.FLAG) {
      drawFlagPoint(t.col, t.row);
    } else {
      // 山地/雪山/岛屿使用 emoji
      var emojiMap = {};
      emojiMap[TERRAIN.MOUNTAIN] = '⛰️';
      emojiMap[TERRAIN.SNOW_MOUNTAIN] = '🏔️';
      emojiMap[TERRAIN.LOW_ISLAND] = '🏝️';
      var emoji = emojiMap[t.type] || '⛰️';
      ctx.save();
      ctx.font = (CELL_SIZE - 4) + 'px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, cx, cy);
      ctx.restore();
    }
  }
}

// ── 浅滩（5个小点，回合开始时中/大型船搁浅） ──
function drawShoal(col, row) {
  var x = col * CELL_SIZE, y = row * CELL_SIZE, s = CELL_SIZE;
  ctx.save();
  var dots = [
    { dx: 0.25, dy: 0.30 },
    { dx: 0.75, dy: 0.30 },
    { dx: 0.50, dy: 0.50 },
    { dx: 0.25, dy: 0.70 },
    { dx: 0.75, dy: 0.70 }
  ];
  ctx.fillStyle = '#7a6248';
  for (var di = 0; di < dots.length; di++) {
    ctx.beginPath();
    ctx.arc(x + s * dots[di].dx, y + s * dots[di].dy, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── 中浅滩（3个小点，回合开始时大型船搁浅） ──
function drawMediumShoal(col, row) {
  var x = col * CELL_SIZE, y = row * CELL_SIZE, s = CELL_SIZE;
  ctx.save();
  var dots = [
    { dx: 0.30, dy: 0.35 },
    { dx: 0.70, dy: 0.35 },
    { dx: 0.50, dy: 0.70 }
  ];
  ctx.fillStyle = '#8b7355';
  for (var di = 0; di < dots.length; di++) {
    ctx.beginPath();
    ctx.arc(x + s * dots[di].dx, y + s * dots[di].dy, 1.0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── 火药桶（木桶 + 铁箍 + 火花） ──
function drawPowderKeg(col, row) {
  var x = col * CELL_SIZE, y = row * CELL_SIZE, s = CELL_SIZE;
  var cx = x + s / 2, cy = y + s / 2;
  ctx.save();
  // 桶身（圆角矩形）
  var bw = s * 0.45, bh = s * 0.5;
  var bx = cx - bw, by = cy - bh;
  ctx.fillStyle = '#8b5e3c';
  ctx.strokeStyle = '#5d3a1a';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(bx + 3, by);
  ctx.lineTo(bx + bw * 2 - 3, by);
  ctx.quadraticCurveTo(bx + bw * 2, by, bx + bw * 2, by + 3);
  ctx.lineTo(bx + bw * 2, by + bh * 2 - 3);
  ctx.quadraticCurveTo(bx + bw * 2, by + bh * 2, bx + bw * 2 - 3, by + bh * 2);
  ctx.lineTo(bx + 3, by + bh * 2);
  ctx.quadraticCurveTo(bx, by + bh * 2, bx, by + bh * 2 - 3);
  ctx.lineTo(bx, by + 3);
  ctx.quadraticCurveTo(bx, by, bx + 3, by);
  ctx.fill();
  ctx.stroke();
  // 铁箍（两条横线）
  ctx.strokeStyle = '#3a2210';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(bx + 1, by + bh * 0.65);
  ctx.lineTo(bx + bw * 2 - 1, by + bh * 0.65);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx + 1, by + bh * 1.35);
  ctx.lineTo(bx + bw * 2 - 1, by + bh * 1.35);
  ctx.stroke();
  // 火花（顶部橙色小三角）
  ctx.fillStyle = '#f39c12';
  ctx.beginPath();
  ctx.moveTo(cx, by - 2);
  ctx.lineTo(cx - 3, by - 7);
  ctx.lineTo(cx + 3, by - 7);
  ctx.fill();
  ctx.restore();
}

// ── 补给点（红心 + 十字） ──
function drawSupplyPoint(col, row) {
  var x = col * CELL_SIZE, y = row * CELL_SIZE, s = CELL_SIZE;
  var cx = x + s / 2, cy = y + s / 2;
  ctx.save();
  // 红色圆形底
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2);
  ctx.fill();
  // 白色十字
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 5);
  ctx.lineTo(cx, cy + 5);
  ctx.moveTo(cx - 5, cy);
  ctx.lineTo(cx + 5, cy);
  ctx.stroke();
  ctx.restore();
}

// ── 目标点（旗帜标志） ──
function drawFlagPoint(col, row) {
  var x = col * CELL_SIZE, y = row * CELL_SIZE, s = CELL_SIZE;
  ctx.save();
  // 旗杆
  ctx.strokeStyle = '#3e2723';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.35, y + s * 0.8);
  ctx.lineTo(x + s * 0.35, y + s * 0.2);
  ctx.stroke();
  // 红旗（三角）
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.moveTo(x + s * 0.35, y + s * 0.2);
  ctx.lineTo(x + s * 0.8, y + s * 0.35);
  ctx.lineTo(x + s * 0.35, y + s * 0.5);
  ctx.fill();
  ctx.restore();
}

// ── 云雾遮罩（半透明，盖在舰船上方） ──
function drawFogOverlay() {
  if (terrain.length === 0) return;
  var hasFog = false;
  for (var i = 0; i < terrain.length; i++) {
    if (terrain[i].type === TERRAIN.CLOUD) { hasFog = true; break; }
  }
  if (!hasFog) return;
  ctx.save();
  ctx.fillStyle = 'rgba(220, 225, 235, 0.55)';
  for (var i = 0; i < terrain.length; i++) {
    var t = terrain[i];
    if (t.type !== TERRAIN.CLOUD) continue;
    ctx.fillRect(t.col * CELL_SIZE, t.row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
  }
  ctx.restore();
}

function render() {
  drawGrid();
  drawTerrain();
  ships.forEach(function(ship) { drawShip(ship); });
  if (selectedShipIndex >= 0 && selectedShipIndex < ships.length) {
    drawSelectionHighlight(ships[selectedShipIndex]);
  }
  drawSharks();
  drawMines();
  drawFogOverlay();
  drawHitEffects();
}

// ── 鲨鱼渲染 ──
function drawSharks() {
  for (var si = 0; si < sharks.length; si++) {
    var s = sharks[si];
    var px = s.col * CELL_SIZE + CELL_SIZE / 2;
    var py = s.row * CELL_SIZE + CELL_SIZE / 2;
    ctx.save();
    ctx.font = (CELL_SIZE - 4) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🦈', px, py);
    ctx.restore();
  }
}

// ── 水雷渲染 ──
function drawMines() {
  for (var mi = 0; mi < mines.length; mi++) {
    var m = mines[mi];
    var px = m.col * CELL_SIZE + CELL_SIZE / 2;
    var py = m.row * CELL_SIZE + CELL_SIZE / 2;
    ctx.save();
    ctx.font = (CELL_SIZE - 4) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💣', px, py);
    ctx.restore();
  }
}

// ── 炮弹命中特效 ──
function addHitEffect(col, row, emoji) {
  hitEffects.push({ col: col, row: row, emoji: emoji || '💥', endTime: Date.now() + 800 });
  for (const delay of [80, 160, 300, 500, 750]) {
    setTimeout(function() { render(); }, delay);
  }
}

function drawHitEffects() {
  const now = Date.now();
  hitEffects = hitEffects.filter(function(h) { return now < h.endTime; });
  for (const h of hitEffects) {
    const progress = (h.endTime - now) / 800;
    const alpha = 0.4 + 0.6 * Math.abs(Math.sin(progress * Math.PI * 3));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = (CELL_SIZE - 4) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(h.emoji || '💥', h.col * CELL_SIZE + CELL_SIZE / 2, h.row * CELL_SIZE + CELL_SIZE / 2);
    ctx.restore();
  }
}
