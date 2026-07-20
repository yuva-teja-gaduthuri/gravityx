import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

import apiRouter from './routes/api';
import { roomStore } from './models/roomStore';
import { handleRoom } from './sockets/roomHandler';
import { handleRamuduSeetha } from './sockets/ramuduSeethaHandler';
import { handleLudo } from './sockets/ludoHandler';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'gravityx-secret-key-space-anti-gravity';

app.use(cors({ origin: '*' })); // Allow all origins for dev/testing
app.use(express.json());

// API routing
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', uptime: process.uptime() });
});

const httpServer = createServer(app);

// Initialize Socket.IO with relaxed CORS
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware to authorize WebSockets connections with JWT (optional, falls back to Guest)
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token) {
    // Allow guest socket connection without token
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      // Don't fail connection, connect as guest
      return next();
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

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    // Automatically find and remove player from any active rooms
    const userId = socket.data.user?.id;
    if (userId) {
      const activeRooms = roomStore.getAllRooms();
      for (const room of activeRooms) {
        const hasPlayer = room.players.some((p) => p.id === userId);
        if (hasPlayer) {
          const updated = roomStore.removePlayer(room.code, userId);
          if (updated) {
            io.to(room.code).emit('room_state_updated', updated);
            io.to(room.code).emit('chat_message', {
              id: Math.random().toString(),
              senderName: 'SYSTEM',
              content: `${socket.data.user?.username || 'A player'} disconnected.`,
              createdAt: new Date(),
            });
          } else {
            io.to(room.code).emit('room_deleted');
          }
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` GravityX Backend is running on port ${PORT}`);
  console.log(` API Endpoint: http://localhost:${PORT}/api`);
  console.log(` Health Check: http://localhost:${PORT}/health`);
  console.log(`====================================================`);
});
