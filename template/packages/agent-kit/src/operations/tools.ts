import { jsonSchema, type ToolSet, tool } from 'ai';
import { z } from 'zod';
import type { BaseCtx } from '../types.js';
import { executeOperation, type Operation, toErrorResponse } from './define.js';

/** Who is asking for tools, and which skills are in force this turn. Both must be stated. */
export type ToolScope = { agentId: string; activeSkillIds: string[] };

const allowedFor = (op: Operation, agentId: string) =>
  op.agentTool && (!op.agents || op.agents.includes(agentId));
const switchedOn = (op: Operation, active: string[]) =>
  !op.skill || [op.skill].flat().some((skill) => active.includes(skill));

/**
 * The model-callable subset of the registry for one agent and one turn, bound to one user's
 * context. An operation is offered when it is flagged as a tool, the agent is one it lists
 * (or it lists none), and one of its skills is in force (or it names none). A tool never
 * throws: failures come back as `{ error: { code, message } }` so the model can recover.
 */
export function buildTools<C extends BaseCtx>(
  operations: Operation<C>[],
  ctx: C,
  scope: ToolScope,
  onCall?: (tool: string, failed: boolean) => void,
): ToolSet {
  // A missing scope must never mean "every tool".
  if (typeof scope?.agentId !== 'string' || !Array.isArray(scope.activeSkillIds)) {
    throw new Error('buildTools needs a scope: the agent asking and the skills in force');
  }
  const tools: ToolSet = {};
  for (const op of operations) {
    if (!allowedFor(op, scope.agentId) || !switchedOn(op, scope.activeSkillIds)) continue;
    tools[op.id] = tool({
      description: op.description,
      // The model sees the JSON Schema; validation happens in executeOperation so that bad
      // arguments come back in the API's own error shape rather than as an SDK exception.
      inputSchema: jsonSchema(z.toJSONSchema(op.input, { io: 'input' }) as never),
      execute: async (args: unknown, options?: { abortSignal?: AbortSignal }) => {
        try {
          // The handler is told when the turn or run it belongs to is cut short.
          const callCtx = options?.abortSignal ? { ...ctx, abortSignal: options.abortSignal } : ctx;
          const result = await executeOperation(op, callCtx, args);
          onCall?.(op.id, false);
          return result;
        } catch (err) {
          onCall?.(op.id, true);
          return toErrorResponse(err, (e) =>
            ctx.logger.error({ err: e, tool: op.id }, 'tool failed unexpectedly'),
          ).body;
        }
      },
    });
  }
  return tools;
}
