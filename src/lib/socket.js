import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    if (this.socket?.connected) return this.socket;

    // Resolve the backend URL - use same as API client
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    console.log('🛰️ Connecting to Socket.IO backend at:', BACKEND_URL);

    // Create socket connection
    this.socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // On successful connection
    this.socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server');
      this.reconnectAttempts = 0;
    });

    // On disconnect
    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ Disconnected from Socket.IO server:', reason);
    });

    // On connection error
    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message || error);
      this.handleReconnect();
    });

    return this.socket;
  }

  // Wait for socket to be connected
  async waitForConnection() {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.connect();

    return new Promise((resolve, reject) => {
      if (this.socket.connected) {
        resolve(this.socket);
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, 10000);

      this.socket.once('connect', () => {
        clearTimeout(timeout);
        resolve(this.socket);
      });

      this.socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      setTimeout(() => {
        this.connect();
      }, 1000 * this.reconnectAttempts); // Exponential backoff
    } else {
      console.error('❌ Max reconnect attempts reached. Giving up.');
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }

  // Ensure socket is connected before emitting
  ensureConnected() {
    if (!this.socket || !this.socket.connected) {
      console.warn('⚠️ Socket not connected, connecting now...');
      this.connect();
    }
    return this.socket;
  }

  // Room methods
  async joinRoom(roomId, userId, anonymousId) {
    try {
      const socket = await this.waitForConnection();
      console.log('📤 Joining room:', { roomId, userId, anonymousId });
      socket.emit('join_room', { roomId, userId, anonymousId });
    } catch (error) {
      console.error('❌ Failed to join room:', error);
    }
  }

  leaveRoom(roomId, userId, anonymousId) {
    const socket = this.ensureConnected();
    if (socket) {
      socket.emit('leave_room', { roomId, userId, anonymousId });
    }
  }

  // Message methods
  async sendMessage(roomId, userId, content, anonymousId, replyTo = null) {
    try {
      const socket = await this.waitForConnection();
      console.log('📤 Sending message:', { roomId, content: content.substring(0, 50) });
      socket.emit('send_message', { roomId, userId, content, anonymousId, replyTo });
    } catch (error) {
      console.error('❌ Failed to send message:', error);
    }
  }

  addReaction(roomId, messageId, userId, reactionType, anonymousId) {
    const socket = this.ensureConnected();
    if (socket) {
      socket.emit('add_reaction', { roomId, messageId, userId, reactionType, anonymousId });
    }
  }

  // Poll methods
  async createPoll(roomId, userId, question, pollType, options, anonymousId) {
    try {
      const socket = await this.waitForConnection();
      console.log('📤 Creating poll:', { roomId, question });
      socket.emit('create_poll', { roomId, userId, question, pollType, options, anonymousId });
    } catch (error) {
      console.error('❌ Failed to create poll:', error);
    }
  }

  votePoll(roomId, pollId, userId, optionIndex, anonymousId) {
    const socket = this.ensureConnected();
    if (socket) {
      socket.emit('vote_poll', { roomId, pollId, userId, optionIndex, anonymousId });
    }
  }

  endPoll(roomId, pollId, userId) {
    const socket = this.ensureConnected();
    if (socket) {
      socket.emit('end_poll', { roomId, pollId, userId });
    }
  }
}

export const socketService = new SocketService();
