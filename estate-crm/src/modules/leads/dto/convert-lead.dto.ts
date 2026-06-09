import { ApiHideProperty } from '@nestjs/swagger';

/**
 * Convert Lead to Client DTO.
 * Empty body for now; reserved for future fields (e.g., client type override, notes).
 * The actual "conversion" simply sets `isConverted = true` on the lead;
 * a "client" is a lead the agent has decided to commit to.
 */
export class ConvertLeadDto {
  // No body required for v1 conversion. Reserved for future fields.
  // Hidden from Swagger to avoid schema generation issues.
  @ApiHideProperty()
  _reserved?: never;
}
