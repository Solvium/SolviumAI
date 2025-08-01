
import React from 'react';
import { Coins, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PremiumChallenge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  price: number;
  rewards: string;
}

interface PremiumChallengeCardProps {
  challenge: PremiumChallenge;
  onPlay: () => void;
}

const PremiumChallengeCard: React.FC<PremiumChallengeCardProps> = ({ challenge, onPlay }) => {
  return (
    <Card className="overflow-hidden border-game-accent/40">
      <CardHeader className="pb-2 bg-gradient-to-r from-game-primary/10 to-game-accent/10">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg flex items-center">
            <span className="text-xl mr-2">{challenge.emoji}</span>
            {challenge.title}
          </CardTitle>
          <div className="flex items-center bg-primary/10 rounded-full px-2 py-0.5">
            <Coins className="h-3.5 w-3.5 text-game-accent mr-1" />
            <span className="text-xs font-medium">{challenge.price}</span>
          </div>
        </div>
        <CardDescription>{challenge.description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-3 pb-2">
        <div className="flex items-center text-sm">
          <Sparkles className="h-4 w-4 text-game-accent mr-1.5" />
          <span>Rewards: {challenge.rewards}</span>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button 
          className="w-full" 
          onClick={onPlay}
        >
          Play for {challenge.price} coins
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PremiumChallengeCard;
