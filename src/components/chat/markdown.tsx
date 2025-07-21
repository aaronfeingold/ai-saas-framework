'use client';

import { memo } from 'react';

import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

interface MarkdownProps {
  children: string;
  className?: string;
}

function PureMarkdown({ children, className }: MarkdownProps) {
  return (
    <ReactMarkdown
      className={`prose prose-neutral dark:prose-invert max-w-none ${className || ''}`}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeHighlight]}
      components={{
        code({ inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <pre className={className} {...props}>
              <code>{String(children).replace(/\n$/, '')}</code>
            </pre>
          ) : (
            <code
              className="bg-muted rounded px-1 py-0.5 font-mono text-sm"
              {...props}
            >
              {children}
            </code>
          );
        },
        pre({ children, ...props }) {
          return (
            <pre
              className="bg-muted overflow-x-auto rounded-lg border p-4"
              {...props}
            >
              {children}
            </pre>
          );
        },
        table({ children, ...props }) {
          return (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse" {...props}>
                {children}
              </table>
            </div>
          );
        },
        th({ children, ...props }) {
          return (
            <th
              className="border-border bg-muted/50 border px-4 py-2 text-left font-medium"
              {...props}
            >
              {children}
            </th>
          );
        },
        td({ children, ...props }) {
          return (
            <td className="border-border border px-4 py-2" {...props}>
              {children}
            </td>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

export const Markdown = memo(PureMarkdown);
