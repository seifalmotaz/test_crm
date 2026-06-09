import { ApiProperty } from '@nestjs/swagger';

export class LeadTagResponseDto {
  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  id: string;

  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a5' })
  leadId: string;

  @ApiProperty({ example: 'Hot' })
  tag: string;

  @ApiProperty({ example: '#EF4444' })
  color: string;
}
