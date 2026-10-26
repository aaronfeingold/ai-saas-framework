import NextImage from 'next/image';

import type { Experimental_GeneratedImage } from 'ai';

import { cn } from '@/lib/utils';

export type ImageProps = Experimental_GeneratedImage & {
  className?: string;
  alt?: string;
};

export const Image = ({ base64, mediaType, ...props }: ImageProps) => (
  <NextImage
    {...props}
    src={`data:${mediaType};base64,${base64}`}
    alt={props.alt || ''}
    width={500}
    height={300}
    className={cn(
      'h-auto max-w-full overflow-hidden rounded-md',
      props.className
    )}
  />
);
