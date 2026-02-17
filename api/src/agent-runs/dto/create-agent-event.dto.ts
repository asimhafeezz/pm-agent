import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class CreateAgentEventDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsObject()
  payload: Record<string, any>;
}
