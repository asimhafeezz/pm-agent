import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private configService: ConfigService) {}

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.query?.token as string);

    if (!token) {
      client.disconnect();
      return;
    }

    const secret = this.configService.get<string>('JWT_SECRET') || 'dev-secret';
    try {
      const decoded = jwt.verify(token, secret) as { sub: string };
      client.data.userId = decoded.sub;
      client.join(`user:${decoded.sub}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Cleanup handled by Socket.IO
  }

  joinProjectRoom(client: Socket, projectId: string) {
    client.join(`project:${projectId}`);
  }

  emitToProject(projectId: string, event: string, data: unknown) {
    this.server.to(`project:${projectId}`).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitActivity(projectId: string, activityEvent: unknown) {
    this.server.to(`project:${projectId}`).emit('activity:new', activityEvent);
  }
}
