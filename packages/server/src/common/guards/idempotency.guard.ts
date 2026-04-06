import { Injectable, CanActivate, ExecutionContext, ConflictException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator'

@Injectable()
export class IdempotencyGuard implements CanActivate {
  private processedRequests = new Map<string, { timestamp: number; response?: any }>()
  private readonly TTL = 5 * 60 * 1000 // 5分钟

  constructor(private reflector: Reflector) {
    // 每分钟清理过期记录
    setInterval(() => this.cleanup(), 60 * 1000)
  }

  canActivate(context: ExecutionContext): boolean {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!isIdempotent) return true

    const request = context.switchToHttp().getRequest()
    const requestId = request.headers['x-request-id']
    if (!requestId) return true // 无requestId则不做幂等检查

    if (this.processedRequests.has(requestId)) {
      throw new ConflictException('Duplicate request')
    }

    this.processedRequests.set(requestId, { timestamp: Date.now() })
    return true
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, value] of this.processedRequests) {
      if (now - value.timestamp > this.TTL) {
        this.processedRequests.delete(key)
      }
    }
  }
}
