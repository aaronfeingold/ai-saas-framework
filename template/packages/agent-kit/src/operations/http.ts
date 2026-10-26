import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import type { BaseCtx, KitEnv } from '../types.js';
import { executeOperation, type Operation, toErrorResponse } from './define.js';

const ErrorSchema = z
  .object({ error: z.object({ code: z.string(), message: z.string() }) })
  .openapi('Error');

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ErrorSchema } },
});

const pathParams = (path: string) => [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string);

const invalidInput = (message: string) => ({ error: { code: 'invalid_input', message } });

/**
 * An OpenAPIHono app that answers every failure in the API's error shape: validation
 * failures, `AppError`s thrown by any route, malformed requests, unknown paths, and
 * unexpected errors (which are reported to `onUnexpectedError` and never echoed).
 */
export function createOpenApiApp<C extends BaseCtx>(
  opts: { onUnexpectedError?: (err: unknown, path: string) => void } = {},
) {
  const app = new OpenAPIHono<KitEnv<C>>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const message = result.error.issues
          .map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
          .join('; ');
        return c.json(invalidInput(message), 400);
      }
    },
  });
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  app.onError((err, c) => {
    if (err instanceof HTTPException && err.status === 400) {
      return c.json(invalidInput('Malformed request'), 400);
    }
    const { status, body } = toErrorResponse(err, (e) => opts.onUnexpectedError?.(e, c.req.path));
    return c.json(body, status as 500);
  });
  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404));

  return app;
}

/** Register one route, with its OpenAPI entry, for every operation. */
export function mountOperations<C extends BaseCtx>(
  app: OpenAPIHono<KitEnv<C>>,
  operations: Operation<C>[],
): void {
  for (const op of operations) {
    const inPath = pathParams(op.path);
    const rest = Object.keys(op.input.shape).filter((k) => !inPath.includes(k));
    const pick = (keys: string[]) =>
      op.input.pick(Object.fromEntries(keys.map((k) => [k, true])) as never);
    const inQuery = op.method === 'get' || op.method === 'delete';

    const request: Record<string, unknown> = {};
    if (inPath.length > 0) request.params = pick(inPath);
    if (rest.length > 0) {
      const schema = pick(rest);
      if (inQuery) request.query = schema;
      else {
        request.body = {
          required: !schema.safeParse({}).success,
          content: { 'application/json': { schema } },
        };
      }
    }

    const route = createRoute({
      operationId: op.id,
      description: op.description,
      method: op.method,
      path: op.path,
      security: [{ bearerAuth: [] }],
      request: request as never,
      responses: {
        200: { description: 'Success', content: { 'application/json': { schema: op.output } } },
        400: errorResponse('Invalid input'),
        401: errorResponse('Authentication required'),
        404: errorResponse('Not found'),
      },
    });

    app.openapi(route, (async (c: {
      get: (k: 'ctx') => C;
      req: { valid: (part: string) => unknown };
      json: (body: unknown, status?: number) => Response;
    }) => {
      const ctx = c.get('ctx');
      const raw = {
        ...(rest.length > 0 ? (c.req.valid(inQuery ? 'query' : 'json') as object) : {}),
        ...(inPath.length > 0 ? (c.req.valid('param') as object) : {}),
      };
      try {
        return c.json(await executeOperation(op, ctx, raw), 200);
      } catch (err) {
        const { status, body } = toErrorResponse(err, (e) =>
          ctx.logger.error({ err: e, operation: op.id }, 'operation failed unexpectedly'),
        );
        return c.json(body, status);
      }
    }) as never);
  }
}

/** The `info` block of the OpenAPI document; the application names and describes itself. */
export type OpenApiInfo = { title: string; version: string; description?: string };

export function buildOpenApiDocument(operations: Operation[], info: OpenApiInfo): object {
  const app = createOpenApiApp();
  mountOperations(app, operations);
  return app.getOpenAPI31Document({ openapi: '3.1.0', info });
}
