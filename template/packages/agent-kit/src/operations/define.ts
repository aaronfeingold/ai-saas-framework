import type { z } from 'zod';
import { AppError, badRequest } from '../errors.js';
import type { BaseCtx } from '../types.js';

/**
 * One capability of the API, defined once. From this the app generates the REST route, the
 * OpenAPI entry and, when `agentTool` is true, the tool the model can call.
 *
 * `input` is a single flat object. Over HTTP its fields are read from the path (those named
 * in `path`), then the query string for GET and DELETE or the JSON body otherwise. As a tool,
 * the model supplies the whole object. Use `z.coerce` for numbers that may arrive in a query.
 */
// biome-ignore lint/suspicious/noExplicitAny: the registry holds operations of every shape
export type Operation<C extends BaseCtx = any, I = any, O = any> = {
  /** snake_case; the OpenAPI operationId and the tool name. */
  id: string;
  /** Read by API consumers and by the model when choosing a tool. */
  description: string;
  method: 'get' | 'post' | 'patch' | 'delete';
  /** OpenAPI style, e.g. `/api/wines/{id}`. */
  path: string;
  input: z.ZodObject;
  output: z.ZodType<O>;
  agentTool: boolean;
  /** Agent ids that may call this as a tool. Absent means any agent it is handed to. */
  agents?: string[];
  /**
   * The skill, or skills, that switch this tool on: it is offered while any one of them is
   * in force. Absent means it is always on for its agents.
   */
  skill?: string | string[];
  handler: (ctx: C, input: I) => Promise<O>;
};

export function defineOperation<C extends BaseCtx, S extends z.ZodObject, O>(op: {
  id: string;
  description: string;
  method: Operation['method'];
  path: string;
  input: S;
  output: z.ZodType<O>;
  agentTool: boolean;
  agents?: string[];
  skill?: string | string[];
  handler: (ctx: C, input: z.infer<S>) => Promise<O>;
}): Operation<C, z.infer<S>, O> {
  return op;
}

export type ErrorBody = { error: { code: string; message: string } };

/** Validate input, run the handler, and strip the result down to the declared output. */
export async function executeOperation<C extends BaseCtx>(
  op: Operation<C>,
  ctx: C,
  raw: unknown,
): Promise<unknown> {
  const parsed = op.input.safeParse(raw);
  if (!parsed.success) {
    throw badRequest(
      parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '),
    );
  }
  const result = await op.handler(ctx, parsed.data);
  return op.output.parse(result);
}

/** The one place an error becomes a response. Unexpected errors are logged, never echoed. */
export function toErrorResponse(
  err: unknown,
  log: (err: unknown) => void,
): { status: number; body: ErrorBody } {
  if (err instanceof AppError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message } } };
  }
  log(err);
  return { status: 500, body: { error: { code: 'internal', message: 'Something went wrong' } } };
}
