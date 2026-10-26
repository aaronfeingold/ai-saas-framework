import type { ChatModel } from './models';

export type UserType = 'guest' | 'free' | 'pro' | 'enterprise';

interface Entitlements {
  maxMessagesPerDay: number;
  maxTokensPerMessage: number;
  availableChatModelIds: Array<ChatModel['id']>;
  canUploadFiles: boolean;
  canUseRAG: boolean;
  maxFileSize: number; // in MB
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  guest: {
    maxMessagesPerDay: 10,
    maxTokensPerMessage: 4000,
    availableChatModelIds: ['claude-3-5-haiku-20241022'],
    canUploadFiles: false,
    canUseRAG: false,
    maxFileSize: 0,
  },

  free: {
    maxMessagesPerDay: 50,
    maxTokensPerMessage: 8000,
    availableChatModelIds: [
      'claude-3-5-haiku-20241022',
      'claude-3-5-sonnet-20241022',
    ],
    canUploadFiles: true,
    canUseRAG: false,
    maxFileSize: 10,
  },

  pro: {
    maxMessagesPerDay: 500,
    maxTokensPerMessage: 16000,
    availableChatModelIds: [
      'claude-3-5-haiku-20241022',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
    ],
    canUploadFiles: true,
    canUseRAG: true,
    maxFileSize: 50,
  },

  enterprise: {
    maxMessagesPerDay: -1, // unlimited
    maxTokensPerMessage: 32000,
    availableChatModelIds: [
      'claude-3-5-haiku-20241022',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
    ],
    canUploadFiles: true,
    canUseRAG: true,
    maxFileSize: 100,
  },
};

export function getUserEntitlements(userType: UserType): Entitlements {
  return entitlementsByUserType[userType];
}

export function canUseModel(userType: UserType, modelId: string): boolean {
  const entitlements = getUserEntitlements(userType);
  return entitlements.availableChatModelIds.includes(modelId);
}

export function hasReachedDailyLimit(
  userType: UserType,
  messagesUsedToday: number
): boolean {
  const entitlements = getUserEntitlements(userType);
  return (
    entitlements.maxMessagesPerDay !== -1 &&
    messagesUsedToday >= entitlements.maxMessagesPerDay
  );
}
