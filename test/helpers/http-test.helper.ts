import { Response } from 'supertest';

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface HttpLikeError {
  response?: {
    status?: number;
    body?: unknown;
  };
  status?: number;
  message?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getActualStatus(error: unknown): number | null {
  if (!isObject(error)) return null;

  if (
    'response' in error &&
    isObject(error.response) &&
    typeof error.response.status === 'number'
  ) {
    return error.response.status;
  }

  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }

  return null;
}

export function parseApiError(response: Response): ApiErrorResponse {
  const body: unknown = response.body;

  if (!isObject(body)) {
    throw new Error('Response body is not an object.');
  }

  if (typeof body.statusCode !== 'number') {
    throw new Error('Invalid error response: statusCode must be a number.');
  }

  const isMessageValid =
    typeof body.message === 'string' ||
    (Array.isArray(body.message) &&
      body.message.every((item) => typeof item === 'string'));

  if (!isMessageValid) {
    throw new Error('Invalid error response: message is invalid.');
  }

  return {
    statusCode: body.statusCode,
    message: body.message as string | string[],
    error: typeof body.error === 'string' ? body.error : undefined,
  };
}

export function parseApiData<T>(response: Response): T {
  return response.body as T;
}

export function expectErrorMessage(
  response: ApiErrorResponse,
  expectedStatus: number,
  expectedMessage?: string,
): void {
  expect(response.statusCode).toBe(expectedStatus);
  expect(response.message).toBeDefined();

  if (!expectedMessage) return;

  if (Array.isArray(response.message)) {
    expect(response.message.join(' | ')).toContain(expectedMessage);
    return;
  }

  expect(response.message).toContain(expectedMessage);
}
