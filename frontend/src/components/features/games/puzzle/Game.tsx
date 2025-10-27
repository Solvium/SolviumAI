"use client";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { GameTimer } from "@/components/common/Timer";

const headbreaker = require("headbreaker");

const images = [
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791905/drvo6rl75nrhfnsga38o.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791904/esjqsai4cydpxkol4ldy.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791904/wwgubtjvw1vy9yodwfpa.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791903/nlh6axmp6atykp0fado2.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791902/l7pt3udsfzofw0ngrqps.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791902/y26cwnwyf1yn5zgip9dr.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791901/immismzkjecvedxokyy9.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791901/ungwrnlwmccmqepqs9bf.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791901/hlixcukspshzokq4tssz.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791900/c0h7ajsu4s2i9t1de0rx.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791413/samples/landscapes/beach-boat.jpg",
];

function ImgIndex(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const PicturePuzzle = () => {
  const router = useRouter();
  const { user: userDetails } = useAuth();
  const [loading, setLoading] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [curImg, setCurImg] = useState<any>();
  const [displayImg, setDisplayImg] = useState<any>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [solved, setSolved] = useState(false);
  const [points, setPoints] = useState(0);
  const [saving, setSaving] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (isPlaying && !solved) return;
    const setUp = async () => {
      const img = await preloadImage(images[ImgIndex(0, images.length - 1)]);
      setCurImg(img);
    };
    setUp();
  }, [solved]);

  const preloadImage = (src: string) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
    });
  };

  const playGame = async () => {
    if (!curImg || !userDetails) {
      return;
    }

    setSolved(false);
    setIsPlaying(true);
    setDisplayImg(curImg);
    const audio = new Audio("click.mp3");

    const initialWidth = window.innerWidth > 430 ? 430 : window.innerWidth - 50;
    const initialHeight = window.innerHeight / 2;

    const piecesX = (userDetails?.level ?? 1) + (userDetails?.difficulty ?? 1);
    const piecesY = (userDetails?.level ?? 1) + (userDetails?.difficulty ?? 1);

    const pieceSize = Math.min(initialWidth / piecesX, initialHeight / piecesY);

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const background = new headbreaker.Canvas("canvas", {
        width: initialWidth,
        height: initialHeight,
        pieceSize:
          (userDetails?.level ?? 1) + (userDetails?.difficulty ?? 1) == 2
            ? 80
            : Math.round(pieceSize - 20),
        proximity: 18,
        borderFill: 8,
        strokeWidth: 1,
        lineSoftness: 0.12,
        preventOffstageDrag: true,
        fixed: true,
        painter: new headbreaker.painters.Konva(),
        image: curImg,
      });

      background.adjustImagesToPuzzleHeight();

      background.autogenerate({
        horizontalPiecesCount:
          (userDetails?.level ?? 1) + (userDetails?.difficulty ?? 1),
        verticalPiecesCount:
          (userDetails?.level ?? 1) + (userDetails?.difficulty ?? 1),
      });

      background.shuffle(0.8);

      background.attachSolvedValidator();
      background.onValid(() => {
        const timeDiff = (Date.now() - timer) / 1000;
        const points =
          timeDiff < 120 ? 100 : timeDiff > 120 && timeDiff < 240 ? 75 : 50;

        setTimeout(() => {
          setPoints(
            points *
              (userDetails?.level ?? 1) *
              (multiplier > 0 ? multiplier : 1)
          );
          setSolved(true);
          setSaving(true);
          setTimeout(() => setSaving(false), 2000);
        }, 1500);
      });

      setTimeout(() => {
        setTimer(Date.now());
        background.draw();
      }, 1000);

      background.onConnect(
        (
          _piece: any,
          figure: { shape: { stroke: (arg0: string) => void } },
          _target: any,
          targetFigure: { shape: { stroke: (arg0: string) => void } }
        ) => {
          audio.play();
          figure.shape.stroke("yellow");
          targetFigure.shape.stroke("yellow");
        }
      );
    } catch (error) {
      console.error("Error initializing puzzle game:", error);
      setSolved(false);
      setIsPlaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-b from-[#0A0146] via-[#1a0a3e] to-[#2d1b69]">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="h-screen  bg-[url('/assets/background/num-genius-bg.svg')] bg-cover bg-center bg-no-repeat text-white relative overflow-hidden">
      <div
        className="absolute top-32 left-8 w-3 h-3 bg-pink-400 rounded-full animate-pulse"
        style={{ boxShadow: "0 0 10px rgba(244, 114, 182, 0.8)" }}
      ></div>
      <div
        className="absolute top-[45%] left-6 w-2 h-2 bg-purple-400 rounded-full animate-pulse"
        style={{
          animationDelay: "0.5s",
          boxShadow: "0 0 8px rgba(192, 132, 252, 0.8)",
        }}
      ></div>
      <div
        className="absolute bottom-[35%] right-8 w-3 h-3 bg-pink-500 rounded-full animate-pulse"
        style={{
          animationDelay: "1s",
          boxShadow: "0 0 10px rgba(236, 72, 153, 0.8)",
        }}
      ></div>
      <div
        className="absolute top-[60%] right-12 w-2 h-2 bg-purple-300 rounded-full animate-pulse"
        style={{
          animationDelay: "1.5s",
          boxShadow: "0 0 8px rgba(216, 180, 254, 0.8)",
        }}
      ></div>

      <div className="flex items-center justify-between px-4 pt-4 pb-2 max-w-md mx-auto">
        {/* <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button> */}
        <h1
          className="text-2xl ml-24
           font-bold text-white tracking-[0.3em]"
          style={{ fontFamily: "monospace" }}
        >
          PUZZLE
        </h1>
        <div className="w-16"></div>
      </div>

      {curImg && (
        <div className="max-w-md mx-auto px-4 mt-2 mb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 flex-1">
              <span
                className="text-pink-500 text-base mt-0.5"
                style={{ textShadow: "0 0 8px rgba(236, 72, 153, 0.6)" }}
              >
                ✦
              </span>
              <p className="text-white text-xs leading-relaxed">
                Arrange the puzzle
                <br />
                correctly and earn
                <br />
                SOLV coin
              </p>
            </div>
            <div className="w-24 h-20 rounded-lg overflow-hidden border-2 border-cyan-400/40 flex-shrink-0 shadow-lg">
              <img
                src={curImg.src || "/placeholder.svg"}
                alt="Puzzle preview"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      )}

      {!isPlaying && !solved && (
        <div className="max-w-md mx-auto px-4 text-center mb-4">
          <button
            onClick={playGame}
            disabled={!curImg}
            className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-base font-semibold transition-colors shadow-lg"
            style={{ boxShadow: "0 0 20px rgba(34, 211, 238, 0.4)" }}
          >
            Start Game
          </button>
        </div>
      )}

      {isPlaying && !solved && (
        <div className="max-w-md mx-auto px-4 mb-4">
          <div className="mb-2">
            <GameTimer time={timer} />
          </div>
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-br from-cyan-400/30 via-blue-500/30 to-cyan-400/30 rounded-2xl blur-xl"></div>

            {/* Canvas container */}
            <div
              className="relative bg-gradient-to-br from-cyan-400/5 via-blue-500/5 to-purple-500/5 p-3 rounded-2xl border-2 border-cyan-400/60 shadow-2xl"
              style={{
                boxShadow:
                  "0 0 30px rgba(34, 211, 238, 0.3), inset 0 0 15px rgba(34, 211, 238, 0.1)",
              }}
            >
              <div id="canvas" className="mx-auto rounded-xl"></div>
            </div>
          </div>
        </div>
      )}

      {solved && (
        <div className="max-w-md mx-auto px-4 text-center space-y-3">
          <div className="text-xl font-bold text-green-400">
            Congratulations! Puzzle Solved!
          </div>
          <div className="text-lg text-cyan-300">Points Earned: {points}</div>
          {saving && <div className="text-blue-400 text-sm">Saving points...</div>}
          <button
            onClick={() => {
              setSolved(false);
              setIsPlaying(false);
              setPoints(0);
            }}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors shadow-lg"
          >
            Play Again
          </button>
        </div>
      )}

      {/* Decorative gradient at bottom */}
      <div className="fixed bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-purple-900/50 via-blue-900/20 to-transparent pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(139,92,246,0.3),transparent_60%)]"></div>
      </div>
    </div>
  );
};
