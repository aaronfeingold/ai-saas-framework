import { type PromptSource, renderPrompt } from '../../src/prompts.js';

/** Prompts held in a map, for tests. Version is the template's length. */
export function memoryPrompts(templates: Record<string, string> = {}): PromptSource {
  return {
    async get(name, vars = {}) {
      const template = templates[name];
      if (template === undefined) throw new Error(`No such prompt: ${name}`);
      return {
        name,
        text: renderPrompt(template, vars),
        version: String(template.length),
        source: 'file',
      };
    },
  };
}
