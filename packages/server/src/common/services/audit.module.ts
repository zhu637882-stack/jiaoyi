import { Module, Global } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLog } from '../../database/entities/audit-log.entity'
import { User } from '../../database/entities/user.entity'
import { AuditService } from './audit.service'

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, User])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
