import { io } from 'socket.io-client';

const SERVER_URL = 'http://10.2.4.55:5000';

const socket = io(SERVER_URL, {
  autoConnect: false, // Connect manually when logged in
});

socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
});

socket.on('error', (error) => {
  console.log('Socket error:', error);
});

export default socket;
