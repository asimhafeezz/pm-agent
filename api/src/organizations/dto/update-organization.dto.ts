import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateOrganizationDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsOptional()
  settings?: Record<string, unknown>;
}
