import { HttpStatus } from '@nestjs/common';

export class DomainError extends Error {
  constructor(
    readonly httpStatus: HttpStatus,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
