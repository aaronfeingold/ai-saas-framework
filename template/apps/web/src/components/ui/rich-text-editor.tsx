'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  Bold,
  Code,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minHeight?: number;
}

export function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Write your content...',
  className,
  disabled = false,
  minHeight = 200,
}: RichTextEditorProps) {
  const [content, setContent] = useState(value);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    setContent(value);
  }, [value]);

  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      onChange?.(newContent);
    },
    [onChange]
  );

  const insertMarkdown = useCallback(
    (before: string, after = '') => {
      const textarea = document.querySelector(
        'textarea[data-rich-text]'
      ) as HTMLTextAreaElement;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);

      const beforeText = content.substring(0, start);
      const afterText = content.substring(end);

      const newContent = beforeText + before + selectedText + after + afterText;

      handleContentChange(newContent);

      // Set cursor position
      setTimeout(() => {
        textarea.focus();
        const newPosition =
          start + before.length + selectedText.length + after.length;
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);
    },
    [content, handleContentChange]
  );

  const formatButtons = [
    { icon: Bold, label: 'Bold', action: () => insertMarkdown('**', '**') },
    { icon: Italic, label: 'Italic', action: () => insertMarkdown('*', '*') },
    {
      icon: Underline,
      label: 'Underline',
      action: () => insertMarkdown('<u>', '</u>'),
    },
    {
      icon: Strikethrough,
      label: 'Strikethrough',
      action: () => insertMarkdown('~~', '~~'),
    },
    { icon: Code, label: 'Code', action: () => insertMarkdown('`', '`') },
    { icon: Link, label: 'Link', action: () => insertMarkdown('[', '](url)') },
    { icon: List, label: 'Bullet List', action: () => insertMarkdown('\n- ') },
    {
      icon: ListOrdered,
      label: 'Numbered List',
      action: () => insertMarkdown('\n1. '),
    },
    { icon: Quote, label: 'Quote', action: () => insertMarkdown('\n> ') },
  ];

  const renderPreview = (text: string) => {
    // Simple markdown to HTML conversion for preview
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(
        /\[(.*?)\]\((.*?)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      )
      .replace(/^- (.+)/gm, '<ul><li>$1</li></ul>')
      .replace(/^\d+\. (.+)/gm, '<ol><li>$1</li></ol>')
      .replace(/^> (.+)/gm, '<blockquote>$1</blockquote>')
      .replace(/\n/g, '<br>');
  };

  return (
    <div className={cn('overflow-hidden rounded-lg border', className)}>
      {/* Toolbar */}
      <div className="bg-muted/50 border-b px-3 py-2">
        <div className="flex items-center gap-1">
          {formatButtons.map((button, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              onClick={button.action}
              disabled={disabled || isPreview}
              className="h-8 w-8 p-0"
              title={button.label}
            >
              <button.icon className="h-4 w-4" />
            </Button>
          ))}

          <div className="ml-auto">
            <Button
              variant={isPreview ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setIsPreview(!isPreview)}
              disabled={disabled}
            >
              {isPreview ? 'Edit' : 'Preview'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative">
        {isPreview ? (
          <div
            className="prose prose-sm max-w-none p-4"
            style={{ minHeight }}
            dangerouslySetInnerHTML={{ __html: renderPreview(content) }}
          />
        ) : (
          <Textarea
            data-rich-text
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{ minHeight }}
          />
        )}
      </div>

      {/* Character count */}
      <div className="bg-muted/30 text-muted-foreground border-t px-3 py-1 text-right text-xs">
        {content.length} characters
      </div>
    </div>
  );
}
