import { Server as SocketIOServer } from 'socket.io';
import { subscribeToChannel } from '../config/redis';
import { logger } from '../utils/logger';

interface DashboardUpdate {
  type?: string;
  timestamp?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  cost?: number;
  tokens?: number;
  model?: string | null;
  cached?: boolean;
}

export async function startRealtimeGateway(io: SocketIOServer): Promise<void> {
  io.on('connection', (socket) => {
    logger.info('Dashboard websocket connected', { socketId: socket.id });

    socket.on('disconnect', () => {
      logger.info('Dashboard websocket disconnected', { socketId: socket.id });
    });
  });

  await subscribeToChannel('dashboard:updates', (message: string) => {
    try {
      const payload = JSON.parse(message) as DashboardUpdate;
      io.emit('dashboard:update', payload);
    } catch {
      io.emit('dashboard:update', { raw: message });
    }
  });

  logger.info('Realtime gateway started (Redis -> Socket.IO)');
}
