import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { ValidationException } from '../exceptions/validation.exception';

@Catch(ValidationException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: ValidationException, host: ArgumentsHost) {
    console.error('Validation exception:', exception);
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const responseBody = exception.getResponse();

    let message = exception.message || 'Validation failed.';
    if (typeof responseBody === 'string') {
      message = responseBody;
    } else if (responseBody && typeof responseBody === 'object') {
      const maybeMessage = (responseBody as { message?: string | string[] }).message;
      if (Array.isArray(maybeMessage)) {
        message = maybeMessage.join(', ');
      } else if (typeof maybeMessage === 'string') {
        message = maybeMessage;
      }
    }

    response.status(status).json({
      success: false,
      message,
      data: null,
    });
  }
}
