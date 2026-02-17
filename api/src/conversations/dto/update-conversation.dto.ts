import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  isSaved?: boolean;
}
