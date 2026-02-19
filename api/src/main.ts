import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ValidationError } from 'class-validator';
import { HttpExceptionFilter, ValidationExceptionFilter } from './common/filters';
import { ValidationException } from './common/exceptions';
import { SanitizeValidationPipe } from './common/pipelines';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '60mb' }));
  app.use(helmet());
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
  
  app.setGlobalPrefix('api');
  
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(Number.isNaN(port) ? 3000 : port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
