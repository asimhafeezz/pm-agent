import { IsNotEmpty, IsNumber, IsObject, IsString } from 'class-validator';

export class CreateToolCallDto {
  @IsString()
  @IsNotEmpty()
  toolName: string;

  @IsObject()
  requestJson: Record<string, any>;

  @IsObject()
  responseJson: Record<string, any>;

  @IsNumber()
  latencyMs: number;
}
