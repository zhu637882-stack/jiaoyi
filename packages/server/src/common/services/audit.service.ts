import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLog } from '../../database/entities/audit-log.entity'

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  async log(params: {
    userId?: string
    action: string
    targetType?: string
    targetId?: string
    detail?: any
    ipAddress?: string
  }): Promise<void> {
    // 异步写入，不影响主流程
    try {
      await this.auditLogRepo.save({
        ...params,
        detail: params.detail ? JSON.stringify(params.detail) : null,
      })
    } catch (error) {
      console.error('Audit log failed:', error)
    }
  }

  async getAuditLogs(query: { action?: string; page?: number; pageSize?: number }) {
    const page = query.page || 1
    const pageSize = query.pageSize || 20
    const qb = this.auditLogRepo.createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
    if (query.action) {
      qb.where('log.action = :action', { action: query.action })
    }
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount()
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }
}
