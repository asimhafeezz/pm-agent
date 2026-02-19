import { IsNotEmpty, IsObject } from 'class-validator';

export class CreateIssueDto {
  @IsObject()
  @IsNotEmpty()
  input!: Record<string, unknown>;
}
