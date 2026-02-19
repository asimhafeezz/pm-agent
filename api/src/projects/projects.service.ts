import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
  ) {}

  async create(orgId: string, dto: CreateProjectDto): Promise<Project> {
    const project = this.projectRepository.create({
      ...dto,
      organizationId: orgId,
    });
    return this.projectRepository.save(project);
  }

  async findAllForOrg(orgId: string): Promise<Project[]> {
    return this.projectRepository.find({
      where: { organizationId: orgId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found.');
    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    await this.projectRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.projectRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Project not found.');
  }
}
