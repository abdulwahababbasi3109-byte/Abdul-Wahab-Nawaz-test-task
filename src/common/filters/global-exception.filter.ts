import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from '../errors/domain.error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    const response = host.switchToHttp().getResponse<Response>();

    let status = 500;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Something went wrong';
    let details: Record<string, unknown> = {};

    if (exception instanceof DomainError) {
      status = exception.httpStatus;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        code = 'VALIDATION_ERROR';
        message = 'Validation failed';
        details = { errors: body.message };
      } else {
        code = exception.name.replace(/Exception$/, '').toUpperCase();
        message = body.message ?? exception.message;
      }
    } else {
      this.logger.error(`${request.method} ${request.url}`, exception);
    }

    response.status(status).json({
      statusCode: status,
      error: { code, message, details },
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
