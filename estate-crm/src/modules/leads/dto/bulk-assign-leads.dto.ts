import { IsArray, IsOptional, IsString, IsUUID, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkAssignLeadsDto {
  @ApiProperty({
    type: [String],
    example: ['01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3', '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a4'],
    description: 'Lead IDs to assign (1-200 per request)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  leadIds: string[];

  @ApiPropertyOptional({
    example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3',
    description: 'Target agent ID. Omit or send null to unassign leads.',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  agentId?: string | null;
}

export class BulkAssignResultDto {
  @ApiProperty({ example: 25, description: 'Number of leads successfully reassigned' })
  assigned: number;

  @ApiProperty({ example: 2, description: 'Number of leads that could not be reassigned (not found, etc.)' })
  failed: number;

  @ApiPropertyOptional({ type: [String], description: 'IDs of leads that failed to reassign' })
  failedIds?: string[];

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  agentId?: string | null;
}