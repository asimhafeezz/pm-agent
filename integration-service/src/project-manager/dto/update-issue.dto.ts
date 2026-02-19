import { IsNotEmpty, IsObject } from 'class-validator';

export class UpdateIssueDto {
  @IsObject()
  @IsNotEmpty()
  input!: Record<string, unknown>;
}
