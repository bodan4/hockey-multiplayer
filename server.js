const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const server = new WebSocket.Server({ port: 8080 });
console.log('✅ WebSocket server running on ws://localhost:8080');

let clients = {};
let inputs = {};
let scores = {};
let puck = { x: 400, y: 200, vx: 2, vy: 2 };

function initPlayer(id) {
  return { x: id.endsWith('1') ? 100 : 700, y: 200, speed: 4 };
}

function broadcast(data) {
  const message = JSON.stringify(data);
  for (const id in clients) {
    clients[id].send(message);
  }
}

function gameLoop() {
  // Move players
  for (const id in inputs) {
    const player = clients[id].player;
    const keys = inputs[id];

    if (keys.ArrowUp) player.y -= player.speed;
    if (keys.ArrowDown) player.y += player.speed;
    if (keys.ArrowLeft) player.x -= player.speed;
    if (keys.ArrowRight) player.x += player.speed;

    // Clamp position
    player.x = Math.max(0, Math.min(800, player.x));
    player.y = Math.max(0, Math.min(400, player.y));
  }

  // Move puck
  puck.x += puck.vx;
  puck.y += puck.vy;

  // Bounce off walls
  if (puck.y <= 0 || puck.y >= 400) puck.vy *= -1;

  // Bounce off players
  for (const id in clients) {
    const p = clients[id].player;
    const dx = puck.x - p.x;
    const dy = puck.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 25) {
      puck.vx *= -1;
      puck.vy *= -1;
    }
  }

  // Score
  if (puck.x <= 0 || puck.x >= 800) {
    const scorer = puck.x <= 0 ? 'right' : 'left';
    for (const id in clients) {
      const isLeft = clients[id].player.x < 400;
      if ((scorer === 'right' && isLeft) || (scorer === 'left' && !isLeft)) {
        scores[id] = (scores[id] || 0) + 1;
      }
    }
    puck = { x: 400, y: 200, vx: 2 * (Math.random() > 0.5 ? 1 : -1), vy: 2 };
  }

  // Send game state
  const state = {
    players: {},
    puck: puck,
    scores: scores
  };
  for (const id in clients) {
    state.players[id] = clients[id].player;
  }

  broadcast({ type: 'state', state });
}

server.on('connection', socket => {
  const id = uuidv4();
  clients[id] = socket;
  inputs[id] = {};
  scores[id] = 0;
  socket.player = initPlayer(id);

  console.log(`🟢 Player connected: ${id}`);
  socket.send(JSON.stringify({ type: 'init', id }));

  socket.on('message', message => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'input') {
        inputs[id] = data.keys;
      }
    } catch (err) {
      console.error('Invalid message:', err);
    }
  });

  socket.on('close', () => {
    console.log(`🔴 Player disconnected: ${id}`);
    delete clients[id];
    delete inputs[id];
    delete scores[id];
  });
});

setInterval(gameLoop, 1000 / 60);
