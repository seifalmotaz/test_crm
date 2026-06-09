import { IsString, MaxLength, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LEAD_STAGE_VALUES } from '../enums/lead-constants';

export class ChangeLeadStageDto {
  @ApiProperty({ enum: LEAD_STAGE_VALUES, example: 'qualified', description: 'Target lead stage' })
  @IsString()
  @IsIn([...LEAD_STAGE_VALUES])
  @MaxLength(20)
  stage: string;
}
