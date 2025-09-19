// AI Provider Configuration
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { perplexity } from '@ai-sdk/perplexity';
import type { LanguageModelV1 } from '@ai-sdk/provider';

export const AI_MODELS = {
  // OpenAI Models
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Advanced multimodal model with vision and reasoning',
    provider: 'openai',
    maxTokens: 128000,
    supportsVision: true,
    supportsReasoning: false,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Faster, cost-effective version of GPT-4o',
    provider: 'openai',
    maxTokens: 128000,
    supportsVision: true,
    supportsReasoning: false,
  },
  'o1-preview': {
    id: 'o1-preview',
    name: 'o1-preview',
    description: 'Advanced reasoning model (preview)',
    provider: 'openai',
    maxTokens: 128000,
    supportsVision: false,
    supportsReasoning: true,
  },
  'o1-mini': {
    id: 'o1-mini',
    name: 'o1-mini',
    description: 'Faster reasoning model',
    provider: 'openai',
    maxTokens: 65536,
    supportsVision: false,
    supportsReasoning: true,
  },

  // Anthropic Models
  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description: 'Most capable Claude model with enhanced reasoning',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsVision: true,
    supportsReasoning: true,
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    description: 'Fast and efficient Claude model',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsVision: true,
    supportsReasoning: false,
  },

  // Google Models
  'gemini-2.0-flash-exp': {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    description: 'Fast multimodal model with enhanced capabilities',
    provider: 'google',
    maxTokens: 1000000,
    supportsVision: true,
    supportsReasoning: true,
  },
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Balanced speed and capability',
    provider: 'google',
    maxTokens: 1000000,
    supportsVision: true,
    supportsReasoning: false,
  },
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'Most capable Gemini model',
    provider: 'google',
    maxTokens: 2000000,
    supportsVision: true,
    supportsReasoning: false,
  },

  // Perplexity Models
  'llama-3.1-sonar-large-128k-online': {
    id: 'llama-3.1-sonar-large-128k-online',
    name: 'Llama 3.1 Sonar Large (Online)',
    description: 'Large model with real-time web search',
    provider: 'perplexity',
    maxTokens: 127072,
    supportsVision: false,
    supportsReasoning: false,
  },
  'llama-3.1-sonar-small-128k-online': {
    id: 'llama-3.1-sonar-small-128k-online',
    name: 'Llama 3.1 Sonar Small (Online)',
    description: 'Efficient model with real-time web search',
    provider: 'perplexity',
    maxTokens: 127072,
    supportsVision: false,
    supportsReasoning: false,
  },
} as const;

export type ModelId = keyof typeof AI_MODELS;

export function getModel(modelId: ModelId): LanguageModelV1 {
  const modelConfig = AI_MODELS[modelId];

  switch (modelConfig.provider) {
    case 'openai':
      return openai(modelId);
    case 'anthropic':
      return anthropic(modelId);
    case 'google':
      return google(modelId);
    case 'perplexity':
      return perplexity(modelId);
    default:
      throw new Error(`Unsupported provider: ${modelConfig.provider}`);
  }
}

export function getDefaultModel(): ModelId {
  return 'gpt-4o-mini';
}

export function getModelsByProvider() {
  const providers: Record<string, Array<(typeof AI_MODELS)[ModelId]>> = {};

  Object.values(AI_MODELS).forEach((model) => {
    if (!providers[model.provider]) {
      providers[model.provider] = [];
    }
    providers[model.provider].push(model);
  });

  return providers;
}

export function isModelSupported(modelId: string): modelId is ModelId {
  return modelId in AI_MODELS;
}

export function getModelConfig(modelId: ModelId) {
  return AI_MODELS[modelId];
}

// Provider-specific configuration helpers
export function getAnthropicConfig(modelId: ModelId) {
  const model = AI_MODELS[modelId];
  if (model.provider !== 'anthropic') return undefined;

  return {
    // Enable thinking for Claude models that support reasoning
    thinking: model.supportsReasoning
      ? { type: 'enabled' as const, budgetTokens: 12000 }
      : undefined,
  };
}

export function getGoogleConfig(modelId: ModelId) {
  const model = AI_MODELS[modelId];
  if (model.provider !== 'google') return undefined;

  return {
    // Enable thinking for Gemini models that support reasoning
    thinkingConfig: model.supportsReasoning
      ? {
          thinkingBudget: 2048,
          includeThoughts: true,
        }
      : undefined,
  };
}

export function getOpenAIConfig(modelId: ModelId) {
  const model = AI_MODELS[modelId];
  if (model.provider !== 'openai') return undefined;

  return {
    // Enable reasoning effort for o1 models
    reasoningEffort: model.supportsReasoning ? ('high' as const) : undefined,
  };
}
