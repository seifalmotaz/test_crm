import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectStatus } from '@/modules/projects/enums/project-status.enum';

export class ChangeProjectStatusDto {
  @ApiProperty({ example: 'active', enum: ProjectStatus, description: 'Target status to transition to' })
  @IsEnum(ProjectStatus)
  status: ProjectStatus;
}