// ═══════════════════════════════════════
//  Naval Chess — 全局配置、状态和 DOM 引用
//  加载顺序：第1个（无依赖）
// ═══════════════════════════════════════

// 更新版本时请修改此版本号（格式: YYMMDD-N）
var APP_VERSION = '250603-4';

// ── 菜单控制 ──
var gameMode = 'pvp'; // 'pvp' | 'ai'
var gameSpeed = 'classic'; // 'classic' | 'speed'
var aiDifficulty = 'timid'; // 'reckless' | 'timid' | 'cunning' | 'deep'
var gameOver = false;
var playerKills = [{ ram: 0, broadside: 0, boarding: 0 }, { ram: 0, broadside: 0, boarding: 0 }];
var menuScreen = document.getElementById('menuScreen');
var gameScreen = document.getElementById('gameScreen');
var menuMain = document.getElementById('menuMain');
var menuSubMode = document.getElementById('menuSubMode');
var menuSubLabel = document.getElementById('menuSubLabel');
var btnAI = document.getElementById('btnAI');

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');

// ── 常量 ──
var GRID_SIZE = 20;
var CELL_SIZE = canvas.width / GRID_SIZE; // 28px

// ── 方向枚举 ──
var DIR = { N: 0, E: 1, S: 2, W: 3 };
var DIR_VECTORS = {
  [DIR.N]: { dx: 0, dy: -1 },
  [DIR.E]: { dx: 1, dy: 0 },
  [DIR.S]: { dx: 0, dy: 1 },
  [DIR.W]: { dx: -1, dy: 0 },
};
var DIR_NAMES = { 0: '北', 1: '东', 2: '南', 3: '西' };

// ── 状态 ──
var currentTurn = 1;
var currentPlayerIndex = 0;
var selectedShipIndex = -1;
var ships = [];
var players = [];

// ── DOM 引用 ──
var elTurnNum       = document.getElementById('turnNum');
var elCurrentPlayer = document.getElementById('currentPlayer');
var elPlayerDot     = document.getElementById('playerDot');
var elPlayerFleet   = document.getElementById('playerFleet');
var elCurrentShip   = document.getElementById('currentShip');
var elShipType      = document.getElementById('shipType');
var elActionsLeft   = document.getElementById('actionsLeft');
var elShipHP        = document.getElementById('shipHP');
var elShipSkill     = document.getElementById('shipSkill');
var elSkillInfoItem = document.getElementById('skillInfoItem');
var btnSubmerge     = document.getElementById('btnSubmerge');
var btnBowCannon    = document.getElementById('btnBowCannon');
var btnGreekFire    = document.getElementById('btnGreekFire');
var btnDevour       = document.getElementById('btnDevour');
var btnSharks       = document.getElementById('btnSharks');
var btnMine         = document.getElementById('btnMine');
var btnSupply       = document.getElementById('btnSupply');
var btnAmmo         = document.getElementById('btnAmmo');
var skillActions    = document.getElementById('skillActions');
var elLogArea       = document.getElementById('logArea');
var btnMove         = document.getElementById('btnMove');
var btnTurnLeft     = document.getElementById('btnTurnLeft');
var btnTurnRight    = document.getElementById('btnTurnRight');
var btnBroadside    = document.getElementById('btnBroadside');
var btnRam          = document.getElementById('btnRam');
var btnBoard        = document.getElementById('btnBoard');
var btnEndTurn      = document.getElementById('btnEndTurn');
var btnReset        = document.getElementById('btnReset');
var btnMusic        = document.getElementById('btnMusic');
var bgm             = document.getElementById('bgm');

// ── 音乐 ──
var musicOn = true;
var musicLoaded = false;
bgm.volume = 0.3;

// ── 命中特效 ──
var hitEffects = [];

// ── 鲨鱼 ──
var sharks = [];

// ── 水雷 ──
var mines = [];
var minePlacementMode = false;
var minePlacementShip = null;

// ── AI 超时保护 ──
var aiFailsafeTimer = null;

// ── 多人联机 ──
var mpPendingAction = null;

// ── 关卡模式 ──
var inCampaign = false;
var campaignLevelId = 0;
var campaignUnlockedShips = []; // 已解锁的名船在 famousShipLibrary 中的索引
var campaignCompletedLevels = [];
