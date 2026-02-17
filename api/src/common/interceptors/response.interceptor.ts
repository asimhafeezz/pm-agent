import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data: any) => {
        if (data && typeof data === 'object' && 'success' in data && 'message' in data) {
          return data;
        }
        return {
          success: true,
          message: 'Success',
          data,
        };
      }),
    );
  }
}
