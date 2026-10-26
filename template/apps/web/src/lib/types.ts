import type { Message } from '@/lib/db/schema';

export interface ChatMessage extends Message {
  reasoning?: string;
  toolInvocations?: ToolInvocation[];
}

export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  state: 'call' | 'result' | 'error';
}

export interface Attachment {
  name: string;
  type: string;
  url: string;
  size?: number;
}

export interface ChatConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  autoSave: boolean;
  defaultModel: string;
}

// Utility types
export type ChatStatus = 'idle' | 'loading' | 'streaming' | 'error';
export type MessageRole = 'user' | 'assistant' | 'system';
export type ModelProvider = 'anthropic' | 'openai' | 'custom';
