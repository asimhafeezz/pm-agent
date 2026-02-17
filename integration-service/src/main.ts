import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import * as mongoSanitize from 'express-mongo-sanitize';
import { AppModule } from './app.module';
import { ValidationError } from 'class-validator';
import { HttpExceptionFilter, ValidationExceptionFilter } from './common/filters';
import { ValidationException } from './common/exceptions';
import { InternalDisabledLogger } from './common/helpers';
import { SanitizeValidationPipe } from './common/pipelines';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // logger: new InternalDisabledLogger(),
  });
  // console.log('Third-party API keys loaded');
  app.use(
    helmet({
      // contentSecurityPolicy: {
      //   directives: {
      //     defaultSrc: ["'self'"],
      //     scriptSrc: ["'self'", 'trusted-cdn.com'],
      //   },
      // },
    }),
  );
  app.use(
    mongoSanitize({
      replaceWith: '_',
    }),
  );
  app.enableCors();
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new ValidationExceptionFilter(), new HttpExceptionFilter());
  app.useGlobalPipes(
    new SanitizeValidationPipe(),
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors: ValidationError[] | any[]) => new ValidationException(errors),
      validateCustomDecorators: true,
    }),
  );
  app.setGlobalPrefix('integration');
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(Number.isNaN(port) ? 3001 : port);
}
bootstrap();
