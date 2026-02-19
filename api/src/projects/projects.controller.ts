import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrganizationsService } from '../organizations/organizations.service';

@Controller()
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Post('organizations/:orgId/projects')
  async create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: { id: string },
  ) {
    await this.organizationsService.assertMembership(orgId, user.id);
    return this.projectsService.create(orgId, dto);
  }

  @Get('organizations/:orgId/projects')
  async findAll(
    @Param('orgId') orgId: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.organizationsService.assertMembership(orgId, user.id);
    return this.projectsService.findAllForOrg(orgId);
  }

  @Get('projects/:id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch('projects/:id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete('projects/:id')
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
