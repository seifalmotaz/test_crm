import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetVipDto {
  @ApiProperty({ example: true, description: 'Whether the client is a VIP' })
  @IsBoolean()
  isVip: boolean;
}
