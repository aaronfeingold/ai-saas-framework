import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/index.js';

describe('createLogger error serialisation', () => {
  it('logs what an error is, and never the request or response it carried', () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: 'info',
      destination: { write: (l: string) => lines.push(l) },
    });

    const inner = Object.assign(new Error('inner failure'), {
      requestBodyValues: { input: [{ image: 'BASE64-PHOTO-BYTES' }] },
      responseBody: 'RAW-PROVIDER-BODY',
    });
    const err = Object.assign(new Error('No object generated'), {
      name: 'AI_NoObjectGeneratedError',
      text: '{"wines":[{"rawText":"SECRET-ENTRY-TEXT"}]}',
      response: { body: 'RAW-RESPONSE' },
      statusCode: 429,
      finishReason: 'length',
      cause: inner,
      errors: [inner],
      lastError: inner,
    });
    logger.error({ err, documentId: 'd1' }, 'could not read document');

    const out = lines.join('');
    for (const secret of [
      'BASE64-PHOTO-BYTES',
      'RAW-PROVIDER-BODY',
      'SECRET-ENTRY-TEXT',
      'RAW-RESPONSE',
    ]) {
      expect(out, secret).not.toContain(secret);
    }
    const logged = JSON.parse(out) as { err: Record<string, unknown>; documentId: string };
    expect(logged.documentId).toBe('d1');
    expect(logged.err).toMatchObject({
      type: 'AI_NoObjectGeneratedError',
      message: 'No object generated',
      statusCode: 429,
      finishReason: 'length',
      cause: 'inner failure',
    });
    expect(typeof logged.err.stack).toBe('string');
  });

  it('copes with a thrown value that is not an Error', () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: 'info',
      destination: { write: (l: string) => lines.push(l) },
    });
    logger.error({ err: 'just a string' }, 'odd');
    expect(JSON.parse(lines[0] as string).err).toMatchObject({ message: 'just a string' });
  });
});
