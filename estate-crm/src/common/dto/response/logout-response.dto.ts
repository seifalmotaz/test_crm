import { ApiProperty } from '@nestjs/swagger';

/**
 * Response returned by the logout endpoint.
 */
export class LogoutResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}
