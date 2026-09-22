const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

// Game Constants
const TICK_RATE = 30;
const MAX_HEALTH = 100;
const RESPAWN_TIME = 3000;
const ASSIST_MIN_DAMAGE = 40;
const TEAM_SIZE = 4;
const BOT_RADIUS = 0.55;

const MAP_BOXES = [
  // Outer Perimeter Walls
  { x: 0, y: 3, z: -35, w: 70, h: 6, d: 2, type: 'wall', color: 0x475569 },
  { x: 0, y: 3, z: 35, w: 70, h: 6, d: 2, type: 'wall', color: 0x475569 },
  { x: -35, y: 3, z: 0, w: 2, h: 6, d: 70, type: 'wall', color: 0x475569 },
  { x: 35, y: 3, z: 0, w: 2, h: 6, d: 70, type: 'wall', color: 0x475569 },

  // RED HQ BASE
  { x: 0, y: 0.1, z: -28, w: 26, h: 0.2, d: 12, type: 'base_red_floor', color: 0xef4444 },
  { x: -13, y: 2.5, z: -28, w: 1, h: 5, d: 12, type: 'spawn_wall_red' },
  { x: 13, y: 2.5, z: -28, w: 1, h: 5, d: 12, type: 'spawn_wall_red' },
  { x: 0, y: 5.1, z: -28, w: 26, h: 0.5, d: 12, type: 'spawn_wall_red' },
  { x: 0, y: 2.5, z: -22, w: 26, h: 5, d: 1.2, type: 'one_way_wall_red' },
  { x: -24, y: 2.5, z: -28, w: 22, h: 5, d: 12, type: 'spawn_wall_red' },
  { x: 24, y: 2.5, z: -28, w: 22, h: 5, d: 12, type: 'spawn_wall_red' },

  // BLUE HQ BASE
  { x: 0, y: 0.1, z: 28, w: 26, h: 0.2, d: 12, type: 'base_blue_floor', color: 0x3b82f6 },
  { x: -13, y: 2.5, z: 28, w: 1, h: 5, d: 12, type: 'spawn_wall_blue' },
  { x: 13, y: 2.5, z: 28, w: 1, h: 5, d: 12, type: 'spawn_wall_blue' },
  { x: 0, y: 5.1, z: 28, w: 26, h: 0.5, d: 12, type: 'spawn_wall_blue' },
  { x: 0, y: 2.5, z: 22, w: 26, h: 5, d: 1.2, type: 'one_way_wall_blue' },
  { x: -24, y: 2.5, z: 28, w: 22, h: 5, d: 12, type: 'spawn_wall_blue' },
  { x: 24, y: 2.5, z: 28, w: 22, h: 5, d: 12, type: 'spawn_wall_blue' },

  // Center Wooden Crates & Obstacles
  { x: 0, y: 1.5, z: 0, w: 4, h: 3, d: 4, type: 'wood' },
  { x: -8, y: 1.25, z: -6, w: 3, h: 2.5, d: 5, type: 'wood' },
  { x: 8, y: 1.25, z: 6, w: 3, h: 2.5, d: 5, type: 'wood' },
  { x: -10, y: 1.25, z: 8, w: 5, h: 2.5, d: 3, type: 'wood' },
  { x: 10, y: 1.25, z: -8, w: 5, h: 2.5, d: 3, type: 'wood' },

  // Red Side Covers
  { x: -16, y: 1.5, z: -14, w: 5, h: 3, d: 3, type: 'wood' },
  { x: 16, y: 1.5, z: -14, w: 5, h: 3, d: 3, type: 'wood' },
  { x: -5, y: 1, z: -16, w: 3, h: 2, d: 3, type: 'wood' },
  { x: 5, y: 1, z: -16, w: 3, h: 2, d: 3, type: 'wood' },

  // Blue Side Covers
  { x: -16, y: 1.5, z: 14, w: 5, h: 3, d: 3, type: 'wood' },
  { x: 16, y: 1.5, z: 14, w: 5, h: 3, d: 3, type: 'wood' },
  { x: -5, y: 1, z: 16, w: 3, h: 2, d: 3, type: 'wood' },
  { x: 5, y: 1, z: 16, w: 3, h: 2, d: 3, type: 'wood' },

  // Flank Pillars
  { x: -22, y: 2.5, z: 0, w: 4, h: 5, d: 4, type: 'wood' },
  { x: 22, y: 2.5, z: 0, w: 4, h: 5, d: 4, type: 'wood' }
];

const SPAWNS = {
  red: [
    { x: -7.5, y: 0, z: -27.5, yaw: 0 },
    { x: -2.5, y: 0, z: -29.0, yaw: 0 },
    { x: 2.5, y: 0, z: -29.0, yaw: 0 },
    { x: 7.5, y: 0, z: -27.5, yaw: 0 }
  ],
  blue: [
    { x: -7.5, y: 0, z: 27.5, yaw: Math.PI },
    { x: -2.5, y: 0, z: 29.0, yaw: Math.PI },
    { x: 2.5, y: 0, z: 29.0, yaw: Math.PI },
    { x: 7.5, y: 0, z: 27.5, yaw: Math.PI }
  ]
};

const MAP_WAYPOINTS = [
  { x: 0, z: 0 },
  { x: -12, z: -8 },
  { x: 12, z: -8 },
  { x: -12, z: 8 },
  { x: 12, z: 8 },
  { x: -18, z: 0 },
  { x: 18, z: 0 },
  { x: -6, z: -12 },
  { x: 6, z: -12 },
  { x: -6, z: 12 },
  { x: 6, z: 12 },
  { x: 0, z: -8 },
  { x: 0, z: 8 }
];

const BOT_NAMES = {
  red: ['Bot_Alpha', 'Bot_Viper', 'Bot_Bravo', 'Bot_Ghost'],
  blue: ['Bot_Specter', 'Bot_Titan', 'Bot_Raven', 'Bot_Delta']
};

// Rooms Management
const rooms = new Map();
let nextPlayerId = 1000;

function createCustomRoom(roomId, masterId, options = {}) {
  const rId = (roomId || 'ROOM_' + Math.floor(Math.random() * 900 + 100)).trim().toUpperCase().substring(0, 12);
  const room = {
    id: rId,
    masterId: masterId,
    noBot: !!options.noBot,
    winTarget: [40, 60, 80, 100].includes(Number(options.winTarget)) ? Number(options.winTarget) : 40,
    state: 'lobby', // 'lobby' | 'playing' | 'ended'
    winnerTeam: null,
    players: new Map(),
    damageHistory: new Map(),
    scores: { red: 0, blue: 0 }
  };
  rooms.set(rId, room);
  return room;
}

function getRoomListPayload() {
  const list = [];
  rooms.forEach(r => {
    let redCount = 0;
    let blueCount = 0;
    r.players.forEach(p => {
      if (!p.isBot) {
        if (p.team === 'red') redCount++;
        else if (p.team === 'blue') blueCount++;
      }
    });
    const totalHumans = redCount + blueCount;
    list.push({
      id: r.id,
      masterId: r.masterId,
      noBot: !!r.noBot,
      winTarget: r.winTarget || 40,
      state: r.state,
      redCount,
      blueCount,
      totalHumans,
      maxHumans: 8,
      isFull: totalHumans >= 8
    });
  });
  return list;
}

function broadcastGlobalRoomList() {
  const payload = JSON.stringify({
    type: 'room_list',
    rooms: getRoomListPayload()
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function getSpawnPoint(team, index = 0) {
  const spawnList = SPAWNS[team] || SPAWNS.red;
  return { ...spawnList[index % spawnList.length] };
}

function broadcastToRoom(room, data, excludeWs = null) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN && client.roomId === room.id) {
      client.send(msg);
    }
  }
}

function checkBotObstacleCollision(newX, newZ) {
  for (const b of MAP_BOXES) {
    if (b.type === 'base_red_floor' || b.type === 'base_blue_floor') continue;
    if (b.type === 'one_way_wall_red' || b.type === 'one_way_wall_blue') continue;

    const minX = b.x - b.w / 2 - BOT_RADIUS;
    const maxX = b.x + b.w / 2 + BOT_RADIUS;
    const minZ = b.z - b.d / 2 - BOT_RADIUS;
    const maxZ = b.z + b.d / 2 + BOT_RADIUS;

    if (newX > minX && newX < maxX && newZ > minZ && newZ < maxZ) {
      return true;
    }
  }
  return false;
}

function lineOfSightClear(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 0.001) return true;

  const dirX = dx / dist;
  const dirY = dy / dist;
  const dirZ = dz / dist;

  for (const b of MAP_BOXES) {
    if (b.type === 'base_red_floor' || b.type === 'base_blue_floor') continue;

    const minX = b.x - b.w / 2;
    const maxX = b.x + b.w / 2;
    const minY = b.y - b.h / 2;
    const maxY = b.y + b.h / 2;
    const minZ = b.z - b.d / 2;
    const maxZ = b.z + b.d / 2;

    let tmin = (minX - from.x) / (dirX || 0.00001);
    let tmax = (maxX - from.x) / (dirX || 0.00001);
    if (tmin > tmax) [tmin, tmax] = [tmax, tmin];

    let tymin = (minY - from.y) / (dirY || 0.00001);
    let tymax = (maxY - from.y) / (dirY || 0.00001);
    if (tymin > tymax) [tymin, tymax] = [tymax, tymin];

    if (tmin > tymax || tymin > tmax) continue;
    if (tymin > tmin) tmin = tymin;
    if (tymax < tmax) tmax = tymax;

    let tzmin = (minZ - from.z) / (dirZ || 0.00001);
    let tzmax = (maxZ - from.z) / (dirZ || 0.00001);
    if (tzmin > tzmax) [tzmin, tzmax] = [tzmax, tzmin];

    if (tmin > tzmax || tzmin > tmax) continue;
    if (tzmin > tmin) tmin = tzmin;
    if (tzmax < tmax) tmax = tzmax;

    if (tmax > 0.3 && tmin < dist - 0.3) {
      return false;
    }
  }
  return true;
}

// Balance Bots per Room (Strictly 0 bots if noBot is true)
function balanceBotsForRoom(room) {
  if (room.noBot || room.state !== 'playing') {
    const botIds = [];
    room.players.forEach((p, id) => {
      if (p.isBot) botIds.push(id);
    });
    botIds.forEach(id => {
      room.players.delete(id);
      room.damageHistory.delete(id);
    });
    broadcastToRoom(room, {
      type: 'sync',
      players: Array.from(room.players.values())
    });
    return;
  }

  const teams = ['red', 'blue'];

  teams.forEach(team => {
    const humanPlayers = [];
    room.players.forEach(p => {
      if (p.team === team && !p.isBot) humanPlayers.push(p);
    });

    const humanCount = humanPlayers.length;
    const neededBots = Math.max(0, TEAM_SIZE - humanCount);

    for (let slot = 0; slot < TEAM_SIZE; slot++) {
      const fixedBotId = `bot_${room.id}_${team}_slot_${slot}`;

      if (slot >= humanCount && slot < (humanCount + neededBots)) {
        if (!room.players.has(fixedBotId)) {
          const botName = BOT_NAMES[team][slot % BOT_NAMES[team].length];
          const sp = getSpawnPoint(team, slot);

          const botPlayer = {
            id: fixedBotId,
            username: `[BOT] ${botName}`,
            team,
            health: MAX_HEALTH,
            x: sp.x,
            y: 0,
            z: sp.z,
            yaw: sp.yaw,
            pitch: 0,
            kills: 0,
            deaths: 0,
            assists: 0,
            isCrouched: false,
            isMoving: false,
            isDead: false,
            isBot: true,
            canMoveAfter: Date.now() + 3200,
            lastShootTime: 0,
            currentWaypointIdx: slot % MAP_WAYPOINTS.length,
            nextWaypointChange: Date.now() + 5000 + Math.random() * 3000,
            wasdState: { forward: 1, strafe: 0, duration: 1500, nextChange: Date.now() + 4500 }
          };

          room.players.set(fixedBotId, botPlayer);
          room.damageHistory.set(fixedBotId, new Map());
        }
      } else {
        if (room.players.has(fixedBotId)) {
          room.players.delete(fixedBotId);
          room.damageHistory.delete(fixedBotId);
        }
      }
    }
  });

  broadcastToRoom(room, {
    type: 'sync',
    players: Array.from(room.players.values())
  });
}

const BOT_BASE_SPEED = 9.0 * 0.08;

function stepBotWithWASD(bot, forwardDir, strafeDir, speedFactor = 0.45) {
  const fX = Math.sin(bot.yaw) * forwardDir;
  const fZ = Math.cos(bot.yaw) * forwardDir;

  const sYaw = bot.yaw + Math.PI / 2;
  const sX = Math.sin(sYaw) * strafeDir;
  const sZ = Math.cos(sYaw) * strafeDir;

  let totalX = (fX + sX) * BOT_BASE_SPEED * speedFactor;
  let totalZ = (fZ + sZ) * BOT_BASE_SPEED * speedFactor;

  let moved = false;

  if (!checkBotObstacleCollision(bot.x + totalX, bot.z + totalZ)) {
    bot.x += totalX;
    bot.z += totalZ;
    moved = true;
  } else {
    if (!checkBotObstacleCollision(bot.x + totalX, bot.z)) {
      bot.x += totalX;
      moved = true;
    }
    if (!checkBotObstacleCollision(bot.x, bot.z + totalZ)) {
      bot.z += totalZ;
      moved = true;
    }
  }

  if (!moved) {
    bot.yaw += (Math.random() > 0.5 ? 1 : -1) * 0.8;
  }

  bot.isMoving = moved;
}

// Bot AI Loop (Only in rooms where state is 'playing' & noBot is false)
setInterval(() => {
  const now = Date.now();

  rooms.forEach(room => {
    if (room.noBot || room.state !== 'playing') return;

    room.players.forEach(bot => {
      if (!bot.isBot || bot.isDead) return;

      if (bot.canMoveAfter && now < bot.canMoveAfter) {
        bot.isMoving = false;
        return;
      }

      bot.y = 0;
      const isInsideSpawn = (p) => (p.team === 'red' && p.z < -20.5) || (p.team === 'blue' && p.z > 20.5);

      if (isInsideSpawn(bot)) {
        bot.yaw = bot.team === 'red' ? 0 : Math.PI;
        const outSpeed = BOT_BASE_SPEED * 0.7;
        if (bot.team === 'red') {
          bot.z += outSpeed;
        } else {
          bot.z -= outSpeed;
        }
        bot.isMoving = true;
        return;
      }

      let nearestEnemy = null;
      let minDist = Infinity;

      room.players.forEach(p => {
        if (p.team !== bot.team && !p.isDead && !isInsideSpawn(p)) {
          const dx = p.x - bot.x;
          const dz = p.z - bot.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist < minDist && dist < 45) {
            const botEye = { x: bot.x, y: 1.4, z: bot.z };
            const enemyEye = { x: p.x, y: 1.4, z: p.z };
            if (lineOfSightClear(botEye, enemyEye)) {
              minDist = dist;
              nearestEnemy = p;
            }
          }
        }
      });

      if (nearestEnemy) {
        const dx = nearestEnemy.x - bot.x;
        const dz = nearestEnemy.z - bot.z;
        const dy = (nearestEnemy.y + 1.4) - (bot.y + 1.4);
        const dist = Math.sqrt(dx * dx + dz * dz);

        const targetAimYaw = Math.atan2(dx, dz);
        let angleDiff = targetAimYaw - bot.yaw;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        bot.yaw += angleDiff * 0.45 + (Math.random() - 0.5) * 0.03;
        bot.pitch = -Math.atan2(dy, dist) * 0.5;

        if (now > bot.wasdState.nextChange) {
          let f = dist > 12 ? 1 : (dist < 6 ? -1 : (Math.random() > 0.4 ? 1 : 0));
          let s = Math.random() > 0.5 ? 1 : -1;
          bot.wasdState = {
            forward: f,
            strafe: s,
            nextChange: now + 800 + Math.random() * 1000
          };
        }

        stepBotWithWASD(bot, bot.wasdState.forward, bot.wasdState.strafe, 0.4);

        if (now - bot.lastShootTime > (520 + Math.random() * 380)) {
          bot.lastShootTime = now;

          const botEye = { x: bot.x, y: 1.4, z: bot.z };
          const enemyEye = { x: nearestEnemy.x, y: 1.4, z: nearestEnemy.z };

          if (lineOfSightClear(botEye, enemyEye)) {
            // Broadcast bullet tracer animation from bot's weapon to enemy
            const spread = 0.05;
            const dirX = (enemyEye.x - botEye.x) + (Math.random() - 0.5) * spread * dist;
            const dirY = (enemyEye.y - botEye.y) + (Math.random() - 0.5) * spread * 2;
            const dirZ = (enemyEye.z - botEye.z) + (Math.random() - 0.5) * spread * dist;
            const len = Math.hypot(dirX, dirY, dirZ) || 1;

            broadcastToRoom(room, {
              type: 'bullet_tracer',
              shooterId: bot.id,
              origin: { x: bot.x, y: 1.25, z: bot.z },
              direction: { x: dirX / len, y: dirY / len, z: dirZ / len }
            });

            if (Math.random() < 0.15) {
            const isHeadshot = Math.random() < 0.015;
            const part = isHeadshot ? 'head' : (Math.random() < 0.85 ? 'body' : 'leg');
            let damage = isHeadshot ? 80 : (part === 'body' ? 25 : 20);

            nearestEnemy.health = Math.max(0, nearestEnemy.health - damage);

            if (!room.damageHistory.has(nearestEnemy.id)) room.damageHistory.set(nearestEnemy.id, new Map());
            const targetDmgMap = room.damageHistory.get(nearestEnemy.id);
            targetDmgMap.set(bot.id, (targetDmgMap.get(bot.id) || 0) + damage);

            broadcastToRoom(room, {
              type: 'health_update',
              id: nearestEnemy.id,
              health: nearestEnemy.health,
              attackerId: bot.id
            });

            if (nearestEnemy.health <= 0) {
              nearestEnemy.isDead = true;
              nearestEnemy.deaths++;
              bot.kills++;
              room.scores[bot.team]++;

              let assister = null;
              let maxAssistDmg = 0;
              targetDmgMap.forEach((dmgDealt, attackerId) => {
                if (attackerId !== bot.id && dmgDealt >= ASSIST_MIN_DAMAGE) {
                  const helper = room.players.get(attackerId);
                  if (helper && helper.team === bot.team && dmgDealt > maxAssistDmg) {
                    assister = helper;
                    maxAssistDmg = dmgDealt;
                  }
                }
              });

              if (assister) assister.assists++;
              targetDmgMap.clear();

              if (room.scores[bot.team] >= room.winTarget && room.state === 'playing') {
                room.state = 'ended';
                room.winnerTeam = bot.team;
                broadcastToRoom(room, {
                  type: 'match_win',
                  winnerTeam: bot.team,
                  scores: room.scores,
                  winTarget: room.winTarget
                });
                broadcastGlobalRoomList();
              }

              broadcastToRoom(room, {
                type: 'kill_log',
                killerId: bot.id,
                killerName: bot.username,
                killerTeam: bot.team,
                victimId: nearestEnemy.id,
                victimName: nearestEnemy.username,
                victimTeam: nearestEnemy.team,
                assisterId: assister ? assister.id : null,
                assisterName: assister ? assister.username : null,
                isHeadshot,
                scores: room.scores,
                players: Array.from(room.players.values())
              });

              setTimeout(() => {
                if (room.players.has(nearestEnemy.id) && room.state === 'playing') {
                  let respawnX, respawnZ, respawnYaw;
                  if (nearestEnemy.isBot) {
                    const sp = getSpawnPoint(nearestEnemy.team, 2);
                    respawnX = sp.x;
                    respawnZ = sp.z;
                    respawnYaw = sp.yaw;
                    nearestEnemy.canMoveAfter = Date.now() + 1000;
                  } else {
                    const sp = getSpawnPoint(nearestEnemy.team, 0);
                    respawnX = sp.x;
                    respawnZ = sp.z;
                    respawnYaw = sp.yaw;
                  }

                  nearestEnemy.health = MAX_HEALTH;
                  nearestEnemy.x = respawnX;
                  nearestEnemy.y = 0;
                  nearestEnemy.z = respawnZ;
                  nearestEnemy.yaw = respawnYaw;
                  nearestEnemy.isDead = false;

                  broadcastToRoom(room, {
                    type: 'player_respawn',
                    player: nearestEnemy
                  });
                }
              }, RESPAWN_TIME);
            }
          }
          }
        }
      } else {
        if (now > bot.nextWaypointChange) {
          bot.currentWaypointIdx = Math.floor(Math.random() * MAP_WAYPOINTS.length);
          bot.nextWaypointChange = now + 4000 + Math.random() * 3500;
        }

        const wp = MAP_WAYPOINTS[bot.currentWaypointIdx];
        const dx = wp.x - bot.x;
        const dz = wp.z - bot.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 1.5) {
          const targetYaw = Math.atan2(dx, dz);
          let angleDiff = targetYaw - bot.yaw;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          bot.yaw += angleDiff * 0.4;

          stepBotWithWASD(bot, 1, 0, 0.45);
        } else {
          bot.isMoving = false;
          bot.currentWaypointIdx = Math.floor(Math.random() * MAP_WAYPOINTS.length);
        }
      }

      bot.x = Math.max(-32, Math.min(32, bot.x));
      bot.z = Math.max(-21, Math.min(21, bot.z));
    });
  });
}, 80);

wss.on('connection', (ws) => {
  const id = 'player_' + (nextPlayerId++);
  let player = null;
  let currentRoom = null;

  // Send global room list on connect
  ws.send(JSON.stringify({
    type: 'room_list',
    rooms: getRoomListPayload()
  }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);

      if (msg.type === 'get_rooms') {
        ws.send(JSON.stringify({
          type: 'room_list',
          rooms: getRoomListPayload()
        }));
      }

      // 1. CREATE CUSTOM ROOM
      if (msg.type === 'create_room') {
        const username = (msg.username || 'Host_' + id).trim().substring(0, 15);
        const roomId = (msg.roomId || 'ROOM_' + Math.floor(Math.random() * 900 + 100)).trim().toUpperCase().substring(0, 12);

        if (rooms.has(roomId)) {
          ws.send(JSON.stringify({
            type: 'error',
            message: `Room [${roomId}] sudah ada! Silakan gunakan nama Room lain atau Join room tersebut.`
          }));
          return;
        }

        currentRoom = createCustomRoom(roomId, id, {
          noBot: false,
          winTarget: 40
        });
        ws.roomId = currentRoom.id;

        player = {
          id,
          username,
          team: 'red',
          health: MAX_HEALTH,
          x: 0, y: 0, z: 0,
          yaw: 0, pitch: 0,
          kills: 0, deaths: 0, assists: 0,
          isCrouched: false, isMoving: false, isDead: false, isBot: false
        };

        currentRoom.players.set(id, player);
        currentRoom.damageHistory.set(id, new Map());

        ws.send(JSON.stringify({
          type: 'room_lobby_update',
          selfId: id,
          room: {
            id: currentRoom.id,
            masterId: currentRoom.masterId,
            isMaster: true,
            noBot: currentRoom.noBot,
            winTarget: currentRoom.winTarget,
            state: currentRoom.state,
            players: Array.from(currentRoom.players.values())
          }
        }));

        broadcastGlobalRoomList();
      }

      // 2. JOIN EXISTING ROOM
      if (msg.type === 'join_room') {
        const username = (msg.username || 'Player_' + id).trim().substring(0, 15);
        const roomId = (msg.roomId || '').trim().toUpperCase();

        if (!rooms.has(roomId)) {
          ws.send(JSON.stringify({
            type: 'error',
            message: `Room [${roomId}] tidak ditemukan! Silakan buat room baru.`
          }));
          return;
        }

        currentRoom = rooms.get(roomId);

        let humanCount = 0;
        currentRoom.players.forEach(p => { if (!p.isBot) humanCount++; });

        if (humanCount >= 8) {
          ws.send(JSON.stringify({
            type: 'error',
            message: `Room [${roomId}] sudah penuh (Max 8 pemain)!`
          }));
          return;
        }

        let redCount = 0, blueCount = 0;
        currentRoom.players.forEach(p => {
          if (!p.isBot) {
            if (p.team === 'red') redCount++;
            else blueCount++;
          }
        });
        const assignedTeam = redCount <= blueCount ? 'red' : 'blue';

        ws.roomId = currentRoom.id;

        player = {
          id,
          username,
          team: assignedTeam,
          health: MAX_HEALTH,
          x: 0, y: 0, z: 0,
          yaw: 0, pitch: 0,
          kills: 0, deaths: 0, assists: 0,
          isCrouched: false, isMoving: false, isDead: false, isBot: false
        };

        currentRoom.players.set(id, player);
        currentRoom.damageHistory.set(id, new Map());

        if (currentRoom.state === 'playing') {
          const spawn = getSpawnPoint(player.team, humanCount);
          player.x = spawn.x;
          player.y = 0;
          player.z = spawn.z;
          player.yaw = spawn.yaw;

          balanceBotsForRoom(currentRoom);

          ws.send(JSON.stringify({
            type: 'init',
            selfId: id,
            player,
            players: Array.from(currentRoom.players.values()),
            boxes: MAP_BOXES,
            scores: currentRoom.scores,
            roomId: currentRoom.id,
            noBot: currentRoom.noBot,
            winTarget: currentRoom.winTarget
          }));

          broadcastToRoom(currentRoom, {
            type: 'feed',
            text: `${player.username} bergabung ke Tim ${player.team.toUpperCase()} (Room: ${currentRoom.id})`
          });
        } else {
          // Send lobby update to self and room members
          for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN && client.roomId === currentRoom.id) {
              client.send(JSON.stringify({
                type: 'room_lobby_update',
                selfId: client === ws ? id : undefined,
                room: {
                  id: currentRoom.id,
                  masterId: currentRoom.masterId,
                  noBot: currentRoom.noBot,
                  winTarget: currentRoom.winTarget,
                  state: currentRoom.state,
                  players: Array.from(currentRoom.players.values())
                }
              }));
            }
          }
        }

        broadcastGlobalRoomList();
      }

      // 3. CHANGE TEAM IN CUSTOM ROOM LOBBY
      if (msg.type === 'switch_team') {
        if (currentRoom && currentRoom.state === 'lobby' && player) {
          const targetTeam = msg.team === 'blue' ? 'blue' : 'red';
          let countOnTarget = 0;
          currentRoom.players.forEach(p => {
            if (!p.isBot && p.team === targetTeam && p.id !== player.id) countOnTarget++;
          });

          if (countOnTarget < 4) {
            player.team = targetTeam;
            broadcastToRoom(currentRoom, {
              type: 'room_lobby_update',
              room: {
                id: currentRoom.id,
                masterId: currentRoom.masterId,
                noBot: currentRoom.noBot,
                winTarget: currentRoom.winTarget,
                state: currentRoom.state,
                players: Array.from(currentRoom.players.values())
              }
            });
          }
        }
      }

      // 4. UPDATE ROOM SETTINGS (ROOM MASTER ONLY)
      if (msg.type === 'update_room_settings') {
        if (currentRoom && currentRoom.state === 'lobby') {
          // Verify if sender is master
          if (currentRoom.masterId === id) {
            if (msg.hasOwnProperty('noBot')) currentRoom.noBot = Boolean(msg.noBot);
            if (msg.hasOwnProperty('winTarget')) {
              const wt = Number(msg.winTarget);
              if ([40, 60, 80, 100].includes(wt)) currentRoom.winTarget = wt;
            }

            broadcastToRoom(currentRoom, {
              type: 'room_lobby_update',
              room: {
                id: currentRoom.id,
                masterId: currentRoom.masterId,
                noBot: currentRoom.noBot,
                winTarget: currentRoom.winTarget,
                state: currentRoom.state,
                players: Array.from(currentRoom.players.values())
              }
            });
            broadcastGlobalRoomList();
          }
        }
      }

      // 5. START MATCH (ROOM MASTER ONLY)
      if (msg.type === 'start_match') {
        if (currentRoom && currentRoom.state === 'lobby') {
          if (currentRoom.masterId === id) {
            currentRoom.state = 'playing';
            currentRoom.scores = { red: 0, blue: 0 };
            currentRoom.isMatchOver = false;

            let redSlot = 0, blueSlot = 0;
            currentRoom.players.forEach(p => {
              if (!p.isBot) {
                const slotIdx = p.team === 'red' ? (redSlot++) : (blueSlot++);
                const sp = getSpawnPoint(p.team, slotIdx);
                p.x = sp.x;
                p.y = 0;
                p.z = sp.z;
                p.yaw = sp.yaw;
                p.health = MAX_HEALTH;
                p.isDead = false;
                p.kills = 0;
                p.deaths = 0;
                p.assists = 0;
              }
            });

            balanceBotsForRoom(currentRoom);

            for (const client of wss.clients) {
              if (client.readyState === WebSocket.OPEN && client.roomId === currentRoom.id) {
                client.send(JSON.stringify({
                  type: 'match_started',
                  room: {
                    id: currentRoom.id,
                    noBot: currentRoom.noBot,
                    winTarget: currentRoom.winTarget,
                    scores: currentRoom.scores
                  },
                  boxes: MAP_BOXES,
                  players: Array.from(currentRoom.players.values())
                }));
              }
            }

            broadcastGlobalRoomList();
          }
        }
      }

      if (!player || player.isDead || !currentRoom || currentRoom.state !== 'playing') return;

      if (msg.type === 'move') {
        player.x = msg.x;
        player.y = msg.y;
        player.z = msg.z;
        player.yaw = msg.yaw;
        player.pitch = msg.pitch;
        player.isCrouched = !!msg.isCrouched;
        player.isMoving = !!msg.isMoving;
        player.isSprinting = !!msg.isSprinting;
      }

      if (msg.type === 'shoot') {
        broadcastToRoom(currentRoom, {
          type: 'bullet_tracer',
          shooterId: player.id,
          origin: msg.origin,
          direction: msg.direction
        }, ws);
      }

      if (msg.type === 'hit') {
        const targetId = msg.targetId;
        const part = msg.part;
        const target = currentRoom.players.get(targetId);

        if (target && !target.isDead && target.team !== player.team && currentRoom.state === 'playing') {
          const shooterEye = { x: player.x, y: (player.y || 0) + 1.4, z: player.z };
          const targetPos = { x: target.x, y: (target.y || 0) + 1.4, z: target.z };

          if (lineOfSightClear(shooterEye, targetPos)) {
            let damage = 25;
            if (part === 'head') damage = 80;
            else if (part === 'leg') damage = 20;

            target.health = Math.max(0, target.health - damage);

            if (!currentRoom.damageHistory.has(targetId)) currentRoom.damageHistory.set(targetId, new Map());
            const targetDmgMap = currentRoom.damageHistory.get(targetId);
            const currentDmg = targetDmgMap.get(player.id) || 0;
            targetDmgMap.set(player.id, currentDmg + damage);

            ws.send(JSON.stringify({
              type: 'hit_feedback',
              damage,
              part,
              targetId
            }));

            broadcastToRoom(currentRoom, {
              type: 'health_update',
              id: target.id,
              health: target.health,
              attackerId: player.id
            });

            if (target.health <= 0) {
              target.isDead = true;
              target.deaths++;
              player.kills++;
              currentRoom.scores[player.team]++;

              let assister = null;
              let maxAssistDmg = 0;
              targetDmgMap.forEach((dmgDealt, attackerId) => {
                if (attackerId !== player.id && dmgDealt >= ASSIST_MIN_DAMAGE) {
                  const helper = currentRoom.players.get(attackerId);
                  if (helper && helper.team === player.team && dmgDealt > maxAssistDmg) {
                    assister = helper;
                    maxAssistDmg = dmgDealt;
                  }
                }
              });

              if (assister) assister.assists++;
              targetDmgMap.clear();

              if (currentRoom.scores[player.team] >= currentRoom.winTarget && currentRoom.state === 'playing') {
                currentRoom.state = 'ended';
                currentRoom.winnerTeam = player.team;
                broadcastToRoom(currentRoom, {
                  type: 'match_win',
                  winnerTeam: player.team,
                  scores: currentRoom.scores,
                  winTarget: currentRoom.winTarget
                });
                broadcastGlobalRoomList();
              }

              broadcastToRoom(currentRoom, {
                type: 'kill_log',
                killerId: player.id,
                killerName: player.username,
                killerTeam: player.team,
                victimId: target.id,
                victimName: target.username,
                victimTeam: target.team,
                assisterId: assister ? assister.id : null,
                assisterName: assister ? assister.username : null,
                isHeadshot: part === 'head',
                scores: currentRoom.scores,
                players: Array.from(currentRoom.players.values())
              });

              setTimeout(() => {
                if (currentRoom && currentRoom.players.has(target.id) && currentRoom.state === 'playing') {
                  let respawnX, respawnZ, respawnYaw;
                  if (target.isBot) {
                    const sp = getSpawnPoint(target.team, 2);
                    respawnX = sp.x;
                    respawnZ = sp.z;
                    respawnYaw = sp.yaw;
                    target.canMoveAfter = Date.now() + 1000;
                  } else {
                    const sp = getSpawnPoint(target.team, 0);
                    respawnX = sp.x;
                    respawnZ = sp.z;
                    respawnYaw = sp.yaw;
                  }

                  target.health = MAX_HEALTH;
                  target.x = respawnX;
                  target.y = 0;
                  target.z = respawnZ;
                  target.yaw = respawnYaw;
                  target.isDead = false;

                  broadcastToRoom(currentRoom, {
                    type: 'player_respawn',
                    player: target
                  });
                }
              }, RESPAWN_TIME);
            }
          }
        }
      }
    } catch (e) {
      console.error('WS Error:', e);
    }
  });

  ws.on('close', () => {
    if (player && currentRoom) {
      currentRoom.players.delete(player.id);
      currentRoom.damageHistory.delete(player.id);

      broadcastToRoom(currentRoom, {
        type: 'feed',
        text: `${player.username} meninggalkan game`
      });

      if (currentRoom.masterId === player.id) {
        let nextMaster = null;
        for (const p of currentRoom.players.values()) {
          if (!p.isBot) {
            nextMaster = p;
            break;
          }
        }
        if (nextMaster) {
          currentRoom.masterId = nextMaster.id;
          broadcastToRoom(currentRoom, {
            type: 'feed',
            text: `[ROOM MASTER] dialihkan ke ${nextMaster.username}`
          });
        }
      }

      if (currentRoom.state === 'lobby') {
        broadcastToRoom(currentRoom, {
          type: 'room_lobby_update',
          room: {
            id: currentRoom.id,
            masterId: currentRoom.masterId,
            noBot: currentRoom.noBot,
            winTarget: currentRoom.winTarget,
            state: currentRoom.state,
            players: Array.from(currentRoom.players.values())
          }
        });
      } else {
        balanceBotsForRoom(currentRoom);
      }

      let humanRemaining = 0;
      currentRoom.players.forEach(p => { if (!p.isBot) humanRemaining++; });
      if (humanRemaining === 0) {
        rooms.delete(currentRoom.id);
      }

      broadcastGlobalRoomList();
    }
  });
});

setInterval(() => {
  rooms.forEach(room => {
    if (room.state === 'playing' && room.players.size > 0) {
      broadcastToRoom(room, {
        type: 'sync',
        players: Array.from(room.players.values())
      });
    }
  });
}, 1000 / TICK_RATE);

const os = require('os');
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
        break;
      }
    }
  }
  console.log(`\n========================================================`);
  console.log(`🎮 FPS Game Server 'Wardogs KW' AKTIF!`);
  console.log(`💻 Main di PC ini  : http://localhost:${PORT}`);
  console.log(`🌐 Main via LAN/WiFi: http://${localIP}:${PORT}`);
  console.log(`========================================================\n`);
});
