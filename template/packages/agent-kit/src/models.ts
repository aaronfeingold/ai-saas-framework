import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

export type ModelResolver = (spec: string) => LanguageModel;

export type ModelProviders = {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  /**
   * Any server that speaks the OpenAI chat completions API: a self-hosted open-weight model
   * behind Hugging Face Inference Endpoints, vLLM, Ollama and the like.
   */
  compatible?: { baseURL: string; apiKey?: string };
};

const FORMS = '"openai:<id>", "anthropic:<id>" or "compatible:<id>"';

/**
 * Turn "provider:model-id" into a model. Providers are created once per resolver.
 * A model is only contacted when a turn uses it, so a missing key surfaces on first use.
 */
export function createModelResolver(config: ModelProviders): ModelResolver {
  const openai = createOpenAI({ apiKey: config.openaiApiKey });
  const anthropic = createAnthropic({ apiKey: config.anthropicApiKey });
  const compatible = config.compatible
    ? createOpenAICompatible({
        name: 'compatible',
        baseURL: config.compatible.baseURL,
        apiKey: config.compatible.apiKey,
      })
    : undefined;

  return (spec) => {
    const separator = spec.indexOf(':');
    const provider = spec.slice(0, separator);
    const modelId = spec.slice(separator + 1);
    if (separator < 1 || !modelId) throw new Error(`Unknown model "${spec}": expected ${FORMS}`);

    switch (provider) {
      case 'openai':
        return openai(modelId);
      case 'anthropic':
        return anthropic(modelId);
      case 'compatible':
        if (!compatible) {
          throw new Error(`Model "${spec}" needs an OpenAI-compatible base URL to be configured`);
        }
        return compatible(modelId);
      default:
        throw new Error(`Unknown model "${spec}": expected ${FORMS}`);
    }
  };
}
