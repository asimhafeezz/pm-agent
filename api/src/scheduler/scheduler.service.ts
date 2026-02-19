import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ScheduledJob, JobType } from './entities/scheduled-job.entity';
import { CreateScheduledJobDto } from './dto/create-scheduled-job.dto';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(ScheduledJob)
    private readonly jobRepo: Repository<ScheduledJob>,
    @InjectQueue('scheduler')
    private readonly schedulerQueue: Queue,
  ) {}

  async create(
    projectId: string,
    userId: string,
    dto: CreateScheduledJobDto,
  ): Promise<ScheduledJob> {
    const job = this.jobRepo.create({
      projectId,
      userId,
      jobType: dto.jobType,
      cronExpression: dto.cronExpression,
      config: dto.config || {},
      isActive: true,
    });
    const saved = await this.jobRepo.save(job);

    // Register as a repeatable BullMQ job
    await this.registerRepeatableJob(saved);

    return saved;
  }

  async findAll(projectId: string): Promise<ScheduledJob[]> {
    return this.jobRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ScheduledJob> {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Scheduled job not found');
    return job;
  }

  async update(
    id: string,
    updates: Partial<Pick<ScheduledJob, 'cronExpression' | 'isActive' | 'config'>>,
  ): Promise<ScheduledJob> {
    const job = await this.findOne(id);

    if (updates.cronExpression !== undefined) job.cronExpression = updates.cronExpression;
    if (updates.isActive !== undefined) job.isActive = updates.isActive;
    if (updates.config !== undefined) job.config = updates.config;

    const saved = await this.jobRepo.save(job);

    // Update the repeatable job
    await this.removeRepeatableJob(saved);
    if (saved.isActive) {
      await this.registerRepeatableJob(saved);
    }

    return saved;
  }

  async remove(id: string): Promise<void> {
    const job = await this.findOne(id);
    await this.removeRepeatableJob(job);
    await this.jobRepo.remove(job);
  }

  async trigger(id: string): Promise<void> {
    const job = await this.findOne(id);
    await this.schedulerQueue.add(job.jobType, {
      jobId: job.id,
      projectId: job.projectId,
      userId: job.userId,
      jobType: job.jobType,
      config: job.config,
    });
    this.logger.log(`Manually triggered job ${job.id} (${job.jobType})`);
  }

  async updateLastRun(id: string, status: string): Promise<void> {
    await this.jobRepo.update(id, {
      lastRunAt: new Date(),
      lastRunStatus: status,
    });
  }

  private async registerRepeatableJob(job: ScheduledJob): Promise<void> {
    try {
      await this.schedulerQueue.add(
        job.jobType,
        {
          jobId: job.id,
          projectId: job.projectId,
          userId: job.userId,
          jobType: job.jobType,
          config: job.config,
        },
        {
          repeat: { pattern: job.cronExpression },
          jobId: `scheduled-${job.id}`,
        },
      );
      this.logger.log(`Registered repeatable job ${job.id}: ${job.cronExpression}`);
    } catch (error) {
      this.logger.error(`Failed to register repeatable job ${job.id}: ${error}`);
    }
  }

  private async removeRepeatableJob(job: ScheduledJob): Promise<void> {
    try {
      await this.schedulerQueue.removeRepeatableByKey(`scheduled-${job.id}`);
    } catch {
      // Best effort — might not exist
    }
  }
}
