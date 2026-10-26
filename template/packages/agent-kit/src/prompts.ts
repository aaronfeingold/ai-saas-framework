/** A prompt as it will be sent, with where it came from. */
export type ResolvedPrompt = {
  name: string;
  text: string;
  /** Identifies the exact text: a content hash for a file, a version number when managed. */
  version: string;
  source: 'file' | 'managed';
};

/**
 * Where prompts come from. The kit never knows whether that is a folder of files or a prompt
 * management service; an application supplies the implementation.
 */
export interface PromptSource {
  /** Resolves the named prompt with `vars` filled in. Rejects when the name is unknown. */
  get(name: string, vars?: Record<string, string | number>): Promise<ResolvedPrompt>;
}

const VARIABLE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/** The names a template expects, sorted and without repeats. */
export function promptVariables(template: string): string[] {
  return [...new Set([...template.matchAll(VARIABLE)].map((m) => m[1] as string))].sort();
}

/**
 * Fill `{{name}}` placeholders. Every placeholder must have a value: a prompt sent with a
 * hole in it is worse than no prompt. Values are inserted as they are and never re-read as
 * templates.
 */
export function renderPrompt(template: string, vars: Record<string, string | number>): string {
  const missing = promptVariables(template).filter((name) => !(name in vars));
  if (missing.length > 0) {
    throw new Error(`Prompt is missing a value for: ${missing.join(', ')}`);
  }
  return template.replace(VARIABLE, (_, name: string) => String(vars[name]));
}
