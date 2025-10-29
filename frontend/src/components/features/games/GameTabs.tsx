import React from "react";
import { Star, Brain, Joystick, Calendar, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "react-toastify";

interface GameTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const GameTabs: React.FC<GameTabsProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: "wordle", label: "Wordle", icon: <Brain className="w-4 h-4" /> },
    { id: "puzzles", label: "Puzzles", icon: <Star className="w-4 h-4" /> },
    // { id: 'arcade', label: 'Arcade', icon: <Joystick className="w-4 h-4" /> },
    { id: "quiz", label: "Quiz", icon: <HelpCircle className="w-4 h-4" /> },
    // { id: 'daily', label: 'Daily', icon: <Calendar className="w-4 h-4" /> },
  ];

  const enabledMap: Record<string, boolean> = {
    wordle: true,
    quiz: true,
    puzzles: false,
  };

  return (
    <div className="bg-background sticky top-0 z-10 border-b">
      <div className="flex overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => {
          const isEnabled = !!enabledMap[tab.id];
          return (
            <button
              key={tab.id}
              className={cn(
                "relative flex-1 flex flex-col items-center py-3 px-4 whitespace-nowrap transition-colors",
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() =>
                isEnabled ? onTabChange(tab.id) : toast.info("COMING SOON")
              }
              aria-disabled={!isEnabled}
            >
              {tab.icon}
              <span className="text-xs mt-1">{tab.label}</span>
              {!isEnabled && (
                <span className="absolute top-1 right-2 px-2 py-[1px] text-[9px] font-bold rounded-full bg-yellow-400 text-black">
                  COMING SOON
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default GameTabs;
