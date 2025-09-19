'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  format,
  isToday,
  isYesterday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  CalendarIcon,
  ClockIcon,
  FolderIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from 'lucide-react';
import useSWR from 'swr';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ChatHistoryItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message: {
    content: string;
    is_user_message: boolean;
    created_at: string;
  } | null;
}

interface ChatHistorySidebarProps {
  currentChatId?: string;
  className?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function ChatHistorySidebar({
  currentChatId,
  className,
}: ChatHistorySidebarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  // Fetch chat history
  const {
    data: historyData,
    error,
    mutate,
  } = useSWR<{
    success: boolean;
    data: ChatHistoryItem[];
    pagination: { limit: number; offset: number; has_more: boolean };
  }>('/api/chat/history?limit=100', fetcher);

  const chatHistory = useMemo(
    () => historyData?.data || [],
    [historyData?.data]
  );

  // Filter chats based on search query
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chatHistory;

    const query = searchQuery.toLowerCase();
    return chatHistory.filter(
      (chat) =>
        chat.title?.toLowerCase().includes(query) ||
        chat.last_message?.content?.toLowerCase().includes(query)
    );
  }, [searchQuery, chatHistory]);

  // Group chats by time periods
  const groupedChats = useMemo(() => {
    const now = new Date();
    // const yesterday = subDays(now, 1);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    const groups = {
      today: [] as ChatHistoryItem[],
      yesterday: [] as ChatHistoryItem[],
      thisWeek: [] as ChatHistoryItem[],
      thisMonth: [] as ChatHistoryItem[],
      older: [] as ChatHistoryItem[],
    };

    filteredChats.forEach((chat) => {
      const chatDate = new Date(chat.updated_at);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate >= weekStart) {
        groups.thisWeek.push(chat);
      } else if (chatDate >= monthStart) {
        groups.thisMonth.push(chat);
      } else {
        groups.older.push(chat);
      }
    });

    return groups;
  }, [filteredChats]);

  const handleChatClick = (chatId: string) => {
    router.push(`/chat/${chatId}`);
  };

  const handleNewChat = () => {
    router.push('/');
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chat/history?id=${chatId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh the chat history
        mutate();

        // If we're deleting the current chat, redirect to home
        if (currentChatId === chatId) {
          router.push('/');
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const confirmDelete = (chatId: string) => {
    setChatToDelete(chatId);
    setDeleteDialogOpen(true);
  };

  const formatRelativeTime = (date: string) => {
    const chatDate = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - chatDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(chatDate, 'MMM dd');
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const renderChatGroup = (
    title: string,
    chats: ChatHistoryItem[],
    icon: React.ReactNode
  ) => {
    if (chats.length === 0) return null;

    return (
      <div key={title} className="mb-4">
        <div className="text-muted-foreground flex items-center gap-2 px-2 py-1 text-xs font-medium tracking-wide uppercase">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-auto text-xs">
            {chats.length}
          </Badge>
        </div>
        <div className="space-y-1">
          {chats.map((chat) => (
            <Card
              key={chat.id}
              className={cn(
                'hover:bg-muted/50 cursor-pointer p-3 transition-colors',
                currentChatId === chat.id && 'bg-muted border-primary'
              )}
              onClick={() => handleChatClick(chat.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <MessageSquareIcon className="text-muted-foreground h-3 w-3 flex-shrink-0" />
                    <h4 className="truncate text-sm font-medium">
                      {chat.title || 'Untitled Chat'}
                    </h4>
                  </div>

                  {chat.last_message && (
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                      {chat.last_message.is_user_message ? 'You: ' : 'AI: '}
                      {truncateText(chat.last_message.content)}
                    </p>
                  )}

                  <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                    <ClockIcon className="h-3 w-3" />
                    {formatRelativeTime(chat.updated_at)}
                    <span>•</span>
                    <span>{chat.message_count} messages</span>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontalIcon className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDelete(chat.id);
                      }}
                      className="text-red-600 focus:text-red-600"
                    >
                      <TrashIcon className="mr-2 h-4 w-4" />
                      Delete Chat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className={cn('bg-muted/20 w-80 border-r', className)}>
        <div className="text-muted-foreground p-4 text-center">
          Failed to load chat history
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cn('bg-muted/20 flex w-80 flex-col border-r', className)}>
        {/* Header */}
        <div className="border-b p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Chat History</h2>
            <Button size="sm" onClick={handleNewChat} className="h-8 w-8 p-0">
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8"
            />
          </div>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-4">
            {chatHistory.length === 0 ? (
              <div className="py-8 text-center">
                <MessageSquareIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h3 className="mb-2 font-medium">No chats yet</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  Start a conversation to see your chat history here
                </p>
                <Button onClick={handleNewChat} size="sm">
                  Start New Chat
                </Button>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="py-8 text-center">
                <SearchIcon className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                <p className="text-muted-foreground text-sm">
                  No chats found matching &quot;{searchQuery}&quot;
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {renderChatGroup(
                  'Today',
                  groupedChats.today,
                  <ClockIcon className="h-3 w-3" />
                )}
                {renderChatGroup(
                  'Yesterday',
                  groupedChats.yesterday,
                  <ClockIcon className="h-3 w-3" />
                )}
                {renderChatGroup(
                  'This Week',
                  groupedChats.thisWeek,
                  <CalendarIcon className="h-3 w-3" />
                )}
                {renderChatGroup(
                  'This Month',
                  groupedChats.thisMonth,
                  <CalendarIcon className="h-3 w-3" />
                )}
                {renderChatGroup(
                  'Older',
                  groupedChats.older,
                  <FolderIcon className="h-3 w-3" />
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this chat? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (chatToDelete) {
                  handleDeleteChat(chatToDelete);
                  setChatToDelete(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
