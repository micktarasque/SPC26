import { HttpRequest, HttpResponseInit } from '@azure/functions';

/**
 * Verify the shared edit PIN sent by the client on write requests.
 * Returns an error response to short-circuit with, or null when authorised.
 */
export function requirePin(request: HttpRequest): HttpResponseInit | null {
  const expected = process.env.EDIT_PIN;
  if (!expected) {
    return json(500, { error: 'EDIT_PIN is not configured on the server.' });
  }
  const provided = request.headers.get('x-edit-pin');
  if (!provided || provided !== expected) {
    return json(401, { error: 'Invalid or missing edit PIN.' });
  }
  return null;
}

/** JSON response helper. */
export function json(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    jsonBody: body,
    headers: { 'Content-Type': 'application/json' },
  };
}

/** Map a thrown error to a 500 JSON response (logging is done by the caller). */
export function fail(err: unknown): HttpResponseInit {
  const message = err instanceof Error ? err.message : 'Unexpected server error.';
  return json(500, { error: message });
}
