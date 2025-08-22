'use client';

import { useTheme } from 'next-themes';

import { Monitor, Moon, Sun } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SettingsCard } from '@/components/ui/settings-card';

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    {
      value: 'light',
      label: 'Light',
      description: 'Light mode with bright colors',
      icon: <Sun className="h-4 w-4" />,
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Dark mode with darker colors',
      icon: <Moon className="h-4 w-4" />,
    },
    {
      value: 'system',
      label: 'System',
      description: 'Use your system preference',
      icon: <Monitor className="h-4 w-4" />,
    },
  ];

  return (
    <SettingsCard
      title="Theme Preferences"
      description="Choose how the app looks and feels."
    >
      <RadioGroup value={theme} onValueChange={setTheme} className="space-y-3">
        {themeOptions.map((option) => (
          <div key={option.value} className="flex items-center space-x-3">
            <RadioGroupItem value={option.value} id={option.value} />
            <Label
              htmlFor={option.value}
              className="flex flex-1 cursor-pointer items-center gap-3"
            >
              {option.icon}
              <div>
                <div className="font-medium">{option.label}</div>
                <div className="text-muted-foreground text-sm">
                  {option.description}
                </div>
              </div>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </SettingsCard>
  );
}
