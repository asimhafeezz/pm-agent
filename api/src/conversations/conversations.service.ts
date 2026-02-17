import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private conversationsRepository: Repository<Conversation>,
  ) {}

  async create(userId: string, payload: CreateConversationDto) {
    const conversation = this.conversationsRepository.create({
      userId,
      title: payload.title,
    });
    return this.conversationsRepository.save(conversation);
  }

  async list(userId: string) {
    return this.conversationsRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async get(userId: string, conversationId: string) {
    return this.conversationsRepository.findOne({
      where: { id: conversationId, userId },
      relations: ['messages'],
    });
  }

  async update(userId: string, conversationId: string, payload: any) {
    const conversation = await this.get(userId, conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }
    
    // Simple property update
    Object.assign(conversation, payload);
    return this.conversationsRepository.save(conversation);
  }

  async remove(userId: string, conversationId: string) {
    const conversation = await this.get(userId, conversationId);
    if (!conversation) {
      return null;
    }
    // Hard delete for simplicity in this boilerplate, or implementing soft delete field if needed
    // Entity doesn't have deletedAt for now unless we add it. 
    // Checking entity... it does NOT have deletedAt in the simplified version I wrote.
    await this.conversationsRepository.remove(conversation);
    return { id: conversationId };
  }

  // Simplified memory retrieval stub - since other memory tables were removed in simplified schema
  async getMemory(userId: string, conversationId: string) {
    return {
      conversationSummary: null,
      topics: [],
      userMemories: [],
    };
  }

  // Simplified upsert stub
  async upsertMemory(userId: string, conversationId: string, payload: UpdateMemoryDto) {
    return this.getMemory(userId, conversationId);
  }
}
