import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coffee, Umbrella, Glasses, Shirt, IceCream, TreePine } from 'lucide-react';

interface Suggestion {
  text: string;
  icon: JSX.Element;
}

interface SuggestionCardProps {
  temperature: number;
  condition?: string;
  temperatureRange: string;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  temperature,
  condition = '',
  temperatureRange,
}) => {
  const getSuggestions = (): Suggestion[] => {
    const suggestions: Suggestion[] = [];

    // Temperature-based suggestions
    if (temperature <= 5) {
      suggestions.push(
        { text: "Brr… hot cocoa vibes, stay cozy!", icon: <Coffee className="h-5 w-5" /> },
        { text: "Time for fuzzy socks and a warm blanket", icon: <TreePine className="h-5 w-5" /> },
        { text: "Snow angels await if you dare!", icon: <TreePine className="h-5 w-5" /> },
        { text: "Perfect day for baking cookies", icon: <Coffee className="h-5 w-5" /> }
      );
    } else if (temperature <= 15) {
      suggestions.push(
        { text: "Grab a jacket, maybe a brisk walk", icon: <Shirt className="h-5 w-5" /> },
        { text: "Perfect for an autumn leaf stroll", icon: <TreePine className="h-5 w-5" /> },
        { text: "Coffee outdoors is a yes", icon: <Coffee className="h-5 w-5" /> },
        { text: "A walk in the park never hurt anyone", icon: <TreePine className="h-5 w-5" /> }
      );
    } else if (temperature <= 20) {
      suggestions.push(
        { text: "Nice sweater weather — perfect for coffee outside", icon: <Coffee className="h-5 w-5" /> },
        { text: "Great day to plant something green", icon: <TreePine className="h-5 w-5" /> },
        { text: "Stroll through a local market", icon: <TreePine className="h-5 w-5" /> },
        { text: "Perfect jogging weather", icon: <Shirt className="h-5 w-5" /> }
      );
    } else if (temperature <= 25) {
      suggestions.push(
        { text: "Light jacket optional — a stroll is calling", icon: <Shirt className="h-5 w-5" /> },
        { text: "Sunglasses on, confidence high", icon: <Glasses className="h-5 w-5" /> },
        { text: "Bike rides = happiness guaranteed", icon: <TreePine className="h-5 w-5" /> },
        { text: "Watch the sunset outdoors", icon: <Glasses className="h-5 w-5" /> }
      );
    } else if (temperature <= 30) {
      suggestions.push(
        { text: "Sun's out! Great day for a walk or bike ride", icon: <Glasses className="h-5 w-5" /> },
        { text: "Stay hydrated, adventure awaits", icon: <IceCream className="h-5 w-5" /> },
        { text: "Ice cream break, obvious but necessary", icon: <IceCream className="h-5 w-5" /> },
        { text: "Beach vibes, even inland", icon: <TreePine className="h-5 w-5" /> }
      );
    } else {
      suggestions.push(
        { text: "Stay hydrated! Chill indoors or by water", icon: <IceCream className="h-5 w-5" /> },
        { text: "Sunscreen, please!", icon: <Glasses className="h-5 w-5" /> },
        { text: "Pool day = legendary", icon: <IceCream className="h-5 w-5" /> },
        { text: "A/c is your best friend today", icon: <IceCream className="h-5 w-5" /> }
      );
    }

    // Condition-based suggestions (rain, snow, windy)
    const lowerCond = condition.toLowerCase();
    if (lowerCond.includes('rain')) {
      suggestions.push(
        { text: "Umbrella on, but puddles make fun!", icon: <Umbrella className="h-5 w-5" /> },
        { text: "Dance in the rain if you dare", icon: <Umbrella className="h-5 w-5" /> },
        { text: "Hot tea and window-gazing vibes", icon: <Coffee className="h-5 w-5" /> }
      );
    }
    if (lowerCond.includes('snow')) {
      suggestions.push(
        { text: "Snowball fight incoming!", icon: <TreePine className="h-5 w-5" /> },
        { text: "Build a snowman, it’s mandatory", icon: <TreePine className="h-5 w-5" /> },
        { text: "Winter photography vibes unlocked", icon: <TreePine className="h-5 w-5" /> }
      );
    }
    if (lowerCond.includes('wind')) {
      suggestions.push(
        { text: "Hold onto your hat, adventure awaits", icon: <TreePine className="h-5 w-5" /> },
        { text: "Kite-flying level: expert", icon: <TreePine className="h-5 w-5" /> },
        { text: "Outdoor photography + windy = dramatic effect", icon: <TreePine className="h-5 w-5" /> }
      );
    }

    return suggestions.slice(0, 4); // Limit to 4 suggestions
  };

  return (
    <Card className="weather-card mb-8">
      <CardHeader>
        <CardTitle className={`text-2xl text-temp-${temperatureRange}`}>
          Today's Mood 🌟
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {getSuggestions().map((suggestion, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors duration-200"
            >
              <div className={`p-2 bg-weather-${temperatureRange} rounded-full`}>
                {suggestion.icon}
              </div>
              <p className="text-sm font-medium">{suggestion.text}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SuggestionCard;
