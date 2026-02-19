import { IsNotEmpty, IsString } from 'class-validator';

export class FetchDocumentSourceDto {
  @IsString()
  @IsNotEmpty()
  source: string;
}

