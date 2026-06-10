// ═══════════════════════════════════════
//  Naval Chess — 关卡模式
//  加载顺序：第9个（依赖 famous-ships.js, ai.js）
// ═══════════════════════════════════════

// ── 存档持久化 ──
var CAMPAIGN_SAVE_KEY = 'navalChessCampaign_v1';

var campaignBestStars = {}; // { levelId: starCount }
var claimedAchievements = []; // 已领取的成就ID

// ── 成就系统 ──
var ACHIEVEMENTS = [
  { id: 'perfect1', name: '完美战役 I', desc: '关卡模式累计取得 9 ⭐', target: 9, rewardShipIdx: 3 },
  { id: 'perfect2', name: '完美战役 II', desc: '关卡模式累计取得 18 ⭐', target: 18, rewardShipIdx: 7 },
  { id: 'perfect3', name: '完美战役 III', desc: '关卡模式累计取得 27 ⭐', target: 27, rewardShipIdx: 10 }
];

function getTotalCampaignStars() {
  var total = 0;
  for (var key in campaignBestStars) {
    if (campaignBestStars.hasOwnProperty(key)) total += campaignBestStars[key];
  }
  return total;
}

function checkAchievements() {
  var totalStars = getTotalCampaignStars();
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var ach = ACHIEVEMENTS[i];
    if (totalStars >= ach.target && !ach._notified) {
      ach._notified = true;
      log('🏆 成就解锁：' + ach.name + ' — 请前往成就页面领取奖励！');
    }
  }
}

function claimAchievement(achId) {
  var ach = null, achIdx = -1;
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    if (ACHIEVEMENTS[i].id === achId) { ach = ACHIEVEMENTS[i]; achIdx = i; break; }
  }
  if (!ach) return;
  var totalStars = getTotalCampaignStars();
  if (totalStars < ach.target) return;
  if (claimedAchievements.indexOf(achId) >= 0) return;
  // 领取
  claimedAchievements.push(achId);
  if (campaignUnlockedShips.indexOf(ach.rewardShipIdx) < 0) {
    campaignUnlockedShips.push(ach.rewardShipIdx);
  }
  saveCampaignProgress();
  updateLibraryDisplay();
  renderAchievementList();
  log('🎉 ' + ach.name + ' 奖励已领取：' + famousShipLibrary[ach.rewardShipIdx].name + ' 加入名船库！');
  // 弹出名船获取窗口
  showShipDetail(ach.rewardShipIdx);
}

function renderAchievementList() {
  var listEl = document.getElementById('achList');
  if (!listEl) return;
  var totalStars = getTotalCampaignStars();
  var html = '';
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var ach = ACHIEVEMENTS[i];
    var progress = Math.min(100, Math.round(totalStars / ach.target * 100));
    var earned = totalStars >= ach.target;
    var claimed = claimedAchievements.indexOf(ach.id) >= 0;
    var ship = famousShipLibrary[ach.rewardShipIdx];
    var flagHtml = (ship && typeof getFlagSVG === 'function') ? getFlagSVG(ship) : '';
    html += '<div class="ach-item' + (claimed ? ' claimed' : '') + (earned ? ' earned' : '') + '">';
    html += '<div class="ach-header">';
    html += '<span class="ach-name' + (earned ? ' ach-gold' : '') + '">' + ach.name + (earned ? ' 🏆' : '') + '</span>';
    html += '<span class="ach-status">' + totalStars + '/' + ach.target + '⭐' + (earned ? ' ✅️' : '') + '</span>';
    html += '</div>';
    html += '<div class="ach-desc">' + ach.desc + '</div>';
    html += '<div class="ach-reward">';
    html += '🎁 ' + (ship ? ship.name : '?') + ' <span class="ach-flag">' + flagHtml + '</span>';
    if (claimed) {
      html += ' <button class="ach-claim-btn ach-claimed-btn" disabled>已领取</button>';
    } else if (earned) {
      html += ' <button class="ach-claim-btn" data-ach-id="' + ach.id + '">领取</button>';
    }
    html += '</div>';
    html += '<div class="ach-bar-wrap"><div class="ach-bar-fill" style="width:' + progress + '%"></div></div>';
    html += '</div>';
  }
  listEl.innerHTML = html;
}

function saveCampaignProgress() {
  try {
    var data = {
      v: 3,
      unlockedShips: campaignUnlockedShips,
      completedLevels: campaignCompletedLevels,
      bestStars: campaignBestStars,
      claimedAchievements: claimedAchievements
    };
    localStorage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage 不可用（无痕模式、配额满等），静默失败
  }
}

function loadCampaignProgress() {
  try {
    var raw = localStorage.getItem(CAMPAIGN_SAVE_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    // v1 兼容：无 bestStars，默认为空
    campaignUnlockedShips = data.unlockedShips || [];
    campaignCompletedLevels = data.completedLevels || [];
    campaignBestStars = data.bestStars || {};
    claimedAchievements = data.claimedAchievements || [];
  } catch (e) {
    // 数据损坏则丢弃，保留默认空数组
  }
}

// ── 地形批量生成辅助 ──
function _tr(row, from, to, type) {
  var arr = [];
  for (var c = from; c <= to; c++) arr.push({ col: c, row: row, type: type });
  return arr;
}

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
  },
  { // 关卡 3 — 海峡交战（修订版）
    id: 3,
    aiShips: ['黄泉号'],
    deployZone: { colMin: 0, colMax: 7, rowMin: 8, rowMax: 15, dirs: [DIR.N, DIR.E, DIR.S] },
    enemyFleet: [
      // 船头格→锚点：朝西时锚点col = 船头col + (length-1)
      { name: '黄泉号', length: 3, col: 14, row: 7, direction: DIR.W,
        skill: famousShipLibrary[8].skill, skillData: famousShipLibrary[8].skillData,
        flagColor: famousShipLibrary[8].flagColor, flagShape: famousShipLibrary[8].flagShape,
        flagIcon: famousShipLibrary[8].flagIcon, flagPattern: famousShipLibrary[8].flagPattern },
      { name: '中型舰艇', length: 2, col: 14, row: 5, direction: DIR.W,
        skill: null, skillData: null },
      { name: '中型舰艇', length: 2, col: 14, row: 9, direction: DIR.W,
        skill: null, skillData: null },
      { name: '小型舰艇', length: 1, col: 10, row: 8, direction: DIR.W,
        skill: null, skillData: null },
      { name: '小型舰艇', length: 1, col: 11, row: 6, direction: DIR.W,
        skill: null, skillData: null },
      { name: '小型舰艇', length: 1, col: 17, row: 8, direction: DIR.W,
        skill: null, skillData: null }
    ],
    terrain: [].concat(
      // ═══ 雪山大陆（左上，冰盖向东收缩） ═══
      _tr(0,0,17, TERRAIN.SNOW_MOUNTAIN), _tr(1,0,16, TERRAIN.SNOW_MOUNTAIN),
      _tr(2,0,14, TERRAIN.SNOW_MOUNTAIN),
      _tr(3,0,12, TERRAIN.SNOW_MOUNTAIN),
      _tr(4,0,10, TERRAIN.SNOW_MOUNTAIN),
      _tr(5,0,8, TERRAIN.SNOW_MOUNTAIN),
      _tr(6,0,8, TERRAIN.SNOW_MOUNTAIN), _tr(7,2,7, TERRAIN.SNOW_MOUNTAIN),
      _tr(8,4,7, TERRAIN.SNOW_MOUNTAIN),
      _tr(9,5,7, TERRAIN.SNOW_MOUNTAIN),
      // ═══ 山地大陆（右下，留出右侧开阔水域） ═══
      _tr(10,11,12, TERRAIN.MOUNTAIN),
      _tr(11,11,13, TERRAIN.MOUNTAIN),
      _tr(12,11,16, TERRAIN.MOUNTAIN),
      _tr(13,7,19, TERRAIN.MOUNTAIN),
      _tr(14,5,19, TERRAIN.MOUNTAIN),
      _tr(15,4,19, TERRAIN.MOUNTAIN),
      _tr(16,3,19, TERRAIN.MOUNTAIN),
      _tr(17,3,19, TERRAIN.MOUNTAIN),
      _tr(18,2,19, TERRAIN.MOUNTAIN),
      _tr(19,1,19, TERRAIN.MOUNTAIN)
    ),
    unlockShip: 8 // 通关解锁 famousShipLibrary[8] = 黄泉号
  },
  { // 关卡 4 — 浅滩群岛
    id: 4,
    aiShips: ['黑珍珠号'],
    deployZone: { colMin: 0, colMax: 4, dirs: [DIR.N, DIR.E, DIR.S] },
    enemyFleet: [
      // 黑珍珠号：船头P8朝西，长度2，锚点(16,7)
      { name: '黑珍珠号', length: 2, col: 16, row: 7, direction: DIR.W,
        skill: famousShipLibrary[1].skill, skillData: famousShipLibrary[1].skillData,
        flagColor: famousShipLibrary[1].flagColor, flagShape: famousShipLibrary[1].flagShape,
        flagIcon: famousShipLibrary[1].flagIcon, flagPattern: famousShipLibrary[1].flagPattern },
      // 普通大船：船头K12朝南，长度3，锚点(10,9)，已搁浅于中浅滩
      { name: '大型舰艇', length: 3, col: 10, row: 9, direction: DIR.S,
        skill: null, skillData: null },
      // 普通中船：船头O13朝西，长度2，锚点(15,12)
      { name: '中型舰艇', length: 2, col: 15, row: 12, direction: DIR.W,
        skill: null, skillData: null },
      // 普通中船：船头N18朝西，长度2，锚点(14,17)
      { name: '中型舰艇', length: 2, col: 14, row: 17, direction: DIR.W,
        skill: null, skillData: null },
      // 普通小船：船头P14朝西，长度1，锚点(15,13)
      { name: '小型舰艇', length: 1, col: 15, row: 13, direction: DIR.W,
        skill: null, skillData: null },
      // 普通小船：船头P7朝西，长度1，锚点(15,6)
      { name: '小型舰艇', length: 1, col: 15, row: 6, direction: DIR.W,
        skill: null, skillData: null },
      // 普通中船：船头N3朝西，长度2，锚点(14,2)
      { name: '中型舰艇', length: 2, col: 14, row: 2, direction: DIR.W,
        skill: null, skillData: null }
    ],
    terrain: [
      { col: 8, row: 3, type: TERRAIN.MEDIUM_SHOAL },
      { col: 9, row: 3, type: TERRAIN.MEDIUM_SHOAL },
      { col: 10, row: 3, type: TERRAIN.MEDIUM_SHOAL },
      { col: 11, row: 3, type: TERRAIN.MEDIUM_SHOAL },
      { col: 7, row: 4, type: TERRAIN.MEDIUM_SHOAL },
      { col: 8, row: 4, type: TERRAIN.SHOAL },
      { col: 9, row: 4, type: TERRAIN.SHOAL },
      { col: 10, row: 4, type: TERRAIN.SHOAL },
      { col: 11, row: 4, type: TERRAIN.SHOAL },
      { col: 12, row: 4, type: TERRAIN.MEDIUM_SHOAL },
      { col: 6, row: 5, type: TERRAIN.MEDIUM_SHOAL },
      { col: 7, row: 5, type: TERRAIN.SHOAL },
      { col: 8, row: 5, type: TERRAIN.SHOAL },
      { col: 9, row: 5, type: TERRAIN.LOW_ISLAND },
      { col: 10, row: 5, type: TERRAIN.LOW_ISLAND },
      { col: 11, row: 5, type: TERRAIN.SHOAL },
      { col: 12, row: 5, type: TERRAIN.SHOAL },
      { col: 13, row: 5, type: TERRAIN.MEDIUM_SHOAL },
      { col: 0, row: 6, type: TERRAIN.MEDIUM_SHOAL },
      { col: 6, row: 6, type: TERRAIN.MEDIUM_SHOAL },
      { col: 7, row: 6, type: TERRAIN.MEDIUM_SHOAL },
      { col: 8, row: 6, type: TERRAIN.SHOAL },
      { col: 9, row: 6, type: TERRAIN.SHOAL },
      { col: 10, row: 6, type: TERRAIN.SHOAL },
      { col: 11, row: 6, type: TERRAIN.SHOAL },
      { col: 12, row: 6, type: TERRAIN.MEDIUM_SHOAL },
      { col: 13, row: 6, type: TERRAIN.MEDIUM_SHOAL },
      { col: 0, row: 7, type: TERRAIN.SHOAL },
      { col: 1, row: 7, type: TERRAIN.MEDIUM_SHOAL },
      { col: 7, row: 7, type: TERRAIN.MEDIUM_SHOAL },
      { col: 8, row: 7, type: TERRAIN.MEDIUM_SHOAL },
      { col: 9, row: 7, type: TERRAIN.SHOAL },
      { col: 10, row: 7, type: TERRAIN.SHOAL },
      { col: 11, row: 7, type: TERRAIN.MEDIUM_SHOAL },
      { col: 12, row: 7, type: TERRAIN.MEDIUM_SHOAL },
      { col: 0, row: 8, type: TERRAIN.SHOAL },
      { col: 1, row: 8, type: TERRAIN.SHOAL },
      { col: 2, row: 8, type: TERRAIN.MEDIUM_SHOAL },
      { col: 8, row: 8, type: TERRAIN.MEDIUM_SHOAL },
      { col: 9, row: 8, type: TERRAIN.MEDIUM_SHOAL },
      { col: 10, row: 8, type: TERRAIN.MEDIUM_SHOAL },
      { col: 11, row: 8, type: TERRAIN.MEDIUM_SHOAL },
      { col: 0, row: 9, type: TERRAIN.LOW_ISLAND },
      { col: 1, row: 9, type: TERRAIN.SHOAL },
      { col: 2, row: 9, type: TERRAIN.SHOAL },
      { col: 3, row: 9, type: TERRAIN.MEDIUM_SHOAL },
      { col: 9, row: 9, type: TERRAIN.MEDIUM_SHOAL },
      { col: 10, row: 9, type: TERRAIN.MEDIUM_SHOAL },
      { col: 0, row: 10, type: TERRAIN.LOW_ISLAND },
      { col: 1, row: 10, type: TERRAIN.SHOAL },
      { col: 2, row: 10, type: TERRAIN.SHOAL },
      { col: 3, row: 10, type: TERRAIN.MEDIUM_SHOAL },
      { col: 9, row: 10, type: TERRAIN.MEDIUM_SHOAL },
      { col: 10, row: 10, type: TERRAIN.MEDIUM_SHOAL },
      { col: 0, row: 11, type: TERRAIN.SHOAL },
      { col: 1, row: 11, type: TERRAIN.SHOAL },
      { col: 2, row: 11, type: TERRAIN.MEDIUM_SHOAL },
      { col: 8, row: 11, type: TERRAIN.MEDIUM_SHOAL },
      { col: 9, row: 11, type: TERRAIN.MEDIUM_SHOAL },
      { col: 10, row: 11, type: TERRAIN.MEDIUM_SHOAL },
      { col: 11, row: 11, type: TERRAIN.MEDIUM_SHOAL },
      { col: 0, row: 12, type: TERRAIN.SHOAL },
      { col: 1, row: 12, type: TERRAIN.MEDIUM_SHOAL },
      { col: 7, row: 12, type: TERRAIN.MEDIUM_SHOAL },
      { col: 8, row: 12, type: TERRAIN.MEDIUM_SHOAL },
      { col: 9, row: 12, type: TERRAIN.SHOAL },
      { col: 10, row: 12, type: TERRAIN.SHOAL },
      { col: 11, row: 12, type: TERRAIN.MEDIUM_SHOAL },
      { col: 12, row: 12, type: TERRAIN.MEDIUM_SHOAL },
      { col: 0, row: 13, type: TERRAIN.MEDIUM_SHOAL },
      { col: 6, row: 13, type: TERRAIN.MEDIUM_SHOAL },
      { col: 7, row: 13, type: TERRAIN.MEDIUM_SHOAL },
      { col: 8, row: 13, type: TERRAIN.SHOAL },
      { col: 9, row: 13, type: TERRAIN.SHOAL },
      { col: 10, row: 13, type: TERRAIN.SHOAL },
      { col: 11, row: 13, type: TERRAIN.SHOAL },
      { col: 12, row: 13, type: TERRAIN.MEDIUM_SHOAL },
      { col: 13, row: 13, type: TERRAIN.MEDIUM_SHOAL },
      { col: 6, row: 14, type: TERRAIN.MEDIUM_SHOAL },
      { col: 7, row: 14, type: TERRAIN.SHOAL },
      { col: 8, row: 14, type: TERRAIN.SHOAL },
      { col: 9, row: 14, type: TERRAIN.LOW_ISLAND },
      { col: 10, row: 14, type: TERRAIN.LOW_ISLAND },
      { col: 11, row: 14, type: TERRAIN.SHOAL },
      { col: 12, row: 14, type: TERRAIN.SHOAL },
      { col: 13, row: 14, type: TERRAIN.MEDIUM_SHOAL },
      { col: 7, row: 15, type: TERRAIN.MEDIUM_SHOAL },
      { col: 8, row: 15, type: TERRAIN.SHOAL },
      { col: 9, row: 15, type: TERRAIN.SHOAL },
      { col: 10, row: 15, type: TERRAIN.SHOAL },
      { col: 11, row: 15, type: TERRAIN.SHOAL },
      { col: 12, row: 15, type: TERRAIN.MEDIUM_SHOAL },
      { col: 8, row: 16, type: TERRAIN.MEDIUM_SHOAL },
      { col: 9, row: 16, type: TERRAIN.MEDIUM_SHOAL },
      { col: 10, row: 16, type: TERRAIN.MEDIUM_SHOAL },
      { col: 11, row: 16, type: TERRAIN.MEDIUM_SHOAL }
  ],

    unlockShip: 1 // 通关解锁 famousShipLibrary[1] = 黑珍珠号
  },
  { // 关卡 5 — 港口突围
    id: 5,
    aiShips: ['安妮女王复仇号'],
    deployZone: { colMin: 1, colMax: 9, rowMin: 10, rowMax: 18, dirs: [DIR.N, DIR.S],
      adjacentToTerrain: TERRAIN.MOUNTAIN, dockBroadside: true }, // B11~J19，仅南北朝向确保舷侧贴⛰️
    enemyFleet: [
      // 安妮女王复仇号：红色格▼(col 9,row 12)，船头朝南，舰体(col 9, row 11-12)
      { name: '安妮女王复仇号', length: 2, col: 9, row: 11, direction: DIR.S,
        skill: famousShipLibrary[5].skill, skillData: famousShipLibrary[5].skillData,
        flagColor: famousShipLibrary[5].flagColor, flagShape: famousShipLibrary[5].flagShape,
        flagIcon: famousShipLibrary[5].flagIcon, flagPattern: famousShipLibrary[5].flagPattern,
        alert: false },
      // 4艘大型舰艇（警戒中，不主动移动直到敌船进入舷炮射程）
      { name: '大型舰艇', length: 3, col: 15, row: 0, direction: DIR.S,   // ▼ P1+P2+P3 (15,0)-(15,2)
        skill: null, skillData: null, alert: true },
      { name: '大型舰艇', length: 3, col: 9, row: 8, direction: DIR.W,     // ◀ bow (7,8)
        skill: null, skillData: null, alert: true },
      { name: '大型舰艇', length: 3, col: 11, row: 10, direction: DIR.S,   // ▼ bow (11,12)
        skill: null, skillData: null, alert: true },
      { name: '大型舰艇', length: 3, col: 19, row: 4, direction: DIR.W,    // ◀ R5+S5+T5 (17,4)-(19,4)
        skill: null, skillData: null, alert: true },
      // 3艘中型舰艇
      { name: '中型舰艇', length: 2, col: 8, row: 10, direction: DIR.W,    // ◀ H11+I11 (7,10)-(8,10)
        skill: null, skillData: null },
      { name: '中型舰艇', length: 2, col: 10, row: 5, direction: DIR.W,    // ◀ J6+K6 (9,5)-(10,5)
        skill: null, skillData: null },
      { name: '中型舰艇', length: 2, col: 14, row: 9, direction: DIR.S,    // ▼ bow (14,10)
        skill: null, skillData: null },
      // 4艘小型舰艇
      { name: '小型舰艇', length: 1, col: 8, row: 2, direction: DIR.S,     // ▼ bow (8,2)
        skill: null, skillData: null },
      { name: '小型舰艇', length: 1, col: 14, row: 5, direction: DIR.W,    // ◀ bow (14,5)
        skill: null, skillData: null },
      { name: '小型舰艇', length: 1, col: 17, row: 11, direction: DIR.W,   // ◀ bow (17,11)
        skill: null, skillData: null },
      { name: '小型舰艇', length: 1, col: 7, row: 12, direction: DIR.W,    // ◀ bow (7,12)
        skill: null, skillData: null },
    ],
    terrain: [].concat(
      // 左上角山地（模拟海岸线）
      { col: 0, row: 3, type: TERRAIN.MOUNTAIN },
      _tr(4,0,1, TERRAIN.MOUNTAIN),
      _tr(5,0,2, TERRAIN.MOUNTAIN),
      _tr(6,0,3, TERRAIN.MOUNTAIN),
      _tr(7,0,4, TERRAIN.MOUNTAIN),
      _tr(8,0,5, TERRAIN.MOUNTAIN),
      _tr(9,0,6, TERRAIN.MOUNTAIN),
      _tr(10,0,1, TERRAIN.MOUNTAIN),
      _tr(11,0,1, TERRAIN.MOUNTAIN),
      _tr(12,0,1, TERRAIN.MOUNTAIN),
      _tr(13,0,1, TERRAIN.MOUNTAIN),
      { col: 10, row: 13, type: TERRAIN.MOUNTAIN },
      { col: 0, row: 14, type: TERRAIN.MOUNTAIN },
      _tr(14,10,11, TERRAIN.MOUNTAIN),
      { col: 0, row: 15, type: TERRAIN.MOUNTAIN },
      _tr(15,10,12, TERRAIN.MOUNTAIN),
      { col: 0, row: 16, type: TERRAIN.MOUNTAIN },
      _tr(16,10,13, TERRAIN.MOUNTAIN),
      { col: 0, row: 17, type: TERRAIN.MOUNTAIN },
      _tr(17,10,14, TERRAIN.MOUNTAIN),
      { col: 0, row: 18, type: TERRAIN.MOUNTAIN },
      _tr(18,7,15, TERRAIN.MOUNTAIN),
      _tr(19,0,16, TERRAIN.MOUNTAIN),
      // 港口突围胜利点（右上角）
      { col: 19, row: 0, type: TERRAIN.FLAG }
    ),
    // 港口突围特殊胜利条件
    hasFlagVictory: true,
    unlockShip: 5 // 通关解锁 famousShipLibrary[5] = 安妮女王复仇号
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
  var famousPool = getCampaignFamousPool(levelId).slice().sort(function() { return Math.random() - 0.5; }); // 随机打乱名船池
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
  sharks = []; mines = []; minePlacementMode = false;
  playerKills = [{ ram: 0, broadside: 0, boarding: 0 }, { ram: 0, broadside: 0, boarding: 0 }];
  btnEndTurn.disabled = false;
  btnReset.disabled = false;
  ships = [];
  var level = campaignLevels[campaignLevelId - 1];
  // 加载关卡地形
  terrain = (level.terrain && level.terrain.length > 0) ? level.terrain.slice() : [];

  // 电脑舰队先部署（固定位置），确保后续玩家随机放置不会重叠
  var blueFleet = level.enemyFleet;
  for (var i = 0; i < blueFleet.length; i++) {
    var def = blueFleet[i];
    ships.push(createShip({
      col: def.col, row: def.row, length: def.length, direction: def.direction,
      playerIndex: 1,
      name: def.name, skill: def.skill, skillData: def.skillData,
      flagColor: def.flagColor, flagShape: def.flagShape,
      flagIcon: def.flagIcon, flagPattern: def.flagPattern
    }));
    // 设置警戒状态（关卡5的敌方大型舰船初始警戒中）
    if (def.alert) {
      ships[ships.length - 1].alert = true;
    }
  }

  // 玩家舰队随机部署（此时敌舰已存在，placeFleet 的 isCellOccupied 会避开）
  var redFleet = (redPicks && redPicks.length > 0) ? redPicks : getDefaultFleet();
  var dz = level.deployZone;
  if (dz) {
    placeFleet(redFleet, 0, dz.colMin, dz.colMax, dz.dirs, dz.rowMin, dz.rowMax,
      dz.adjacentToTerrain ? { adjacentToTerrain: dz.adjacentToTerrain } : undefined);
  } else if (campaignLevelId >= 2) {
    placeFleet(redFleet, 0, 5, 10, [DIR.N, DIR.E, DIR.S], 6, 15);
  } else {
    placeFleet(redFleet, 0, 0, 4, [DIR.N, DIR.E, DIR.S]);
  }

  log('关卡 ' + campaignLevelId + '：迎战 ' + level.enemyFleet[0].name + '！');
  log('敌军就位。红方 ' + redFleet.length + ' 艘舰船部署完毕。');

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

// ── 关卡通关处理 ──
var _pendingUnlockShip = null; // 待显示的名船解锁信息

function completeCurrentLevel(starCount) {
  var level = campaignLevels[campaignLevelId - 1];
  var isNew = campaignCompletedLevels.indexOf(campaignLevelId) < 0;
  if (isNew) {
    campaignCompletedLevels.push(campaignLevelId);
  }
  // 保存最佳星级
  var prev = campaignBestStars[campaignLevelId] || 0;
  var stars = starCount || 1;
  if (stars > prev) campaignBestStars[campaignLevelId] = stars;
  if (level.unlockShip !== undefined && campaignUnlockedShips.indexOf(level.unlockShip) < 0) {
    campaignUnlockedShips.push(level.unlockShip);
    _pendingUnlockShip = famousShipLibrary[level.unlockShip]; // 延迟到结算窗口之后显示
  }
  saveCampaignProgress();
  updateCampaignLevelButtons();
  checkAchievements();
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
    // 更新星级显示
    var starEl = document.getElementById('lvl' + (i + 1) + 'Stars');
    if (starEl) {
      var best = campaignBestStars[i + 1] || 0;
      if (best > 0) {
        var html = '';
        for (var s = 1; s <= 3; s++) {
          html += s <= best ? '⭐' : '<span style="opacity:0.2">☆</span>';
        }
        starEl.innerHTML = html;
      } else {
        starEl.innerHTML = '';
      }
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
    if (unlocked) {
      html += '<button class="lib-ship-btn" onclick="showShipDetail(' + i + ')">';
      html += '<div class="lib-ship-flag">' + getFlagSVG(ship) + '</div>';
      html += '<div class="lib-ship-name">' + ship.name + '</div>';
      html += '</button>';
    } else {
      html += '<div class="library-ship locked">';
      html += '<div class="lib-ship-icon">?</div>';
      html += '<div class="lib-ship-name">???</div>';
      html += '</div>';
    }
  }
  grid.innerHTML = html;
}

// ── 名船详情弹窗 ──
function showShipDetail(shipIndex) {
  var ship = famousShipLibrary[shipIndex];
  if (!ship) return;
  var typeNames = { 1: '小型舰船', 2: '中型舰船', 3: '大型舰船' };
  document.getElementById('detailFlag').innerHTML = getFlagSVG(ship);
  document.getElementById('detailName').textContent = ship.name;
  document.getElementById('detailType').textContent = typeNames[ship.length];
  document.getElementById('detailPrice').textContent = ship.price + ' 费';
  document.getElementById('detailSkill').innerHTML = ship.skill.replace(/\n/g, '<br>');
  var overlay = document.getElementById('shipDetailOverlay');
  overlay.classList.remove('hidden');
  overlay.style.display = 'flex';
}

function hideShipDetail() {
  var overlay = document.getElementById('shipDetailOverlay');
  overlay.classList.add('hidden');
  overlay.style.display = 'none';
}

document.getElementById('btnDetailClose').addEventListener('click', hideShipDetail);

// 点击遮罩背景关闭
document.getElementById('shipDetailOverlay').addEventListener('click', function(e) {
  if (e.target === this) hideShipDetail();
});

// ── 成就界面（事件委托：避免 DOM 未就绪时元素不存在） ──
document.addEventListener('click', function(e) {
  // 打开成就界面
  if (e.target.id === 'btnAchievements' || (e.target.closest && e.target.closest('#btnAchievements'))) {
    try {
      renderAchievementList();
      var overlay = document.getElementById('achievementOverlay');
      if (overlay) { overlay.classList.remove('hidden'); overlay.style.display = 'flex'; }
    } catch (err) { console.error('成就界面打开失败:', err); }
    return;
  }
  // 关闭成就界面
  if (e.target.id === 'btnAchClose' || (e.target.closest && e.target.closest('#btnAchClose'))) {
    var achOverlay = document.getElementById('achievementOverlay');
    if (achOverlay) { achOverlay.classList.add('hidden'); achOverlay.style.display = 'none'; }
    return;
  }
  // 点击遮罩背景关闭
  if (e.target.id === 'achievementOverlay') {
    e.target.classList.add('hidden');
    e.target.style.display = 'none';
    return;
  }
  // 领取成就奖励
  if (e.target.classList.contains('ach-claim-btn')) {
    var achId = e.target.getAttribute('data-ach-id');
    if (achId) claimAchievement(achId);
    return;
  }
});

// ── 绑定关卡按钮 ──
for (var li = 0; li < campaignLevels.length; li++) {
  var lvlBtn = document.getElementById('lvl' + (li + 1));
  if (lvlBtn) {
    lvlBtn.addEventListener('click', (function(id) {
      return function() { startCampaignLevel(id); };
    })(li + 1));
  }
}

// 初始化时载入存档并刷新UI
loadCampaignProgress();
updateCampaignLevelButtons();
updateLibraryDisplay();
checkAchievements();
