import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  settings?: Record<string, unknown>;
}
