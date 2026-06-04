// ═══════════════════════════════════════
//  Naval Chess — UI 更新
//  加载顺序：第4个（依赖 config.js）
//  运行时调用 combat.js 中的 findRammingTarget/findAdjacentEnemy
// ═══════════════════════════════════════

// ── 更新信息面板 ──
function updateInfoPanel() {
  const pNames  = ['葡萄牙帝国', '荷兰东印度公司'];
  const pColors = ['#c0392b', '#2980b9'];
  if (selectedShipIndex >= 0 && selectedShipIndex < ships.length) {
    const ship = ships[selectedShipIndex];
    const typeNames = { 1: '小型舰艇 (1×1)', 2: '中型舰艇 (1×2)', 3: '大型舰艇 (1×3)' };
    elCurrentShip.innerHTML = ship.name ? (ship.name + getFlagSVG(ship)) : `舰船 #${selectedShipIndex + 1}`;
    elShipType.textContent  = typeNames[ship.length] || '未知';
    // 名船技能信息
    if (ship.skill) {
      elSkillInfoItem.style.display = '';
      elShipSkill.innerHTML = ship.skill.replace(/\n/g, '<br>');
    } else {
      elSkillInfoItem.style.display = 'none';
      elShipSkill.innerHTML = '—';
    }
    elActionsLeft.textContent = ship.submerged ? `下潜中(${ship.submergedTurns}回合)` : (ship.boardingTargets.length > 0 ? '接舷战中' : ship.actionsRemaining);
    elShipHP.textContent    = `${ship.hp} / ${ship.maxHp}${ship.boardingTargets.length > 0 ? ' ⚔' : ''}`;
    // 面板显示选中舰船所属势力
    var isAiShip = (gameMode === 'ai' || inCampaign) && ship.playerIndex === 1;
    var isHumanShip = (gameMode === 'ai' || inCampaign) && ship.playerIndex === 0;
    elCurrentPlayer.textContent = isAiShip ? (inCampaign ? '电脑' : '傻兔') : isHumanShip ? '玩家' : `玩家 ${ship.playerIndex + 1}`;
    elPlayerDot.style.background = pColors[ship.playerIndex] || '#666';
    var diffNames2 = { reckless: '鲁莽的敌人', timid: '谨慎的敌人', cunning: '狡诈的敌人', deep: '深不可测的敌人' };
    elPlayerFleet.textContent = isAiShip ? (diffNames2[aiDifficulty] || '电脑') : (pNames[ship.playerIndex] || '未知');
  } else {
    elCurrentShip.textContent = '—';
    elShipType.textContent  = '—';
    elActionsLeft.textContent = '—';
    elShipHP.textContent    = '—';
    elSkillInfoItem.style.display = 'none';
    elShipSkill.textContent = '—';
    // 未选中时显示当前回合方
    updatePlayerDisplay();
  }
  updateActionButtons();
}

function updateActionButtons() {
  const hasSelection = selectedShipIndex >= 0 && selectedShipIndex < ships.length;
  const ship = hasSelection ? ships[selectedShipIndex] : null;
  const isCurrentPlayer = ship && ship.playerIndex === currentPlayerIndex && (!mpGameStarted || currentPlayerIndex === mpPlayerIndex);
  const isBoarding = ship && ship.boardingTargets.length > 0;

  var moveBlocked = ship && ship.skillData && ship.skillData.ironArmor && ship.ironArmorMoves >= 2;
  btnMove.disabled      = !(isCurrentPlayer && !isBoarding && ship.actionsRemaining >= 1 && !moveBlocked);
  var tc = ship ? getTurnCost(ship) : 1;
  btnTurnLeft.disabled  = !(isCurrentPlayer && !isBoarding && ship.actionsRemaining >= tc);
  btnTurnRight.disabled = !(isCurrentPlayer && !isBoarding && ship.actionsRemaining >= tc);
  btnBroadside.disabled = !(isCurrentPlayer && !isBoarding && ship.actionsRemaining >= 1 && ship.broadsideCount < ship.maxBroadsideCount);
  var isSubmerged = ship && ship.submerged;
  btnRam.disabled       = !(isCurrentPlayer && !isBoarding && !isSubmerged && ship.actionsRemaining >= 1 && findRammingTarget(selectedShipIndex) !== null);
  btnBoard.disabled     = !(isCurrentPlayer && !isBoarding && !isSubmerged && ship.actionsRemaining > 0 && findAdjacentEnemy(selectedShipIndex) >= 0);

  // 主动技能按钮（仅显示该名船实际拥有的技能）
  var hasSkills = ship && ship.skillData;
  var showSubmerge = hasSkills && ship.skillData.canSubmerge;
  var showBow      = hasSkills && ship.skillData.canBowCannon;
  var showGreek    = hasSkills && ship.skillData.canGreekFire;
  var showDevour   = hasSkills && ship.skillData.canDevour;
  var showSharks   = hasSkills && ship.skillData.canReleaseSharks;
  var showMines    = hasSkills && ship.skillData.canLayMines;
  var showSupply   = hasSkills && ship.skillData.canSupply;

  var canSubmerge = showSubmerge && !ship.submergeUsed && !ship.submerged;
  var canSurface  = showSubmerge && ship.submerged;
  var canBow      = showBow && !ship.bowCannonUsed && !isSubmerged;
  var canGreek    = showGreek && !ship.greekFireUsed && !isSubmerged;
  var canDevour = showDevour && !isBoarding && ship.actionsRemaining >= 1 && findBowContact(selectedShipIndex) !== null;
  var canSharks = showSharks && !ship.sharksUsed && !isBoarding;
  var canMine = showMines && !isBoarding && ship.actionsRemaining >= 1 && ship.minesPlaced < 3;

  btnSubmerge.style.display = showSubmerge ? '' : 'none';
  btnSubmerge.textContent = canSurface ? '🌊 上浮' : '🌊 下潜';
  btnSubmerge.disabled  = !(isCurrentPlayer && !isBoarding && (canSubmerge || canSurface) && ship.actionsRemaining >= 1);

  btnBowCannon.style.display = showBow ? '' : 'none';
  btnBowCannon.disabled = !(isCurrentPlayer && !isBoarding && canBow && ship.actionsRemaining >= 1);

  btnGreekFire.style.display = showGreek ? '' : 'none';
  btnGreekFire.disabled = !(isCurrentPlayer && !isBoarding && canGreek && ship.actionsRemaining >= 1);

  btnDevour.style.display = showDevour ? '' : 'none';
  btnDevour.disabled = !(isCurrentPlayer && !isBoarding && ship.actionsRemaining >= 1 && findBowContact(selectedShipIndex) !== null);

  btnSharks.style.display = showSharks ? '' : 'none';
  btnSharks.disabled = !(isCurrentPlayer && !isBoarding && !ship.sharksUsed && ship.actionsRemaining >= 1);

  btnMine.style.display = showMines ? '' : 'none';
  btnMine.disabled = !(isCurrentPlayer && !isBoarding && ship.actionsRemaining >= 1 && ship.minesPlaced < 3);

  var hasAdjFriendly = selectedShipIndex >= 0 && findAdjacentFriendly(selectedShipIndex) >= 0;
  btnSupply.style.display = showSupply ? '' : 'none';
  btnSupply.disabled = !(isCurrentPlayer && hasAdjFriendly && ship.actionsRemaining >= 1 && (ship.supplyUsed != null ? ship.supplyUsed : 0) < 3);
  btnAmmo.style.display = showSupply ? '' : 'none';
  btnAmmo.disabled = !(isCurrentPlayer && hasAdjFriendly && ship.actionsRemaining >= 1 && ship.broadsideCount < ship.maxBroadsideCount);

  if (showSubmerge || showBow || showGreek || showDevour || showSharks || showMines || showSupply) {
    skillActions.style.display = '';
  } else {
    skillActions.style.display = 'none';
  }
}

function updatePlayerDisplay() {
  const pNames  = ['葡萄牙帝国', '荷兰东印度公司'];
  const pColors = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad'];
  var diffNames = { reckless: '鲁莽的敌人', timid: '谨慎的敌人', cunning: '狡诈的敌人', deep: '深不可测的敌人' };
  elTurnNum.textContent = currentTurn;
  var isAi = (gameMode === 'ai' || inCampaign) && currentPlayerIndex === 1;
  var isHumanInAi = gameMode === 'ai' && currentPlayerIndex === 0;
  elCurrentPlayer.textContent = isAi ? (inCampaign ? '电脑' : '傻兔') : isHumanInAi ? '玩家' : `玩家 ${currentPlayerIndex + 1}`;
  elPlayerDot.style.background = pColors[currentPlayerIndex] || '#666';
  elPlayerFleet.textContent = isAi ? (diffNames[aiDifficulty] || '电脑') : (pNames[currentPlayerIndex] || '未知');
}

// ── 所有舰船每回合默认 3 次行动 ──
function getMaxActions(length) {
  return 3;
}

// ── 检查当前玩家是否所有舰船行动耗尽 ──
function isCurrentPlayerExhausted() {
  return ships
    .filter(function(s) { return s.playerIndex === currentPlayerIndex; })
    .every(function(s) { return s.actionsRemaining <= 0 || s.boardingTargets.length > 0; });
}
