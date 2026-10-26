import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type PromptSource, renderPrompt } from '@ai-saas/agent-kit';

const here = path.dirname(fileURLToPath(import.meta.url));
/** `apps/api/prompts`: two folders up from source, three from the build output. */
export const PROMPTS_DIR =
  ['../../prompts', '../../../prompts']
    .map((up) => path.resolve(here, up))
    .find((dir) => existsSync(dir)) ?? path.resolve(here, '../../prompts');

const NAME = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;

/**
 * Prompts are Markdown files, never strings in code: `assistant/core` is `prompts/assistant/core.md`.
 * Each is read once; its version is a hash of its text, so traces name the exact prompt.
 */
export function createFilePromptSource(dir: string = PROMPTS_DIR): PromptSource {
  const cache = new Map<string, Promise<{ template: string; version: string }>>();
  const load = (name: string) => {
    if (!NAME.test(name)) return Promise.reject(new Error(`Not a prompt name: ${name}`));
    let entry = cache.get(name);
    if (!entry) {
      entry = readFile(path.join(dir, `${name}.md`), 'utf8').then((file) => {
        const template = file.replace(/\n+$/, '');
        const version = createHash('sha256').update(template).digest('hex').slice(0, 12);
        return { template, version };
      });
      entry.catch(() => cache.delete(name));
      cache.set(name, entry);
    }
    return entry;
  };
  return {
    async get(name, vars = {}) {
      const { template, version } = await load(name);
      return { name, text: renderPrompt(template, vars), version, source: 'file' };
    },
  };
}
