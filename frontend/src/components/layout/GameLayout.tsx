"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

interface GameLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

export default function GameLayout({
  children,
  title,
  description,
  showBackButton = true,
  onBack,
}: GameLayoutProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <div className="h-screen overflow-hidden tropical-gradient">
      <div className="max-w-[630px] no-scrollbar mx-auto relative h-screen">
        <div className="flex flex-col no-scrollbar h-full">
          {/* Header */}
          {showBackButton && (
            <div className="flex items-center justify-between p-4 bg-black/20 backdrop-blur-sm">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-white hover:text-yellow-400 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
                <span className="text-sm">Back</span>
              </button>
              
              <div className="text-center">
                <h1 className="text-white text-lg font-bold">{title}</h1>
                {description && (
                  <p className="text-white/70 text-xs">{description}</p>
                )}
              </div>
              
              <div className="w-16" /> {/* Spacer for centering */}
            </div>
          )}

          {/* Game content */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
