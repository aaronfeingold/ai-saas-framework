import type { PromptSource, ResolvedPrompt } from './prompts.js';
import type { BaseCtx } from './types.js';

/**
 * Instructions, and the tools that go with them, switched on for a situation. A skill
 * changes how an agent behaves; it is not a separate loop. The application decides when a
 * skill applies, from facts it can check, so behaviour stays predictable.
 */
export type Skill<C extends BaseCtx> = {
  id: string;
  /** The prompt holding this skill's instructions. */
  promptName: string;
  /** Whether the skill is in force for this turn, and the values its prompt is filled with. */
  applies(ctx: C): Promise<{ active: boolean; facts?: Record<string, string | number> }>;
};

export type ActiveSkill = { id: string; prompt: ResolvedPrompt };

/**
 * The skills in force for one turn, in the order they were declared. A skill that cannot be
 * checked, or whose prompt cannot be filled, is left out and logged: the turn carries on
 * with what it has.
 */
export async function resolveSkills<C extends BaseCtx>(
  skills: Skill<C>[],
  ctx: C,
  prompts: PromptSource,
): Promise<ActiveSkill[]> {
  const resolved = await Promise.all(
    skills.map(async (skill): Promise<ActiveSkill | null> => {
      try {
        const { active, facts } = await skill.applies(ctx);
        if (!active) return null;
        return { id: skill.id, prompt: await prompts.get(skill.promptName, facts) };
      } catch (err) {
        ctx.logger.warn({ err, skill: skill.id }, 'skill could not be resolved; continuing');
        return null;
      }
    }),
  );
  return resolved.filter((s): s is ActiveSkill => s !== null);
}

/**
 * What produced a model call, for its trace: the agent, the skills in force and the exact
 * prompt versions. Spread `runtimeContext` into the call and `include` into its telemetry
 * options; the SDK puts only the named keys on the span.
 */
export function traceLabels(
  agent: string,
  core: ResolvedPrompt,
  skills: ActiveSkill[],
  extra: Record<string, string> = {},
) {
  const runtimeContext: Record<string, string> = {
    agent,
    skills: skills.map((s) => s.id).join(','),
    prompts: [core, ...skills.map((s) => s.prompt)].map((p) => `${p.name}@${p.version}`).join(','),
    ...extra,
  };
  const include = Object.fromEntries(Object.keys(runtimeContext).map((k) => [k, true as const]));
  return { runtimeContext, include };
}

/**
 * One turn's instructions. The core prompt goes first and never varies, so provider prompt
 * caching applies; then the skills in force; then what the application knows about the
 * person; then the summary of earlier conversation.
 */
export function assembleInstructions(parts: {
  core: string;
  skills: ActiveSkill[];
  context: string[];
  summary: string | null;
}): string {
  return [
    parts.core,
    ...parts.skills.map((s) => s.prompt.text),
    ...parts.context,
    parts.summary ? `## Earlier in this conversation\n${parts.summary}` : null,
  ]
    .filter((section): section is string => Boolean(section))
    .join('\n\n');
}
