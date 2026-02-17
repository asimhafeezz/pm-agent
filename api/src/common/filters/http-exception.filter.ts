import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    console.error('HTTP exception:', exception);
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();
      if (typeof responseBody === 'string') {
        message = responseBody;
      } else if (responseBody && typeof responseBody === 'object') {
        const maybeMessage = (responseBody as { message?: string | string[] }).message;
        if (Array.isArray(maybeMessage)) {
          message = maybeMessage.join(', ');
        } else if (typeof maybeMessage === 'string') {
          message = maybeMessage;
        } else {
          message = exception.message || message;
        }
      } else {
        message = exception.message || message;
      }
    }

    response.status(status).json({
      success: false,
      message,
      data: null,
    });
  }
}
