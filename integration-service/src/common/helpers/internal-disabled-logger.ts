import { LoggerService } from '@nestjs/common';

export class InternalDisabledLogger implements LoggerService {
  log(_message: any, _context?: string) {}
  error(_message: any, _trace?: string, _context?: string) {}
  warn(_message: any, _context?: string) {}
  debug(_message: any, _context?: string) {}
  verbose(_message: any, _context?: string) {}
}
