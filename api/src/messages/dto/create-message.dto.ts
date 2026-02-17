import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export enum MessageRole {
  user = 'user',
  assistant = 'assistant',
  system = 'system',
}

export class CreateMessageDto {
  @IsEnum(MessageRole)
  role: MessageRole;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
