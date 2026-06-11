// ═══════════════════════════════════════
//  Naval Chess — WebSocket 权威服务器
//  启动: node server.js
//  默认端口 3000
//
//  服务器职责：
//  1. 房间管理（创建/加入/销毁）
//  2. 阶段管理（lobby → selection → playing → ended）
//  3. 回合强制（仅当前回合方可行动）
//  4. 消息验证与中继
//  5. 应用层心跳检测与断线重连
// ═══════════════════════════════════════

const WebSocket = require('ws');
const PORT = process.env.PORT || 3000;

const server = new WebSocket.Server({ port: PORT });
console.log(`Naval Chess 联机服务器已启动，端口 ${PORT}`);

// ── 房间存储 ──
// rooms[code] = {
//   players: [ws0, ws1],
//   phase: 'lobby' | 'selection' | 'playing' | 'ended',
//   currentTurn: 0 | 1,      // 当前可行动的玩家索引
//   turnNumber: 1,
//   createdAt: timestamp,
//   disconnectTimers: [timer0, timer1], // 断线清理倒计时
// }
const rooms = {};
const DISCONNECT_GRACE = 60000; // 60秒断线宽限期，期内允许重连
const HEARTBEAT_INTERVAL = 10000; // 每10秒检查一次心跳
const HEARTBEAT_WARN = 15000;    // 15秒无消息 → 发送 ping_check
const HEARTBEAT_DEAD = 30000;    // 30秒无消息 → 断开

// WebSocket → { room, playerIndex }
const playerMap = new Map();

// ── 工具函数 ──

function createRoom() {
  const code = String(Math.floor(1000 + Math.random() * 9000));
  rooms[code] = {
    players: [null, null],
    phase: 'lobby',
    currentTurn: 0,
    turnNumber: 1,
    createdAt: Date.now(),
  };
  console.log(`[${code}] 房间创建`);
  return code;
}

function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastToRoom(roomCode, data, excludeWs) {
  const room = rooms[roomCode];
  if (!room) return;
  for (const player of room.players) {
    if (player && player !== excludeWs && player.readyState === WebSocket.OPEN) {
      player.send(JSON.stringify(data));
    }
  }
}

function broadcastToAll(roomCode, data) {
  const room = rooms[roomCode];
  if (!room) return;
  for (const player of room.players) {
    send(player, data);
  }
}

function cleanupRoom(roomCode, reason) {
  const room = rooms[roomCode];
  if (!room) return;
  console.log(`[${roomCode}] 房间关闭: ${reason || '正常'}`);
  // 清除所有断线倒计时
  if (room.disconnectTimers) {
    room.disconnectTimers.forEach(function(t) { if (t) clearTimeout(t); });
  }
  for (const player of room.players) {
    if (player) {
      send(player, { type: 'roomClosed', reason: reason || '房间已关闭' });
      playerMap.delete(player);
    }
  }
  delete rooms[roomCode];
}

// ── 连接处理 ──

server.on('connection', (ws) => {
  console.log('>>> 新客户端已连接');
  let playerInfo = null; // { room, playerIndex }
  let msgCount = 0;

  // 应用层心跳：记录最后一次收到消息的时间
  ws.lastMessageTime = Date.now();

  ws.on('message', (raw) => {
    // 任何应用层消息都证明连接活跃
    ws.lastMessageTime = Date.now();

    let msg;
    try { msg = JSON.parse(raw); } catch (e) {
      console.log('>>> 收到无效 JSON:', String(raw).slice(0, 80));
      return;
    }

    msgCount++;
    if (msgCount <= 5) console.log(`>>> 收到消息 #${msgCount}: type=${msg.type}`);

    try {
    switch (msg.type) {

      // ── 创建房间 ──
      case 'create': {
        const code = createRoom();
        const room = rooms[code];
        room.players[0] = ws;
        playerInfo = { room: code, playerIndex: 0 };
        playerMap.set(ws, playerInfo);
        send(ws, { type: 'roomCreated', room: code, playerIndex: 0 });
        console.log(`[${code}] 房主加入，等待对手…`);
        break;
      }

      // ── 加入房间 ──
      case 'join': {
        const code = msg.room;
        const room = rooms[code];
        if (!room) {
          send(ws, { type: 'error', message: '房间不存在' });
          return;
        }
        if (room.players[1]) {
          send(ws, { type: 'error', message: '房间已满' });
          return;
        }
        room.players[1] = ws;
        playerInfo = { room: code, playerIndex: 1 };
        playerMap.set(ws, playerInfo);
        send(ws, { type: 'roomJoined', room: code, playerIndex: 1 });
        // 双方都进入选船阶段
        room.phase = 'selection';
        broadcastToAll(code, { type: 'gameStart', room: code });
        console.log(`[${code}] 对手加入，进入选船阶段`);
        break;
      }

      // ── 选船阶段：中继消息 ──
      case 'selectionData':
      case 'selectionUpdate':
      case 'selectionConfirmed': {
        if (!playerInfo) return;
        const room = rooms[playerInfo.room];
        if (!room) return;
        if (room.phase !== 'selection') {
          send(ws, { type: 'error', message: '当前不在选船阶段' });
          return;
        }
        broadcastToRoom(playerInfo.room, msg, ws);
        break;
      }

      // ── 选船完成，开始游戏（仅房主） ──
      case 'startGameWithFleets': {
        if (!playerInfo) return;
        const room = rooms[playerInfo.room];
        if (!room) return;
        if (room.phase !== 'selection') {
          send(ws, { type: 'error', message: '当前不在选船阶段' });
          return;
        }
        if (playerInfo.playerIndex !== 0) {
          send(ws, { type: 'error', message: '仅房主可开始游戏' });
          return;
        }
        room.phase = 'playing';
        room.currentTurn = 0;
        room.turnNumber = 1;
        console.log(`[${playerInfo.room}] 游戏开始，轮到玩家 0`);
        broadcastToRoom(playerInfo.room, msg, ws);
        break;
      }

      // ── 游戏行动（仅当前回合方可发送） ──
      case 'action': {
        if (!playerInfo) return;
        const room = rooms[playerInfo.room];
        if (!room) return;

        if (room.phase !== 'playing') {
          console.log(`[${playerInfo.room}] 拒绝 action: 游戏未在进行中 (phase=${room.phase})`);
          send(ws, { type: 'actionRejected', reason: '游戏未在进行中' });
          return;
        }
        if (playerInfo.playerIndex !== room.currentTurn) {
          console.log(`[${playerInfo.room}] 拒绝 action: P${playerInfo.playerIndex} 尝试在 P${room.currentTurn} 的回合行动`);
          send(ws, {
            type: 'actionRejected',
            reason: '不是你的回合',
            currentTurn: room.currentTurn
          });
          return;
        }

        // 如果内部 action 是 endTurn，服务器权威处理回合切换
        if (msg.action && msg.action.type === 'endTurn') {
          const prevTurn = room.currentTurn;
          room.currentTurn = 1 - room.currentTurn;
          if (room.currentTurn === 0) room.turnNumber++;
          console.log(`[${playerInfo.room}] ✅ 回合切换(action): P${prevTurn} → P${room.currentTurn} (第 ${room.turnNumber} 回合)`);
          broadcastToAll(playerInfo.room, {
            type: 'turnSwitched',
            newTurn: room.currentTurn,
            turnNumber: room.turnNumber,
          });
          break;
        }

        // 合法行动，中继给对手
        broadcastToRoom(playerInfo.room, msg, ws);
        break;
      }

      // ── 主动结束回合（仅当前回合方） ──
      case 'endTurn': {
        if (!playerInfo) {
          console.log('[endTurn] 拒绝: playerInfo 为空');
          return;
        }
        const room = rooms[playerInfo.room];
        if (!room) {
          console.log('[endTurn] 拒绝: 房间不存在');
          return;
        }

        console.log(`[${playerInfo.room}] 收到 endTurn: 发送者=P${playerInfo.playerIndex}, 当前回合=P${room.currentTurn}, 阶段=${room.phase}`);

        if (room.phase !== 'playing') {
          console.log(`[${playerInfo.room}] 拒绝 endTurn: 游戏未在进行中 (phase=${room.phase})`);
          send(ws, { type: 'actionRejected', reason: '游戏未在进行中' });
          return;
        }
        if (playerInfo.playerIndex !== room.currentTurn) {
          console.log(`[${playerInfo.room}] 拒绝 endTurn: 不是发送者的回合`);
          send(ws, {
            type: 'actionRejected',
            reason: '不是你的回合',
            currentTurn: room.currentTurn
          });
          return;
        }

        const prevTurn = room.currentTurn;
        room.currentTurn = 1 - room.currentTurn;
        if (room.currentTurn === 0) room.turnNumber++;

        console.log(`[${playerInfo.room}] ✅ 回合切换: P${prevTurn} → P${room.currentTurn} (第 ${room.turnNumber} 回合), 正在广播 turnSwitched…`);

        const turnMsg = {
          type: 'turnSwitched',
          newTurn: room.currentTurn,
          turnNumber: room.turnNumber,
        };
        broadcastToAll(playerInfo.room, turnMsg);
        console.log(`[${playerInfo.room}] turnSwitched 已广播到 ${room.players.filter(p => p && p.readyState === 1).length} 个客户端`);
        break;
      }

      // ── 投降 ──
      case 'surrender': {
        if (!playerInfo) return;
        const room = rooms[playerInfo.room];
        if (!room) return;
        if (room.phase !== 'playing') return;

        room.phase = 'ended';
        broadcastToRoom(playerInfo.room, { type: 'opponentSurrendered' }, ws);
        console.log(`[${playerInfo.room}] 玩家 ${playerInfo.playerIndex} 投降`);
        break;
      }

      // ── 聊天 ──
      case 'chat': {
        if (!playerInfo) return;
        const room = rooms[playerInfo.room];
        if (!room) return;
        broadcastToRoom(playerInfo.room, { type: 'chat', text: msg.text }, ws);
        break;
      }

      // ── 心跳（应用层） ──
      case 'ping': {
        send(ws, { type: 'pong' });
        break;
      }

      case 'pong_check': {
        // 客户端对 ping_check 的响应，lastMessageTime 已在 on('message') 中更新
        break;
      }

      // ── 状态同步中继（断线重连后同步游戏状态） ──
      case 'requestStateSync':
      case 'stateSync': {
        if (!playerInfo) return;
        const room = rooms[playerInfo.room];
        if (!room) return;
        // 直接中继给对手
        broadcastToRoom(playerInfo.room, msg, ws);
        break;
      }

      // ── 重连加入 ──
      case 'rejoin': {
        const code = msg.room;
        const rejoinIdx = msg.playerIndex;
        const room = rooms[code];
        if (!room) {
          send(ws, { type: 'error', message: '房间已不存在，无法重连' });
          return;
        }
        if (rejoinIdx !== 0 && rejoinIdx !== 1) {
          send(ws, { type: 'error', message: '无效的玩家索引' });
          return;
        }
        // 检查该槽位是否为空（原玩家已断开）
        if (room.players[rejoinIdx]) {
          send(ws, { type: 'error', message: '该位置已被占用' });
          return;
        }
        // 重连成功：填充槽位，取消宽限期计时器
        room.players[rejoinIdx] = ws;
        playerInfo = { room: code, playerIndex: rejoinIdx };
        playerMap.set(ws, playerInfo);
        if (room.disconnectTimers && room.disconnectTimers[rejoinIdx]) {
          clearTimeout(room.disconnectTimers[rejoinIdx]);
          room.disconnectTimers[rejoinIdx] = null;
        }
        console.log(`[${code}] 玩家 ${rejoinIdx} 重连成功`);
        send(ws, { type: 'rejoined', room: code, playerIndex: rejoinIdx });
        // 通知对手：对手已重连
        const otherIdx = 1 - rejoinIdx;
        const other = room.players[otherIdx];
        send(other, { type: 'opponentRejoined' });
        break;
      }

      default:
        if (msgCount <= 5) console.log(`>>> 未知消息类型: type=${msg.type}`);
        break;
    }
    } catch (err) {
      console.log('>>> 消息处理异常:', err.message, err.stack && err.stack.slice(0, 200));
    }
  });

  // ── 断线处理（60秒宽限期，期内允许 rejoin） ──
  ws.on('close', () => {
    console.log('>>> 客户端断开连接');
    if (!playerInfo) return;

    const roomCode = playerInfo.room;
    const myIdx = playerInfo.playerIndex;
    const room = rooms[roomCode];
    if (!room) return;

    const otherIdx = 1 - myIdx;
    const other = room.players[otherIdx];

    if (!room.disconnectTimers) room.disconnectTimers = [null, null];

    // 清除该玩家的旧计时器（如有）
    if (room.disconnectTimers[myIdx]) clearTimeout(room.disconnectTimers[myIdx]);

    // 设置宽限期倒计时，期内允许 rejoin
    // 注意：捕获 roomCode 和 myIdx 而不是 playerInfo，因为 playerInfo 可能被重连覆盖
    room.disconnectTimers[myIdx] = setTimeout(() => {
      console.log(`[${roomCode}] 玩家 ${myIdx} 断线宽限期到期，清理房间`);
      const currentRoom = rooms[roomCode];
      if (!currentRoom) return; // 房间已被清理
      if (currentRoom.phase === 'playing') {
        const otherPlayer = currentRoom.players[1 - myIdx];
        send(otherPlayer, { type: 'opponentDisconnected' });
      }
      cleanupRoom(roomCode, '玩家断开连接超时');
    }, DISCONNECT_GRACE);

    // 通知对手：对方暂时断线（非永久）
    if (room.phase === 'playing' || room.phase === 'selection') {
      send(other, { type: 'opponentDisconnected', temporary: true });
    }

    playerMap.delete(ws);
    // 将该玩家的槽位清空，等待 rejoin 重新填入
    room.players[myIdx] = null;
  });

  ws.on('error', (err) => {
    console.log('>>> WebSocket 错误:', err.message);
  });
});

// ── 应用层心跳检测（每10秒） ──
// 使用应用层消息时间戳判断活跃度，避免协议级 ping/pong 被代理/负载均衡器干扰
const heartbeat = setInterval(() => {
  const now = Date.now();
  server.clients.forEach((ws) => {
    if (!ws.lastMessageTime) {
      ws.lastMessageTime = now;
      return;
    }
    const idle = now - ws.lastMessageTime;

    if (idle >= HEARTBEAT_DEAD) {
      // 40秒无任何消息，判定死亡
      console.log('客户端心跳超时（' + Math.round(idle / 1000) + '秒无消息），断开连接');
      ws.terminate();
      return;
    }

    if (idle >= HEARTBEAT_WARN) {
      // 25秒无消息，发送应用层 ping 探测
      send(ws, { type: 'ping_check' });
    }
  });
}, HEARTBEAT_INTERVAL);

server.on('close', () => clearInterval(heartbeat));

console.log('等待客户端连接…');
