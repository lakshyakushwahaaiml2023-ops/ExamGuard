import { io } from 'socket.io-client';

// Connect to same-origin Socket.IO backend (works in dev, production & Render deployment)
const socket = io({
  autoConnect: true,
  reconnection: true
});

export default socket;
