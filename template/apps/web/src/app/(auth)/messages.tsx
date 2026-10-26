import React from 'react';

import { useSearchParams } from 'next/navigation';

import { AlertTriangle, InfoIcon } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Messages() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const message = searchParams.get('message');

  if (!error && !message) return null;

  return (
    <>
      {error && (
        <div className="flex w-full flex-col items-center">
          <div className="w-full max-w-[90%]">
            <Alert variant="destructive" className="flex gap-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{decodeURIComponent(error)}</AlertDescription>
            </Alert>
          </div>
        </div>
      )}
      {message && (
        <div className="flex w-full flex-col items-center">
          <div className="w-full max-w-[90%]">
            <Alert className="flex gap-2">
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>{decodeURIComponent(message)}</AlertDescription>
            </Alert>
          </div>
        </div>
      )}
    </>
  );
}
