
import React from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GameCardProps {
  id: string;
  title: string;
  description: string;
  emoji: string;
  onPlay: (id: string) => void;
  className?: string;
}

const GameCard = ({ id, title, description, emoji, onPlay, className }: GameCardProps) => {
  return (
    <div 
      className={cn(
        "game-card p-4 flex flex-col",
        className
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="text-2xl">{emoji}</div>
        <h3 className="text-lg font-bold flex-1 ml-2">{title}</h3>
      </div>
      
      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
        {description}
      </p>
      
      <button 
        onClick={() => onPlay(id)}
        className="mt-auto bg-primary text-primary-foreground py-2 px-4 rounded-md flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
      >
        <Play className="h-4 w-4 fill-current" />
        <span>Play Now</span>
      </button>
    </div>
  );
};

export default GameCard;
