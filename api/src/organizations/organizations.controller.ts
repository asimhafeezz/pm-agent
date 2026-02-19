import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('organizations')
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: { id: string }) {
    return this.organizationsService.create(dto, user.id);
  }

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.organizationsService.findAllForUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.organizationsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.organizationsService.update(id, dto, user.id);
  }

  @Post(':id/members')
  addMember(
    @Param('id') orgId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.organizationsService.addMember(orgId, dto.userId, dto.role, user.id);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') orgId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.organizationsService.removeMember(orgId, targetUserId, user.id);
  }
}
