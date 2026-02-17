import { Injectable, PipeTransform } from '@nestjs/common';

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const sanitizedKey = key.replace(/\$/g, '_').replace(/\./g, '_');
      result[sanitizedKey] = sanitizeValue(val);
    }
    return result;
  }

  return value;
}

@Injectable()
export class SanitizeValidationPipe implements PipeTransform {
  transform(value: unknown) {
    return sanitizeValue(value);
  }
}
