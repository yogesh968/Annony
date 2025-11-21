const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const Filter = require('bad-words');
require('dotenv').config();

const { connectDB } = require('./config/db');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const Message = require('./models/Message');
const Poll = require('./models/Poll');
const Room = require('./models/Room');
const RoomMember = require('./models/RoomMember');

const app = express();
const server = http.createServer(app);

// Get allowed origins from environment variable or use defaults
const defaultOrigins = [
  'http://localhost:5173',
  'https://annoymeet.vercel.app',
  'http://localhost:4173' // Vite preview port
];

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : defaultOrigins;

// Add Render frontend URL if it exists (but not the backend URL itself)
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
// RENDER_EXTERNAL_URL is the backend's own URL, so we don't add it to CORS

console.log('🌐 Allowed CORS origins:', allowedOrigins);

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Anonymeet Backend API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      rooms: '/api/rooms'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

const filter = new Filter();

const rooms = new Map();
const userSockets = new Map();
const roomCleanupTimers = new Map();

const getRoomMembers = (roomId) => {
  const room = rooms.get(roomId);
  return room ? Array.from(room.members.values()) : [];
};

const addUserToRoom = (roomId, userId, socketId, anonymousId) => {
  if (roomCleanupTimers.has(roomId)) {
    clearTimeout(roomCleanupTimers.get(roomId));
    roomCleanupTimers.delete(roomId);
  }

  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      organizer_id: null,
      members: new Map(),
      messages: [],
      messageMap: new Map(),
      polls: new Map(),
    });
  }

  const room = rooms.get(roomId);
  room.members.set(userId, {
    userId,
    socketId,
    anonymousId,
    joinedAt: new Date().toISOString(),
  });

  userSockets.set(socketId, { userId, roomId, anonymousId });
};

const removeUserFromRoom = (roomId, userId) => {
  const room = rooms.get(roomId);
  if (room) {
    room.members.delete(userId);
    if (room.members.size === 0) {
      const timerId = setTimeout(() => {
        rooms.delete(roomId);
        roomCleanupTimers.delete(roomId);
      }, 30000);
      roomCleanupTimers.set(roomId, timerId);
    }
  }
};

const cleanMessage = (content) => {
  try {
    return filter.clean(content);
  } catch (error) {
    console.error('Error filtering message:', error);
    return content;
  }
};

const containsProfanity = (content) => {
  try {
    return filter.isProfane(content);
  } catch (error) {
    console.error('Error checking profanity:', error);
    return false;
  }
};

const serializeMessage = (messageDoc, messageCache) => {
  const payload = {
    id: messageDoc._id.toString(),
    room_id: messageDoc.roomId.toString(),
    user_id: messageDoc.userId.toString(),
    anonymous_id: messageDoc.anonymousId,
    content: messageDoc.content,
    created_at: messageDoc.createdAt,
    reply_to: messageDoc.replyTo ? messageDoc.replyTo.toString() : null,
    reactions: Object.fromEntries(messageDoc.reactions || []),
    user_reactions: Object.fromEntries(messageDoc.userReactions || []),
    parent_message: null,
  };

  if (payload.reply_to && messageCache.has(payload.reply_to)) {
    const parent = messageCache.get(payload.reply_to);
    payload.parent_message = {
      id: parent.id,
      content: parent.content,
      anonymous_id: parent.anonymous_id,
    };
  }

  return payload;
};

const serializePoll = (pollDoc) => ({
  id: pollDoc._id.toString(),
  roomId: pollDoc.roomId.toString(),
  createdBy: pollDoc.createdBy.toString(),
  creatorAnonymousId: pollDoc.creatorAnonymousId,
  question: pollDoc.question,
  pollType: pollDoc.pollType,
  options: pollDoc.options,
  votes: Object.fromEntries(pollDoc.votes || []),
  voteCounts: pollDoc.voteCounts,
  isActive: pollDoc.isActive,
  createdAt: pollDoc.createdAt,
});

const ensureRoomState = async (roomId) => {
  let roomState = rooms.get(roomId);
  if (roomState) return roomState;

  const roomDoc = await Room.findById(roomId);
  if (!roomDoc) return null;

  roomState = {
    id: roomId,
    organizer_id: roomDoc.createdBy.toString(),
    members: new Map(),
    messages: [],
    messageMap: new Map(),
    polls: new Map(),
  };

  const [messages, polls] = await Promise.all([
    Message.find({ roomId }).sort({ createdAt: 1 }).limit(200),
    Poll.find({ roomId, isActive: true }).sort({ createdAt: -1 }),
  ]);

  messages.forEach((msgDoc) => {
    const payload = serializeMessage(msgDoc, roomState.messageMap);
    roomState.messages.push(payload);
    roomState.messageMap.set(payload.id, payload);
  });

  polls.forEach((pollDoc) => {
    const payload = serializePoll(pollDoc);
    roomState.polls.set(payload.id, payload);
  });

  rooms.set(roomId, roomState);
  return roomState;
};

const verifyMembership = async (roomId, userId, anonymousId) => {
  const member = await RoomMember.findOne({
    roomId,
    userId,
    anonymousId,
    isActive: true,
  });

  return Boolean(member);
};

io.on('connection', (socket) => {
  socket.on('join_room', async ({ roomId, userId, anonymousId }) => {
    try {
      const memberExists = await verifyMembership(roomId, userId, anonymousId);
      if (!memberExists) {
        socket.emit('room_error', { error: 'Membership not found' });
        return;
      }

      const roomState = await ensureRoomState(roomId);
      if (!roomState) {
        socket.emit('room_error', { error: 'Room not found' });
        return;
      }

      socket.join(roomId);
      addUserToRoom(roomId, userId, socket.id, anonymousId);

      const members = getRoomMembers(roomId);

      socket.emit('room_state', {
        members,
        messages: roomState.messages,
        polls: Array.from(roomState.polls.values()),
      });

      io.to(roomId).emit('user_joined', {
        userId,
        anonymousId,
        members,
        organizer_id: roomState.organizer_id,
      });
    } catch (error) {
      console.error('join_room error:', error);
      socket.emit('room_error', { error: 'Failed to join room' });
    }
  });

  socket.on('leave_room', ({ roomId, userId, anonymousId }) => {
    socket.leave(roomId);
    removeUserFromRoom(roomId, userId);

    const members = getRoomMembers(roomId);

    socket.to(roomId).emit('user_left', {
      userId,
      anonymousId,
      members,
    });

    userSockets.delete(socket.id);
  });

  socket.on('send_message', async ({ roomId, userId, content, anonymousId, replyTo }) => {
    try {
      if (containsProfanity(content)) {
        socket.emit('message_error', {
          error: 'Message contains inappropriate content and cannot be sent.',
        });
        return;
      }

      const memberExists = await verifyMembership(roomId, userId, anonymousId);
      if (!memberExists) {
        socket.emit('message_error', { error: 'Membership not found' });
        return;
      }

      const roomState = await ensureRoomState(roomId);
      if (!roomState) {
        socket.emit('message_error', { error: 'Room not found' });
        return;
      }

      const cleanedContent = cleanMessage(content);

      const messageDoc = await Message.create({
        roomId,
        userId,
        anonymousId,
        content: cleanedContent,
        replyTo: replyTo || null,
      });

      const messagePayload = serializeMessage(messageDoc, roomState.messageMap);
      roomState.messageMap.set(messagePayload.id, messagePayload);
      roomState.messages.push(messagePayload);

      if (roomState.messages.length > 500) {
        const removed = roomState.messages.shift();
        if (removed) {
          roomState.messageMap.delete(removed.id);
        }
      }

      io.to(roomId).emit('new_message', messagePayload);
    } catch (error) {
      console.error('send_message error:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  socket.on('add_reaction', async ({ roomId, messageId, userId, reactionType }) => {
    try {
      const roomState = await ensureRoomState(roomId);
      if (!roomState) return;

      const messageDoc = await Message.findById(messageId);
      if (!messageDoc) return;

      const reactions = messageDoc.reactions || new Map();
      const userReactions = messageDoc.userReactions || new Map();
      const userCurrentReaction = userReactions.get(userId);

      if (userCurrentReaction === reactionType) {
        const currentCount = reactions.get(reactionType) || 0;
        if (currentCount <= 1) {
          reactions.delete(reactionType);
        } else {
          reactions.set(reactionType, currentCount - 1);
        }
        userReactions.delete(userId);
      } else {
        if (userCurrentReaction) {
          const prevCount = reactions.get(userCurrentReaction) || 0;
          if (prevCount <= 1) {
            reactions.delete(userCurrentReaction);
          } else {
            reactions.set(userCurrentReaction, prevCount - 1);
          }
        }
        reactions.set(reactionType, (reactions.get(reactionType) || 0) + 1);
        userReactions.set(userId, reactionType);
      }

      messageDoc.reactions = reactions;
      messageDoc.userReactions = userReactions;
      messageDoc.markModified('reactions');
      messageDoc.markModified('userReactions');
      await messageDoc.save();

      const messagePayload = roomState.messageMap.get(messageId);
      if (messagePayload) {
        messagePayload.reactions = Object.fromEntries(reactions);
        messagePayload.user_reactions = Object.fromEntries(userReactions);
      }

      io.to(roomId).emit('reaction_update', {
        messageId,
        reactions: messagePayload?.reactions || Object.fromEntries(reactions),
        user_reactions:
          messagePayload?.user_reactions || Object.fromEntries(userReactions),
      });
    } catch (error) {
      console.error('add_reaction error:', error);
    }
  });

  socket.on('create_poll', async ({ roomId, userId, question, pollType, options, anonymousId }) => {
    try {
      if (containsProfanity(question)) {
        socket.emit('poll_error', { error: 'Poll question contains inappropriate content.' });
        return;
      }

      const memberExists = await verifyMembership(roomId, userId, anonymousId);
      if (!memberExists) {
        socket.emit('poll_error', { error: 'Membership not found' });
        return;
      }

      const cleanOptions = options.map((option) => {
        if (containsProfanity(option)) {
          socket.emit('poll_error', {
            error: 'Poll option contains inappropriate content.',
          });
          return null;
        }
        return cleanMessage(option);
      });

      if (cleanOptions.includes(null)) return;

      const pollDoc = await Poll.create({
        roomId,
        createdBy: userId,
        creatorAnonymousId: anonymousId,
        question: cleanMessage(question),
        pollType,
        options: cleanOptions,
        voteCounts: new Array(cleanOptions.length).fill(0),
      });

      const roomState = await ensureRoomState(roomId);
      if (!roomState) return;

      const pollPayload = serializePoll(pollDoc);
      roomState.polls.set(pollPayload.id, pollPayload);

      io.to(roomId).emit('new_poll', pollPayload);
    } catch (error) {
      console.error('create_poll error:', error);
      socket.emit('poll_error', { error: 'Failed to create poll' });
    }
  });

  socket.on('vote_poll', async ({ roomId, pollId, userId, optionIndex, anonymousId }) => {
    try {
      const pollDoc = await Poll.findById(pollId);
      if (!pollDoc || pollDoc.roomId.toString() !== roomId || !pollDoc.isActive) return;

      pollDoc.votes.set(userId, optionIndex);
      pollDoc.voteCounts = pollDoc.options.map((_, index) => {
        return Array.from(pollDoc.votes.values()).filter((vote) => vote === index).length;
      });
      pollDoc.markModified('votes');
      await pollDoc.save();

      const roomState = await ensureRoomState(roomId);
      if (!roomState) return;

      const pollPayload = serializePoll(pollDoc);
      roomState.polls.set(pollPayload.id, pollPayload);

      io.to(roomId).emit('poll_vote_update', {
        pollId,
        userId,
        optionIndex,
        anonymousId,
        voteCounts: pollPayload.voteCounts,
        totalVotes: pollDoc.votes.size,
      });
    } catch (error) {
      console.error('vote_poll error:', error);
      socket.emit('poll_error', { error: 'Failed to record vote' });
    }
  });

  socket.on('end_poll', async ({ roomId, pollId, userId }) => {
    try {
      const pollDoc = await Poll.findById(pollId);
      if (!pollDoc || pollDoc.roomId.toString() !== roomId) {
        socket.emit('poll_error', { error: 'Poll not found' });
        return;
      }

      if (pollDoc.createdBy.toString() !== userId) {
        socket.emit('poll_error', { error: 'Only poll creator can end the poll' });
        return;
      }

      pollDoc.isActive = false;
      await pollDoc.save();

      const roomState = await ensureRoomState(roomId);
      if (roomState) {
        roomState.polls.delete(pollId);
      }

      io.to(roomId).emit('poll_ended', { pollId });
    } catch (error) {
      console.error('end_poll error:', error);
      socket.emit('poll_error', { error: 'Failed to end poll' });
    }
  });

  socket.on('disconnect', () => {
    const userInfo = userSockets.get(socket.id);
    if (userInfo) {
      const { userId, roomId, anonymousId } = userInfo;
      removeUserFromRoom(roomId, userId);

      const members = getRoomMembers(roomId);

      socket.to(roomId).emit('user_left', {
        userId,
        anonymousId,
        members,
      });

      userSockets.delete(socket.id);
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size,
    connectedUsers: userSockets.size,
  });
});

const PORT = process.env.PORT || 3001;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
