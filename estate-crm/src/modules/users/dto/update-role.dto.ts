import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiProperty({ example: 'manager', enum: ['manager', 'agent'], description: 'New role' })
  @IsEnum(['manager', 'agent'])
  role: string;
}
