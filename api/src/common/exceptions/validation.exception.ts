import { BadRequestException } from '@nestjs/common';

export class ValidationException extends BadRequestException {
  constructor(errors: unknown) {
    super({
      message: 'Validation failed.',
      errors,
    });
  }
}
