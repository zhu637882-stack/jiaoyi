import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemMessage } from '../../database/entities/system-message.entity';
import { SystemMessageService } from './system-message.service';
import { SystemMessageController } from './system-message.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SystemMessage])],
  providers: [SystemMessageService],
  controllers: [SystemMessageController],
  exports: [SystemMessageService],
})
export class SystemMessageModule {}
