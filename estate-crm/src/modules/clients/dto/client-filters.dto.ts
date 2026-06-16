import { IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class ClientFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by VIP status (true|false)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isVip?: boolean;

  @ApiPropertyOptional({ description: 'Filter by assigned agent ID' })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  // NOTE: No `stage` filter — clients don't have pipeline stages
  // NOTE: No `source` filter — clients always have source='direct'
  // NOTE: No `isClient` filter — it's always true in /api/clients
}
