import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import prisma, { connectWithRetry } from './utils/prisma';

dotenv.config();

import apiRouter from './routes/api';
import { roomStore, playerDisconnectTimeouts } from './models/roomStore';
import { handleRoom } from './sockets/roomHandler';
import { handleRamuduSeetha, clearRSRoundTimeout } from './sockets/ramuduSeethaHandler';
import { handleLudo } from './sockets/ludoHandler';
import { handleChess } from './sockets/chessHandler';

export const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'gravityx-secret-key-space-anti-gravity';

app.use(cors({ origin: '*' })); // Allow all origins for dev/testing
app.use(express.json());

// API routing
app.use('/api', apiRouter);

// Health checks
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'GravityX API Gateway active.' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', uptime: process.uptime() });
});

export const httpServer = createServer(app);

// Initialize Socket.IO with relaxed CORS
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware to authorize WebSockets connections with JWT (Required)
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token) {
    return next(new Error('Authentication token required'));
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return next(new Error('Invalid authentication token'));
    }
    socket.data.user = decoded;
    next();
  });
});


io.on('connection', (socket: Socket) => {
  console.log(`Socket connected: ${socket.id} (User: ${socket.data.user?.username || 'Guest'})`);

  // Attach socket handlers
  handleRoom(io, socket);
  handleRamuduSeetha(io, socket);
  handleLudo(io, socket);
  handleChess(io, socket);

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    // Automatically find and remove player from any active rooms by matching socketId
    const activeRooms = roomStore.getAllRooms();
    for (const room of activeRooms) {
      const player = room.players.find((p) => p.socketId === socket.id);
      if (player) {
        // Mark player as disconnected in memory
        player.disconnected = true;
        
        // Broadcast that the user disconnected (visual indicator in frontend)
        io.to(room.code).emit('room_state_updated', room);
        io.to(room.code).emit('chat_message', {
          id: Math.random().toString(),
          senderName: 'SYSTEM',
          content: `${player.username} disconnected.`,
          createdAt: new Date(),
        });

        // Set grace period timeout based on room status
        const graceDuration = room.status === 'PLAYING' ? 15000 : 5000; // 15s if playing, 5s if lobby
        const timeoutKey = `${room.code}_${player.id}`;

        // Clear any existing timeout for this player
        if (playerDisconnectTimeouts.has(timeoutKey)) {
          clearTimeout(playerDisconnectTimeouts.get(timeoutKey)!);
        }

        const timeoutId = setTimeout(async () => {
          playerDisconnectTimeouts.delete(timeoutKey);

          // Recheck if player is still disconnected
          const currentRoom = roomStore.getRoom(room.code);
          if (currentRoom) {
            const pl = currentRoom.players.find(p => p.id === player.id);
            if (pl && pl.disconnected) {
              const updated = roomStore.removePlayer(room.code, player.id);
              if (updated) {
                if (updated.status === 'LOBBY') {
                  clearRSRoundTimeout(room.code);
                }
                io.to(room.code).emit('room_state_updated', updated);
                io.to(room.code).emit('chat_message', {
                  id: Math.random().toString(),
                  senderName: 'SYSTEM',
                  content: `${player.username} session expired. Left the room.`,
                  createdAt: new Date(),
                });
              } else {
                clearRSRoundTimeout(room.code);
                io.to(room.code).emit('room_deleted');
              }
            }
          }
        }, graceDuration);

        playerDisconnectTimeouts.set(timeoutKey, timeoutId);
      }
    }
  });
});

// Database cleanup function for stale guest accounts
async function cleanupStaleGuestAccounts() {
  // Always clean up stale in-memory rooms older than 12 hours
  try {
    roomStore.cleanStaleRooms();
  } catch (roomErr: any) {
    console.error('⚠️ [ROOM CLEANUP WARNING]:', roomErr.message);
  }

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const deleted = await prisma.user.deleteMany({
      where: {
        isGuest: true,
        createdAt: { lt: cutoff },
      },
    });
    if (deleted.count > 0) {
      console.log(`🧹 [DATABASE CLEANUP]: Removed ${deleted.count} stale guest accounts older than 24 hours.`);
    }
  } catch (err: any) {
    const isConnErr = err.message?.includes("Can't reach database server") || err.message?.includes('P1001');
    if (isConnErr) {
      console.warn('⚠️ [DATABASE]: Cloud database server unreachable. Skipping DB stale guest account cleanup.');
    } else {
      console.warn('⚠️ [DATABASE CLEANUP WARNING]:', err.message?.split('\n')[0] || err.message);
    }
  }
}

// Start HTTP server and trigger cleanup
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, async () => {
    console.log(`====================================================`);
    console.log(` GravityX Backend is running on port ${PORT}`);
    console.log(` API Endpoint: http://localhost:${PORT}/api`);
    console.log(` Health Check: http://localhost:${PORT}/health`);
    console.log(`====================================================`);
    
    // Connect to Database with Retry Logic (Non-blocking for instant port availability)
    const isDbConnected = await connectWithRetry();
    if (isDbConnected) {
      // Run initial cleanup
      await cleanupStaleGuestAccounts();
      // Schedule hourly cleanup
      setInterval(cleanupStaleGuestAccounts, 60 * 60 * 1000);
    }
  });

  // Graceful Shutdown signal handler (SIGTERM / SIGINT)
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 [SYSTEM]: Received ${signal}. Starting graceful shutdown...`);
    httpServer.close(async () => {
      console.log('🔌 [SYSTEM]: HTTP & Socket.IO server closed.');
      try {
        await prisma.$disconnect();
        console.log('📦 [DATABASE]: Prisma client disconnected cleanly.');
      } catch (err: any) {
        console.error('⚠️ [DATABASE]: Error disconnecting Prisma client:', err.message);
      }
      process.exit(0);
    });

    setTimeout(() => {
      console.error('⚠️ [SYSTEM]: Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
