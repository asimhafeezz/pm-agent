import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationMember, OrgMemberRole } from './entities/organization-member.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private memberRepository: Repository<OrganizationMember>,
  ) {}

  async create(dto: CreateOrganizationDto, userId: string): Promise<Organization> {
    const existing = await this.orgRepository.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException('An organization with this slug already exists.');
    }

    const org = this.orgRepository.create(dto);
    const saved = await this.orgRepository.save(org);

    const member = this.memberRepository.create({
      organizationId: saved.id,
      userId,
      role: OrgMemberRole.OWNER,
    });
    await this.memberRepository.save(member);

    return saved;
  }

  async findAllForUser(userId: string): Promise<Organization[]> {
    const memberships = await this.memberRepository.find({
      where: { userId },
      relations: ['organization'],
    });
    return memberships.map((m) => m.organization);
  }

  async findOne(id: string): Promise<Organization> {
    const org = await this.orgRepository.findOne({
      where: { id },
      relations: ['members', 'members.user'],
    });
    if (!org) throw new NotFoundException('Organization not found.');
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto, userId: string): Promise<Organization> {
    await this.assertRole(id, userId, [OrgMemberRole.OWNER, OrgMemberRole.ADMIN]);
    await this.orgRepository.update(id, dto);
    return this.findOne(id);
  }

  async addMember(orgId: string, targetUserId: string, role: OrgMemberRole, actorUserId: string): Promise<OrganizationMember> {
    await this.assertRole(orgId, actorUserId, [OrgMemberRole.OWNER, OrgMemberRole.ADMIN]);

    const existing = await this.memberRepository.findOne({
      where: { organizationId: orgId, userId: targetUserId },
    });
    if (existing) throw new ConflictException('User is already a member.');

    const member = this.memberRepository.create({
      organizationId: orgId,
      userId: targetUserId,
      role,
    });
    return this.memberRepository.save(member);
  }

  async removeMember(orgId: string, targetUserId: string, actorUserId: string): Promise<void> {
    await this.assertRole(orgId, actorUserId, [OrgMemberRole.OWNER, OrgMemberRole.ADMIN]);
    const result = await this.memberRepository.delete({ organizationId: orgId, userId: targetUserId });
    if (result.affected === 0) throw new NotFoundException('Member not found.');
  }

  async assertMembership(orgId: string, userId: string): Promise<OrganizationMember> {
    const member = await this.memberRepository.findOne({
      where: { organizationId: orgId, userId },
    });
    if (!member) throw new ForbiddenException('Not a member of this organization.');
    return member;
  }

  private async assertRole(orgId: string, userId: string, roles: OrgMemberRole[]): Promise<void> {
    const member = await this.assertMembership(orgId, userId);
    if (!roles.includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions.');
    }
  }
}
