import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedMetaDto } from '@/common/dto/response/paginated-response.dto';

export class DealActivityResponseDto {
  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  id: string;

  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a4' })
  tenantId: string;

  @ApiProperty({ example: 'deal' })
  entityType: string;

  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a5' })
  entityId: string;

  @ApiProperty({ example: 'call' })
  type: string;

  @ApiProperty({ example: 'Discussed terms. Follow up next week.' })
  content: string;

  @ApiPropertyOptional({ example: { duration: 15 }, nullable: true })
  metadata: Record<string, unknown> | null;

  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a6' })
  agentId: string;

  @ApiProperty({ example: '2026-06-09T10:00:00.000Z' })
  createdAt: string;
}

export class PaginatedDealActivityResponseDto {
  @ApiProperty({ type: [DealActivityResponseDto] })
  data: DealActivityResponseDto[];

  @ApiProperty({ type: PaginatedMetaDto })
  meta: PaginatedMetaDto;
}
