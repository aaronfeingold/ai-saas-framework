export const DEFAULT_CHAT_MODEL: string = 'claude-3-5-sonnet-20241022';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
  provider: 'anthropic' | 'openai' | 'custom';
  contextWindow: number;
  pricing?: {
    input: number;
    output: number;
  };
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description: 'Most intelligent model for complex reasoning and analysis',
    provider: 'anthropic',
    contextWindow: 200000,
    pricing: {
      input: 3.0,
      output: 15.0,
    },
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    description: 'Fast and efficient model for quick tasks',
    provider: 'anthropic',
    contextWindow: 200000,
    pricing: {
      input: 1.0,
      output: 5.0,
    },
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: 'Most capable model for complex tasks',
    provider: 'anthropic',
    contextWindow: 200000,
    pricing: {
      input: 15.0,
      output: 75.0,
    },
  },
];

export function getModelById(id: string): ChatModel | undefined {
  return chatModels.find((model) => model.id === id);
}

export function getModelsByProvider(provider: string): ChatModel[] {
  return chatModels.filter((model) => model.provider === provider);
}

export function getDefaultModel(): ChatModel {
  return getModelById(DEFAULT_CHAT_MODEL) || chatModels[0];
}
