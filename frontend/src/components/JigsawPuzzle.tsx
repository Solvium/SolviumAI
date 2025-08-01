import React, { useEffect, useRef, useState } from "react";
import { MainHandler } from "./puzzle";

const JigsawPuzzle = () => {
  const [isLoading, setIsLoading] = useState(true);
  const gameRef = useRef<MainHandler | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initGame = async () => {
      setIsLoading(true);

      // Create container for SVG
      const container = containerRef.current;
      console.log(container);
      if (!container) return;

      // Clear any existing content
      container.innerHTML = "";

      // Create SVG structure
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("version", "1.1");
      svg.setAttribute("viewBox", "0 0 640 480");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

      // Add necessary groups
      const defs = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "defs"
      );
      const ps = document.createElementNS("http://www.w3.org/2000/svg", "g");
      ps.id = "ps";
      const ms = document.createElementNS("http://www.w3.org/2000/svg", "g");
      ms.id = "ms";
      const img = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "image"
      );
      img.id = "img";
      const ins = document.createElementNS("http://www.w3.org/2000/svg", "g");
      ins.id = "ins";

      defs.appendChild(ps);
      defs.appendChild(ms);
      defs.appendChild(img);
      svg.appendChild(defs);
      svg.appendChild(ins);

      container.appendChild(svg);

      // Initialize game
      try {
        const game = new MainHandler(container);
        gameRef.current = game;

        console.log(game);
        console.log(gameRef);

        // Load a sample image (replace with your actual image URL)
        const imageUrl = "";
        // await game.updateImage(imageUrl);

        // Initialize the puzzle
        // await game.init();
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to initialize puzzle:", error);
        setIsLoading(false);
      }
    };

    initGame();

    // return () => {
    //   // Cleanup
    //   if (gameRef.current) {
    //     // Add any necessary cleanup
    //   }
    // };
  }, []);

  return (
    <div className="w-full h-full bg-black">
      {isLoading && (
        <div className="flex items-center justify-center w-full h-full text-white">
          Loading puzzle...
        </div>
      )}
      <div ref={containerRef} className="w-full h-full"></div>
    </div>
  );
};

export default JigsawPuzzle;
