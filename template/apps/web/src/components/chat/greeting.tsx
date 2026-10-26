'use client';

import { memo } from 'react';

import { SparklesIcon } from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';

interface GreetingProps {
  username?: string;
  className?: string;
}

function PureGreeting({ username, className }: GreetingProps) {
  const greetings = [
    'Hello! How can I help you today?',
    'Welcome! What would you like to explore?',
    "Hi there! I'm ready to assist you.",
    'Good to see you! What can I do for you?',
  ];

  const randomGreeting =
    greetings[Math.floor(Math.random() * greetings.length)];

  return (
    <Card className={`border-dashed ${className}`}>
      <CardContent className="flex items-center gap-3 p-6 text-center">
        <div className="mx-auto space-y-3">
          <div className="flex items-center justify-center">
            <SparklesIcon size={32} />
          </div>
          <div>
            <h3 className="text-lg font-medium">
              {username ? `Welcome back, ${username}!` : 'Welcome!'}
            </h3>
            <p className="text-muted-foreground mt-1">{randomGreeting}</p>
          </div>
          <div className="text-muted-foreground text-sm">
            You can ask me questions, request help with tasks, or start a
            conversation about any topic.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const Greeting = memo(PureGreeting);
