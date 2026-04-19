import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { MarketService } from '../../modules/market/market.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('EventsGateway');
  private tickerInterval: NodeJS.Timeout | null = null;

  constructor(
    private configService: ConfigService,
    private marketService: MarketService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    // 启动定时推送
    this.startTickerBroadcast();
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:market')
  handleMarketSubscribe(client: Socket, payload: { drugId?: string }) {
    this.logger.log(`Client ${client.id} subscribed to market updates`);
    if (payload.drugId) {
      client.join(`drug:${payload.drugId}`);
    }
    client.emit('subscribed', { channel: 'market', drugId: payload.drugId });
  }

  @SubscribeMessage('subscribe:trades')
  handleTradesSubscribe(client: Socket, payload: { userId?: string }) {
    this.logger.log(`Client ${client.id} subscribed to trade updates`);
    if (payload.userId) {
      client.join(`user:${payload.userId}`);
    }
    client.emit('subscribed', { channel: 'trades', userId: payload.userId });
  }

  @SubscribeMessage('subscribe:ticker')
  handleTickerSubscribe(client: Socket) {
    this.logger.log(`Client ${client.id} subscribed to ticker updates`);
    client.join('ticker');
    client.emit('subscribed', { channel: 'ticker' });
    
    // 立即发送一次当前行情
    this.sendTickerUpdate(client);
  }

  // 广播市场行情更新
  broadcastMarketUpdate(data: any) {
    this.server.emit('market:update', data);
    
    // 如果有药品ID，也发送到对应的房间
    if (data.drugId) {
      this.server.to(`drug:${data.drugId}`).emit('market:update', data);
    }
  }

  // 广播交易更新
  broadcastTradeUpdate(userId: string, data: any) {
    this.server.to(`user:${userId}`).emit('trade:update', data);
  }

  // 广播系统通知
  broadcastSystemNotification(data: any) {
    this.server.emit('system:notification', data);
  }

  // 广播行情快照更新
  broadcastMarketSnapshot(data: any) {
    this.server.emit('market:snapshot', data);
    if (data.drugId) {
      this.server.to(`drug:${data.drugId}`).emit('market:snapshot', data);
    }
  }

  // 广播行情ticker（所有药品摘要）
  broadcastMarketTicker(data: any) {
    this.server.to('ticker').emit('market:ticker', data);
    this.server.emit('market:ticker', data);
  }

  // 广播认购更新
  broadcastSubscriptionUpdate(data: any) {
    this.server.emit('subscription:update', data);
    if (data.drugId) {
      this.server.to(`drug:${data.drugId}`).emit('subscription:update', data);
    }
  }

  // 推送认购订单更新通知到指定用户
  emitSubscriptionUpdate(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  // 广播清算完成通知
  broadcastSettlementComplete(data: any) {
    this.server.emit('settlement:complete', data);
    if (data.drugId) {
      this.server.to(`drug:${data.drugId}`).emit('settlement:complete', data);
    }
  }

  // 定时推送行情ticker（每5秒）
  private startTickerBroadcast() {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
    }

    this.tickerInterval = setInterval(async () => {
      try {
        const tickers = await this.marketService.getLatestTickers();
        this.broadcastMarketTicker({
          timestamp: new Date().toISOString(),
          tickers,
        });
      } catch (error) {
        this.logger.error('Failed to broadcast ticker:', error);
      }
    }, 5000);
  }

  // 发送ticker更新给指定客户端
  private async sendTickerUpdate(client: Socket) {
    try {
      const tickers = await this.marketService.getLatestTickers();
      client.emit('market:ticker', {
        timestamp: new Date().toISOString(),
        tickers,
      });
    } catch (error) {
      this.logger.error('Failed to send ticker update:', error);
    }
  }

  // 清理定时器
  onModuleDestroy() {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
    }
  }
}
