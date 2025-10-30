
import React from 'react';
import GameCard, { GameCardProps } from './GameCard';
import { cn } from '@/lib/utils';

interface GameGridProps {
  games: Omit<GameCardProps, 'onPlay'>[];
  onPlayGame: (id: string) => void;
  className?: string;
}

const GameGrid = ({ games, onPlayGame, className }: GameGridProps) => {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4", className)}>
      {games.map((game) => (
        <GameCard
          key={game.id}
          {...game}
          onPlay={onPlayGame}
        />
      ))}
    </div>
  );
};

export default GameGrid;
