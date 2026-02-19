import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityEvent } from './entities/activity-event.entity';
import { CreateActivityEventDto } from './dto/create-activity-event.dto';
import { QueryActivityDto } from './dto/query-activity.dto';

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(ActivityEvent)
    private readonly activityRepo: Repository<ActivityEvent>,
  ) {}

  async ingestEvent(dto: CreateActivityEventDto): Promise<ActivityEvent> {
    const event = this.activityRepo.create({
      ...dto,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
    });
    return this.activityRepo.save(event);
  }

  async getStream(query: QueryActivityDto) {
    const qb = this.activityRepo.createQueryBuilder('event');

    if (query.projectId) {
      qb.andWhere('event.projectId = :projectId', { projectId: query.projectId });
    }
    if (query.source) {
      qb.andWhere('event.source = :source', { source: query.source });
    }
    if (query.eventType) {
      qb.andWhere('event.eventType = :eventType', { eventType: query.eventType });
    }
    if (query.since) {
      qb.andWhere('event.createdAt >= :since', { since: new Date(query.since) });
    }
    if (query.until) {
      qb.andWhere('event.createdAt <= :until', { until: new Date(query.until) });
    }

    qb.orderBy('event.createdAt', 'DESC');
    qb.take(query.limit || 50);
    qb.skip(query.offset || 0);

    const [events, total] = await qb.getManyAndCount();
    return { events, total };
  }

  async getRecentForProject(projectId: string, limit = 20): Promise<ActivityEvent[]> {
    return this.activityRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
