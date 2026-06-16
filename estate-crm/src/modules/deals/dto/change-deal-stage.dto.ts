import { IsString, MaxLength, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DEAL_STAGE_VALUES } from '../enums/deal-constants';

export class ChangeDealStageDto {
  @ApiProperty({ enum: DEAL_STAGE_VALUES, example: 'negotiation', description: 'Target deal stage' })
  @IsString()
  @IsIn([...DEAL_STAGE_VALUES])
  @MaxLength(20)
  stage: string;
}
