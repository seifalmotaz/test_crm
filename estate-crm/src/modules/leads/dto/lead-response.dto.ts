import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedMetaDto } from '@/common/dto/response/paginated-response.dto';

export class LeadResponseDto {
  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  id: string;

  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a4' })
  tenantId: string;

  @ApiProperty({ example: 'Ahmed Hassan' })
  name: string;

  @ApiPropertyOptional({ example: 'ahmed@example.com', nullable: true })
  email: string | null;

  @ApiProperty({ example: '+201001234567' })
  phone: string;

  @ApiProperty({ example: 'website' })
  source: string;

  @ApiProperty({ example: 'buyer' })
  type: string;

  @ApiPropertyOptional({ example: 10000000, nullable: true })
  budgetMin: number | null;

  @ApiPropertyOptional({ example: 30000000, nullable: true })
  budgetMax: number | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  timeline: number | null;

  @ApiPropertyOptional({ example: 'New Cairo', nullable: true })
  preferredLocation: string | null;

  @ApiPropertyOptional({ example: 'apartment', nullable: true })
  preferredType: string | null;

  @ApiProperty({ example: 'fresh' })
  stage: string;

  @ApiProperty({ example: 75 })
  score: number;

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a5', nullable: true })
  agentId: string | null;

  @ApiProperty({ example: [], type: [String] })
  previousAgentIds: string[];

  @ApiPropertyOptional({ example: 'Looking for 3BR', nullable: true })
  notes: string | null;

  @ApiPropertyOptional({ example: 'Call back tomorrow', nullable: true })
  nextAction: string | null;

  @ApiPropertyOptional({ example: '2026-06-15T10:00:00.000Z', nullable: true })
  nextActionDate: string | null;

  @ApiProperty({ example: false })
  isConverted: boolean;

  @ApiProperty({ example: false })
  isDnc: boolean;

  @ApiPropertyOptional({ example: 'Asked to stop contact', nullable: true })
  dncReason: string | null;

  @ApiPropertyOptional({ example: '2026-06-10T10:00:00.000Z', nullable: true })
  dncSetAt: string | null;

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a6', nullable: true })
  dncSetById: string | null;

  @ApiProperty({ example: '2026-06-01T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-06-09T10:00:00.000Z' })
  updatedAt: string;
}

export class PaginatedLeadResponseDto {
  @ApiProperty({ type: [LeadResponseDto] })
  data: LeadResponseDto[];

  @ApiProperty({ type: PaginatedMetaDto })
  meta: PaginatedMetaDto;
}
