import { BadGatewayException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';

type FetchJsonOptions = {
  baseUrl: string;
  path: string;
};

type RequestJsonOptions = FetchJsonOptions & {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

function normalizeBaseUrl(url: string) {
  return String(url || '').trim().replace(/^"+|"+$/g, '').replace(/\/+$/, '');
}

function withIpv4Localhost(url: string) {
  return url.replace('://localhost', '://127.0.0.1');
}

function candidateBaseUrls(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return [];
  if (normalized.includes('://localhost')) {
    return [normalized, withIpv4Localhost(normalized)];
  }
  return [normalized];
}

export async function requestIntegrationJson({
  baseUrl,
  path,
  method = 'GET',
  body,
  headers,
}: RequestJsonOptions) {
  const candidates = candidateBaseUrls(baseUrl);
  if (candidates.length === 0) {
    throw new ServiceUnavailableException('INTEGRATION_SERVICE_URL is not configured.');
  }

  let lastError: unknown = null;
  for (const candidate of candidates) {
    const url = `${candidate}${path.startsWith('/') ? path : `/${path}`}`;
    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(headers || {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        const message = `Integration service error (${response.status})${bodyText ? `: ${bodyText}` : ''}`;
        if (response.status >= 400 && response.status < 500) {
          throw new BadRequestException(message);
        }
        throw new BadGatewayException(message);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (error instanceof BadRequestException || error instanceof BadGatewayException) {
        throw error;
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'fetch failed';
  throw new ServiceUnavailableException(
    `Unable to reach integration service. Check INTEGRATION_SERVICE_URL and integration-service status. Root cause: ${message}`,
  );
}

export async function fetchIntegrationJson(options: FetchJsonOptions) {
  return requestIntegrationJson({ ...options, method: 'GET' });
}

export async function postIntegrationJson({
  baseUrl,
  path,
  body,
}: FetchJsonOptions & { body: unknown }) {
  return requestIntegrationJson({ baseUrl, path, method: 'POST', body });
}
