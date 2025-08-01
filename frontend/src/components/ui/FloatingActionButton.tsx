
import React from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingActionButtonProps {
  onClick: () => void;
  className?: string;
}

const FloatingActionButton = ({ onClick, className }: FloatingActionButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "floating-button game-gradient text-white h-14 w-14 flex items-center justify-center animate-pulse-soft",
        className
      )}
    >
      <Play className="h-6 w-6 fill-current" />
    </button>
  );
};

export default FloatingActionButton;
