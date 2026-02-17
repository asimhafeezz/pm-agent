import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';

type FetchJsonOptions = {
  baseUrl: string;
  path: string;
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

export async function fetchIntegrationJson({ baseUrl, path }: FetchJsonOptions) {
  const candidates = candidateBaseUrls(baseUrl);
  if (candidates.length === 0) {
    throw new ServiceUnavailableException('INTEGRATION_SERVICE_URL is not configured.');
  }

  let lastError: unknown = null;
  for (const candidate of candidates) {
    const url = `${candidate}${path.startsWith('/') ? path : `/${path}`}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new BadGatewayException(
          `Integration service error (${response.status})${bodyText ? `: ${bodyText}` : ''}`,
        );
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (error instanceof BadGatewayException) {
        throw error;
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'fetch failed';
  throw new ServiceUnavailableException(
    `Unable to reach integration service. Check INTEGRATION_SERVICE_URL and integration-service status. Root cause: ${message}`,
  );
}

