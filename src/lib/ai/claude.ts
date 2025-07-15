import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const claudeModels = {
  'claude-3-5-sonnet-20241022': {
    displayName: 'Claude 3.5 Sonnet',
    contextWindow: 200000,
    maxTokens: 8192,
  },
  'claude-3-5-haiku-20241022': {
    displayName: 'Claude 3.5 Haiku',
    contextWindow: 200000,
    maxTokens: 8192,
  },
  'claude-3-opus-20240229': {
    displayName: 'Claude 3 Opus',
    contextWindow: 200000,
    maxTokens: 4096,
  },
} as const

export type ClaudeModel = keyof typeof claudeModels

export const createClaudeCompletion = async (
  model: ClaudeModel,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  options?: {
    maxTokens?: number
    temperature?: number
    stream?: boolean
  }
) => {
  const { maxTokens = 1024, temperature = 0.7, stream = false } = options || {}

  const systemMessage = messages.find(m => m.role === 'system')?.content
  const userMessages = messages.filter(m => m.role !== 'system') as Array<{ role: 'user' | 'assistant'; content: string }>

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: userMessages,
    system: systemMessage,
    stream,
  })

  return response
}

export const createClaudeStreamCompletion = async (
  model: ClaudeModel,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  options?: {
    maxTokens?: number
    temperature?: number
  }
) => {
  const { maxTokens = 1024, temperature = 0.7 } = options || {}

  const systemMessage = messages.find(m => m.role === 'system')?.content
  const userMessages = messages.filter(m => m.role !== 'system') as Array<{ role: 'user' | 'assistant'; content: string }>

  const stream = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: userMessages,
    system: systemMessage,
    stream: true,
  })

  return stream
}

export default anthropic