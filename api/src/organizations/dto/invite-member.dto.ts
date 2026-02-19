import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { OrgMemberRole } from '../entities/organization-member.entity';

export class InviteMemberDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEnum(OrgMemberRole)
  @IsOptional()
  role?: OrgMemberRole = OrgMemberRole.MEMBER;
}
