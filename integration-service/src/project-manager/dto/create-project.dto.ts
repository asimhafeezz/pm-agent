import { IsNotEmpty, IsObject } from 'class-validator';

export class CreateProjectDto {
  @IsObject()
  @IsNotEmpty()
  input!: Record<string, unknown>;
}
