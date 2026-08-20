import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { verifyAccessToken } from './utils/tokens.js';
import { prisma } from './config/prisma.js';
import { env } from './config/env.js';

export let io: Server | null = null;
export const startRealtime = (server: HttpServer) => {
  io = new Server(server, { cors: { origin: [env.FRONTEND_URL, 'http://localhost:5500', 'http://127.0.0.1:5500'], credentials: true } });
  io.use((socket, next) => { try { socket.data.userId = verifyAccessToken(String(socket.handshake.auth.token || '')).sub; next(); } catch { next(new Error('Unauthorized')); } });
  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
    socket.on('conversation:join', async (id: string) => { const member = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId: id, userId: socket.data.userId } } }); if (member) socket.join(`conversation:${id}`); });
  });
  return io;
};
