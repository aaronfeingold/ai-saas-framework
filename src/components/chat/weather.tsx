'use client';

import { memo } from 'react';

import {
  CloudIcon,
  CloudRainIcon,
  SnowIcon,
  SunIcon,
} from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  humidity?: number;
  windSpeed?: number;
  description?: string;
}

interface WeatherProps {
  data: WeatherData;
  className?: string;
}

function getWeatherIcon(condition: string) {
  const lowercaseCondition = condition.toLowerCase();

  if (
    lowercaseCondition.includes('rain') ||
    lowercaseCondition.includes('storm')
  ) {
    return CloudRainIcon;
  }
  if (lowercaseCondition.includes('snow')) {
    return SnowIcon;
  }
  if (lowercaseCondition.includes('cloud')) {
    return CloudIcon;
  }
  return SunIcon;
}

function PureWeather({ data, className }: WeatherProps) {
  const WeatherIcon = getWeatherIcon(data.condition);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          Weather in {data.location}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <WeatherIcon size={32} />
          <div>
            <div className="text-2xl font-semibold">{data.temperature}°C</div>
            <div className="text-muted-foreground text-sm">
              {data.condition}
            </div>
          </div>
        </div>

        {data.description && <div className="text-sm">{data.description}</div>}

        {(data.humidity !== undefined || data.windSpeed !== undefined) && (
          <div className="text-muted-foreground flex gap-4 text-sm">
            {data.humidity !== undefined && (
              <div>Humidity: {data.humidity}%</div>
            )}
            {data.windSpeed !== undefined && (
              <div>Wind: {data.windSpeed} km/h</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const Weather = memo(PureWeather);
