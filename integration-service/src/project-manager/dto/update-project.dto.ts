import { IsNotEmpty, IsObject } from 'class-validator';

export class UpdateProjectDto {
  @IsObject()
  @IsNotEmpty()
  input!: Record<string, unknown>;
}
