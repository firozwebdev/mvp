const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// Store active rooms and users
const rooms = new Map();
const users = new Map();

// Room management
class Room {
  constructor(id) {
    this.id = id;
    this.users = new Map();
    this.messages = [];
    this.createdAt = new Date();
    this.lastActivity = new Date();
  }

  addUser(userId, socketId, userInfo) {
    this.users.set(userId, {
      socketId,
      ...userInfo,
      joinedAt: new Date(),
      isConnected: true
    });
    this.lastActivity = new Date();
  }

  removeUser(userId) {
    this.users.delete(userId);
    this.lastActivity = new Date();
  }

  addMessage(message) {
    this.messages.push({
      ...message,
      timestamp: new Date(),
      id: uuidv4()
    });
    this.lastActivity = new Date();
  }

  getUserCount() {
    return this.users.size;
  }

  getUsers() {
    return Array.from(this.users.values());
  }

  isEmpty() {
    return this.users.size === 0;
  }
}

// Generate unique room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Clean up inactive rooms (older than 24 hours with no activity)
function cleanupRooms() {
  const now = new Date();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (const [roomId, room] of rooms.entries()) {
    if (room.isEmpty() && (now - room.lastActivity) > maxAge) {
      rooms.delete(roomId);
      console.log(`🧹 Cleaned up inactive room: ${roomId}`);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupRooms, 60 * 60 * 1000);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`👤 User connected: ${socket.id}`);

  // Create or join room
  socket.on('create-room', (userInfo, callback) => {
    const roomCode = generateRoomCode();
    const room = new Room(roomCode);
    const userId = uuidv4();
    
    room.addUser(userId, socket.id, userInfo);
    rooms.set(roomCode, room);
    users.set(socket.id, { userId, roomCode });
    
    socket.join(roomCode);
    
    console.log(`🏠 Room created: ${roomCode} by user: ${userInfo.name}`);
    
    callback({
      success: true,
      roomCode,
      userId,
      room: {
        id: roomCode,
        users: room.getUsers(),
        messages: room.messages
      }
    });
  });

  socket.on('join-room', (data, callback) => {
    const { roomCode, userInfo } = data;
    const room = rooms.get(roomCode);
    
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    
    if (room.getUserCount() >= 2) {
      callback({ success: false, error: 'Room is full' });
      return;
    }
    
    const userId = uuidv4();
    room.addUser(userId, socket.id, userInfo);
    users.set(socket.id, { userId, roomCode });
    
    socket.join(roomCode);
    
    // Notify other users in the room
    socket.to(roomCode).emit('user-joined', {
      user: { userId, ...userInfo },
      room: {
        id: roomCode,
        users: room.getUsers(),
        messages: room.messages
      }
    });
    
    console.log(`👥 User ${userInfo.name} joined room: ${roomCode}`);
    
    callback({
      success: true,
      userId,
      room: {
        id: roomCode,
        users: room.getUsers(),
        messages: room.messages
      }
    });
  });

  // Handle messages
  socket.on('send-message', (messageData) => {
    const userSession = users.get(socket.id);
    if (!userSession) return;
    
    const room = rooms.get(userSession.roomCode);
    if (!room) return;
    
    const message = {
      ...messageData,
      userId: userSession.userId,
      roomCode: userSession.roomCode
    };
    
    room.addMessage(message);
    
    // Broadcast to all users in the room
    io.to(userSession.roomCode).emit('new-message', message);
    
    console.log(`💬 Message in room ${userSession.roomCode}: ${messageData.type}`);
  });

  // Handle real-time status updates
  socket.on('status-update', (statusData) => {
    const userSession = users.get(socket.id);
    if (!userSession) return;
    
    // Broadcast status to other users in the room
    socket.to(userSession.roomCode).emit('user-status', {
      userId: userSession.userId,
      ...statusData
    });
  });

  // Handle WebRTC signaling
  socket.on('webrtc-offer', (data) => {
    const userSession = users.get(socket.id);
    if (!userSession) return;
    
    socket.to(userSession.roomCode).emit('webrtc-offer', {
      ...data,
      fromUserId: userSession.userId
    });
  });

  socket.on('webrtc-answer', (data) => {
    const userSession = users.get(socket.id);
    if (!userSession) return;
    
    socket.to(userSession.roomCode).emit('webrtc-answer', {
      ...data,
      fromUserId: userSession.userId
    });
  });

  socket.on('webrtc-ice-candidate', (data) => {
    const userSession = users.get(socket.id);
    if (!userSession) return;

    socket.to(userSession.roomCode).emit('webrtc-ice-candidate', {
      ...data,
      fromUserId: userSession.userId
    });
  });

  // Handle ping/pong for latency measurement
  socket.on('ping', (timestamp) => {
    socket.emit('pong', timestamp);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const userSession = users.get(socket.id);
    if (userSession) {
      const room = rooms.get(userSession.roomCode);
      if (room) {
        room.removeUser(userSession.userId);
        
        // Notify other users
        socket.to(userSession.roomCode).emit('user-left', {
          userId: userSession.userId,
          room: {
            id: userSession.roomCode,
            users: room.getUsers()
          }
        });
        
        // Clean up empty rooms
        if (room.isEmpty()) {
          rooms.delete(userSession.roomCode);
          console.log(`🗑️ Deleted empty room: ${userSession.roomCode}`);
        }
      }
      
      users.delete(socket.id);
    }
    
    console.log(`👋 User disconnected: ${socket.id}`);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    activeRooms: rooms.size,
    activeUsers: users.size,
    timestamp: new Date().toISOString()
  });
});

// Get room info endpoint
app.get('/room/:roomCode', (req, res) => {
  const room = rooms.get(req.params.roomCode);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({
    id: room.id,
    userCount: room.getUserCount(),
    maxUsers: 2,
    createdAt: room.createdAt,
    lastActivity: room.lastActivity
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Real-time translation server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
});

module.exports = { app, server, io };
