import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageRole } from '../conversations/entities/message.entity';

import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
  ) {}

  async create(userId: string, conversationId: string, payload: CreateMessageDto) {
    const message = this.messagesRepository.create({
      conversationId,
      // userId, // Message entity does not have userId column in simplified version, let's check.
      // Checking entity... it does NOT have userId. It has role, content, metadataJson.
      // If we want to track who sent it (user/assistant), role is enough for now given generic schema.
      // But wait, user_id is useful. In Message entity I created earlier:
      // @Column() conversationId: string;
      // @Column({ type: 'enum', enum: MessageRole }) role: MessageRole;
      // @Column('text') content: string;
      // ...
      // No userId column.
      role: payload.role as unknown as MessageRole, // Cast DTO role to Entity role (values should match)
      content: payload.content,
      metadataJson: payload.metadata ?? undefined,
    });
    return this.messagesRepository.save(message);
  }

  async list(userId: string, conversationId: string) {
    return this.messagesRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      // relations: ['conversation'], // if needed
    });
  }
}
