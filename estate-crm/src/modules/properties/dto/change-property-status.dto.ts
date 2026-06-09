import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PropertyStatus } from '@/modules/properties/enums/property-status.enum';

export class ChangePropertyStatusDto {
  @ApiProperty({ example: 'pending', enum: PropertyStatus, description: 'Target status to transition to' })
  @IsEnum(PropertyStatus)
  status: PropertyStatus;
}