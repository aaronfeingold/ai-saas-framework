import React from 'react';

import { Gavel, Gift, MessageCircle, Search } from 'lucide-react';

const items = [
  {
    icon: <Gavel className="text-muted-foreground h-5 w-5" />,
    title: 'Feature 1',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed euismod, nulla sit amet aliquam lacinia, nisl nisl aliquam nisl, nec aliquam nisl nisl sit amet nisl.',
  },
  {
    icon: <Search className="text-muted-foreground h-5 w-5" />,
    title: 'Feature 2',
    description:
      'Praesent et eros eu felis eleifend egestas. Nullam at dolor quis ante porta tincidunt. Sed euismod, nulla sit amet aliquam lacinia, nisl nisl aliquam nisl.',
  },
  {
    icon: <MessageCircle className="text-muted-foreground h-5 w-5" />,
    title: 'Feature 3',
    description:
      'Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Sed euismod, nulla sit amet aliquam lacinia, nisl nisl aliquam nisl.',
  },
  {
    icon: <Gift className="text-muted-foreground h-5 w-5" />,
    title: 'Free Trial',
    description:
      'Ut ornare lectus sit amet est placerat, nec elementum arcu dignissim. Sed euismod, nulla sit amet aliquam lacinia, nisl nisl aliquam nisl, nec aliquam nisl nisl sit amet nisl.',
  },
];

export default function Content() {
  return (
    <div className="flex max-w-[450px] flex-col gap-8 self-center">
      {items.map((item, index) => (
        <div key={index} className="flex gap-4">
          <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
          <div>
            <h3 className="mb-1.5 font-medium">{item.title}</h3>
            <p className="text-muted-foreground text-sm">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
