// ═══════════════════════════════════════
//  Naval Chess — WebSocket 中继服务器
//  启动: node server.js
//  默认端口 3000
// ═══════════════════════════════════════

const WebSocket = require('ws');
const PORT = process.env.PORT || 3000;

const server = new WebSocket.Server({ port: PORT });
console.log(`Naval Chess 联机服务器已启动，端口 ${PORT}`);

// 房间管理
const rooms = {};

function createRoom() {
  const code = String(Math.floor(1000 + Math.random() * 9000));
  rooms[code] = { players: [], ready: false };
  return code;
}

function broadcast(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

server.on('connection', (ws) => {
  let playerRoom = null;
  let playerIndex = -1;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    switch (msg.type) {

      case 'create':
        playerRoom = createRoom();
        rooms[playerRoom].players.push(ws);
        playerIndex = 0;
        broadcast(ws, { type: 'roomCreated', room: playerRoom, playerIndex: 0 });
        console.log(`房间 ${playerRoom} 创建，等待对手…`);
        break;

      case 'join':
        playerRoom = msg.room;
        if (!rooms[playerRoom]) {
          broadcast(ws, { type: 'error', message: '房间不存在' });
          return;
        }
        if (rooms[playerRoom].players.length >= 2) {
          broadcast(ws, { type: 'error', message: '房间已满' });
          return;
        }
        rooms[playerRoom].players.push(ws);
        playerIndex = 1;
        broadcast(ws, { type: 'roomJoined', room: playerRoom, playerIndex: 1 });
        // 通知双方游戏开始
        const other = rooms[playerRoom].players[0];
        broadcast(other, { type: 'gameStart', room: playerRoom });
        broadcast(ws, { type: 'gameStart', room: playerRoom });
        console.log(`房间 ${playerRoom} 对手加入，游戏开始`);
        break;

      case 'action':
        if (playerRoom && rooms[playerRoom]) {
          const other = rooms[playerRoom].players[1 - playerIndex];
          if (other) broadcast(other, { type: 'action', action: msg.action });
        }
        break;

      case 'selectionData':
      case 'selectionUpdate':
      case 'selectionConfirmed':
      case 'startGameWithFleets':
        // 中继选船相关消息到对方
        if (playerRoom && rooms[playerRoom]) {
          const other = rooms[playerRoom].players[1 - playerIndex];
          if (other) broadcast(other, msg);
        }
        break;

      case 'surrender':
        // 投降通知对方
        if (playerRoom && rooms[playerRoom]) {
          const players = rooms[playerRoom].players;
          const other = players[1 - playerIndex];
          if (other) broadcast(other, { type: 'opponentSurrendered' });
        }
        break;

      case 'chat':
        if (playerRoom && rooms[playerRoom]) {
          const players = rooms[playerRoom].players;
          const other = players[1 - playerIndex];
          if (other) broadcast(other, { type: 'chat', text: msg.text });
        }
        break;
    }
  });

  ws.on('close', () => {
    if (playerRoom && rooms[playerRoom]) {
      const players = rooms[playerRoom].players;
      const other = players[1 - playerIndex];
      if (other) broadcast(other, { type: 'opponentDisconnected' });
      delete rooms[playerRoom];
      console.log(`房间 ${playerRoom} 关闭`);
    }
  });

  ws.on('error', () => {});
});

console.log('等待客户端连接…');
