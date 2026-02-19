import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { MeetingStatus } from '../entities/meeting.entity';

export class UpdateMeetingStatusDto {
  @IsEnum(MeetingStatus)
  status: MeetingStatus;

  @IsOptional()
  @IsString()
  processingError?: string;

  @IsOptional()
  @IsNumber()
  insightCount?: number;
}
