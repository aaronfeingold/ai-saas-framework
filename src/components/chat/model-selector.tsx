'use client';

import { useState } from 'react';

import {
  BrainIcon,
  ChevronDownIcon,
  GlobeIcon,
  SparklesIcon,
  ZapIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AI_MODELS,
  type ModelId,
  getModelsByProvider,
} from '@/lib/ai/providers';

interface ModelSelectorProps {
  selectedModel: ModelId;
  onModelSelect: (modelId: ModelId) => void;
  disabled?: boolean;
}

export function ModelSelector({
  selectedModel,
  onModelSelect,
  disabled = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const modelsByProvider = getModelsByProvider();
  const currentModel = AI_MODELS[selectedModel];

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'openai':
        return <SparklesIcon className="h-4 w-4" />;
      case 'anthropic':
        return <BrainIcon className="h-4 w-4" />;
      case 'google':
        return <ZapIcon className="h-4 w-4" />;
      case 'perplexity':
        return <GlobeIcon className="h-4 w-4" />;
      default:
        return <SparklesIcon className="h-4 w-4" />;
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'openai':
        return 'OpenAI';
      case 'anthropic':
        return 'Anthropic';
      case 'google':
        return 'Google';
      case 'perplexity':
        return 'Perplexity';
      default:
        return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
  };

  const formatTokenCount = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 justify-between font-normal"
        >
          <div className="flex items-center gap-2">
            {getProviderIcon(currentModel.provider)}
            <span className="max-w-[120px] truncate">{currentModel.name}</span>
          </div>
          <ChevronDownIcon className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Select AI Model</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {Object.entries(modelsByProvider).map(([provider, models]) => (
          <DropdownMenuGroup key={provider}>
            <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
              {getProviderName(provider)}
            </DropdownMenuLabel>
            {models.map((model) => (
              <DropdownMenuItem
                key={model.id}
                onClick={() => {
                  onModelSelect(model.id as ModelId);
                  setOpen(false);
                }}
                className="flex flex-col items-start space-y-1 p-3"
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getProviderIcon(model.provider)}
                    <span className="font-medium">{model.name}</span>
                    {model.id === selectedModel && (
                      <Badge variant="secondary" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {model.supportsVision && (
                      <Badge variant="outline" className="text-xs">
                        Vision
                      </Badge>
                    )}
                    {model.supportsReasoning && (
                      <Badge variant="outline" className="text-xs">
                        Reasoning
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-muted-foreground line-clamp-2 text-xs">
                  {model.description}
                </p>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <span>{formatTokenCount(model.maxTokens)} tokens</span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
