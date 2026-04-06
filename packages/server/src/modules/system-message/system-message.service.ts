import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemMessage, MessageType, MessageStatus } from '../../database/entities/system-message.entity';
import { CreateSystemMessageDto } from './dto/create-system-message.dto';
import { UpdateSystemMessageDto } from './dto/update-system-message.dto';

@Injectable()
export class SystemMessageService {
  constructor(
    @InjectRepository(SystemMessage)
    private systemMessageRepository: Repository<SystemMessage>,
  ) {}

  // 获取已发布消息（前端用，按publishedAt DESC排序）
  async getPublishedMessages(page: number = 1, pageSize: number = 10) {
    const [list, total] = await this.systemMessageRepository.findAndCount({
      where: { status: MessageStatus.PUBLISHED },
      order: { publishedAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      list,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // 管理员获取所有消息（支持状态筛选、分页）
  async getAllMessages(query: { status?: string; page?: number; pageSize?: number }) {
    const { status, page = 1, pageSize = 10 } = query;
    
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [list, total] = await this.systemMessageRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      list,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // 创建消息
  async createMessage(userId: string, dto: CreateSystemMessageDto) {
    const message = this.systemMessageRepository.create({
      title: dto.title,
      content: dto.content,
      type: (dto.type as MessageType) || MessageType.ANNOUNCEMENT,
      status: MessageStatus.DRAFT,
    });

    const saved = await this.systemMessageRepository.save(message);
    return saved;
  }

  // 编辑消息
  async updateMessage(id: string, dto: UpdateSystemMessageDto) {
    const message = await this.systemMessageRepository.findOne({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException('消息不存在');
    }

    // 已发布的消息不允许编辑
    if (message.status === MessageStatus.PUBLISHED) {
      throw new Error('已发布的消息不允许编辑');
    }

    if (dto.title !== undefined) message.title = dto.title;
    if (dto.content !== undefined) message.content = dto.content;
    if (dto.type !== undefined) message.type = dto.type as MessageType;
    if (dto.status !== undefined) message.status = dto.status as MessageStatus;

    const saved = await this.systemMessageRepository.save(message);
    return saved;
  }

  // 删除消息
  async deleteMessage(id: string) {
    const message = await this.systemMessageRepository.findOne({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException('消息不存在');
    }

    await this.systemMessageRepository.remove(message);
    return { success: true };
  }

  // 发布消息（状态改为published，记录publishedAt和publishedBy）
  async publishMessage(id: string, userId: string) {
    const message = await this.systemMessageRepository.findOne({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException('消息不存在');
    }

    if (message.status === MessageStatus.PUBLISHED) {
      throw new Error('消息已经发布');
    }

    message.status = MessageStatus.PUBLISHED;
    message.publishedBy = userId;
    message.publishedAt = new Date();

    const saved = await this.systemMessageRepository.save(message);
    return saved;
  }
}
