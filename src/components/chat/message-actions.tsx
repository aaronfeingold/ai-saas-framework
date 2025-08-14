import { memo } from 'react';

import equal from 'fast-deep-equal';
import { Copy, RefreshCcw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import { useCopyToClipboard } from 'usehooks-ts';

import { Action, Actions } from '@/components/ai-elements/actions';
import { CopyIcon, ThumbDownIcon, ThumbUpIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Vote } from '@/lib/db/schema';
import type { ChatMessage } from '@/lib/types';

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
}) {
  const { mutate } = useSWRConfig();
  const [, copyToClipboard] = useCopyToClipboard();

  if (isLoading) return null;
  if (message.role === 'user') return null;

  return (
    <Actions>
      <Action
        tooltip="Copy message"
        onClick={async () => {
          const textFromParts = message.parts
            ?.filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('\n')
            .trim();

          if (!textFromParts) {
            toast.error("There's no text to copy!");
            return;
          }

          await copyToClipboard(textFromParts);
          toast.success('Copied to clipboard!');
        }}
      >
        <Copy className="size-4" />
      </Action>

      <Action
        tooltip="Upvote Response"
        disabled={vote?.isUpvoted}
        onClick={async () => {
          const upvote = fetch('/api/vote', {
            method: 'PATCH',
            body: JSON.stringify({
              chatId,
              messageId: message.id,
              type: 'up',
            }),
          });

          toast.promise(upvote, {
            loading: 'Upvoting Response...',
            success: () => {
              mutate<Array<Vote>>(
                `/api/vote?chatId=${chatId}`,
                (currentVotes) => {
                  if (!currentVotes) return [];

                  const votesWithoutCurrent = currentVotes.filter(
                    (vote) => vote.messageId !== message.id
                  );

                  return [
                    ...votesWithoutCurrent,
                    {
                      chatId,
                      messageId: message.id,
                      isUpvoted: true,
                    },
                  ];
                },
                { revalidate: false }
              );

              return 'Upvoted Response!';
            },
            error: 'Failed to upvote response.',
          });
        }}
      >
        <ThumbsUp className="size-4" />
      </Action>

      <Action
        tooltip="Downvote Response"
        disabled={vote && !vote.isUpvoted}
        onClick={async () => {
          const downvote = fetch('/api/vote', {
            method: 'PATCH',
            body: JSON.stringify({
              chatId,
              messageId: message.id,
              type: 'down',
            }),
          });

          toast.promise(downvote, {
            loading: 'Downvoting Response...',
            success: () => {
              mutate<Array<Vote>>(
                `/api/vote?chatId=${chatId}`,
                (currentVotes) => {
                  if (!currentVotes) return [];

                  const votesWithoutCurrent = currentVotes.filter(
                    (vote) => vote.messageId !== message.id
                  );

                  return [
                    ...votesWithoutCurrent,
                    {
                      chatId,
                      messageId: message.id,
                      isUpvoted: false,
                    },
                  ];
                },
                { revalidate: false }
              );

              return 'Downvoted Response!';
            },
            error: 'Failed to downvote response.',
          });
        }}
      >
        <ThumbsDown className="size-4" />
      </Action>
    </Actions>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;

    return true;
  }
);
