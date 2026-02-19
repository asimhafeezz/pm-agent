import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export class ListUsersDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  query?: string;
}
