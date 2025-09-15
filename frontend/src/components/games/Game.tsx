"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GameTimer } from "../Timer";
import { useAuth } from "@/app/contexts/AuthContext";
import Image from "next/image";

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
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791899/u7kwt2j37d8bmev8uqnf.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791899/jx6bfjqnwdrcrqlhkedz.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791899/rkrpijvnaoqe3jhaqrjk.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791899/ipd9y9skuyndtjmfnbvm.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791898/mzwxhp6zxephriq0ybgw.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791897/fbkehufeqt3apnob8has.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791897/hwdsglnjpdwyw3wej0jl.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791896/twq9agghekp2eepphjsf.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791896/dmu2usih0r8folshcqoc.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791895/usamjlotpmwlygu1ntr9.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791895/z5lqchsg9xazisvm5spx.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791894/aanh6aaieo4iyjdm75ii.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791893/pttubcu3xujrce0v5p6i.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791893/dmvshd3ktisnpkz6qu77.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791893/cvcmlwmnk1zx9wxgleoe.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791892/czi39cyksxkrotclu8bd.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791892/qcwxf6wqwdexcwsaqf44.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791891/pn7hyzkwrgd5udd9aohb.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791890/tb6yvfbrxguu5nhulp4g.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791890/viuejgikxu5ijx6rs2q8.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791889/jwy8wxsnynga01qiwbo5.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791889/yr3fswnxyjihwm87bixr.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791888/towi02zr6b7vxtdiym1m.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791888/srma7igldy6wsax03trv.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791887/cv09atr5jevtryjtu5b4.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791887/ipdgc37yx9kmev6ft9qr.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791887/afbw5o56oqavame6tyny.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791886/epfkzj3nwvpkzilmxrpl.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791886/tzazi5h1cdcqepdhgqgz.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791886/znzvngaa4zo6gzppygad.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791885/gbxhpacvh4y5dybzd9lb.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791884/auv0oiyvwy2aew0lbmmd.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791884/ewmnuzcaeyh50zmaorhr.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791883/cwktslsq6pvgdqqqwzv5.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791883/svfzbf0tizfuifg7bw7e.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791882/dwfyd2ummmogubfplpmk.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791882/bjozrtnb5nwscd7xh0ko.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791881/tyrkolikgyclow0jbco6.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791881/xhdivxycakvqyskod5cc.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791880/g9utxmxkn8pcgbpn5ddr.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791880/gupp6coc0br1ldoeinqc.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791880/wdsjp8l1bwpizx04ssjz.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791880/tvq523l1jmr4lbqiqnza.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791880/jrqszxa6ikm4vrqffrdg.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791879/f1wmvnk3b7kdooqiv9za.webp",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791422/cld-sample-5.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791422/cld-sample-4.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791422/cld-sample-3.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791422/cld-sample-2.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791422/cld-sample.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791422/samples/woman-on-a-football-field.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791421/samples/upscale-face-1.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791421/samples/logo.png",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791421/samples/dessert-on-a-plate.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791421/samples/coffee.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791420/samples/chair.png",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791421/samples/cup-on-a-table.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791420/samples/chair-and-coffee-table.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791420/samples/man-on-a-escalator.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791420/samples/man-portrait.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791420/samples/man-on-a-street.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791419/samples/breakfast.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791419/samples/look-up.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791419/samples/outdoor-woman.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791419/samples/smile.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791419/samples/balloons.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791417/samples/shoe.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791415/samples/two-ladies.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791413/samples/animals/kitten-playing.gif",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791413/samples/landscapes/landscape-panorama.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791413/samples/landscapes/nature-mountains.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791413/samples/cloudinary-group.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791412/samples/food/spices.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791412/samples/ecommerce/accessories-bag.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791412/samples/imagecon-group.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791412/samples/ecommerce/leather-bag-gray.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791412/samples/landscapes/beach-boat.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791412/samples/ecommerce/car-interior-design.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791411/samples/people/bicycle.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791412/samples/landscapes/architecture-signs.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791411/samples/animals/three-dogs.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791411/samples/people/boy-snow-hoodie.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791411/samples/people/jazz.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791411/samples/bike.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791411/samples/ecommerce/shoes.png",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791411/samples/landscapes/girl-urban-view.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791411/samples/people/smiling-man.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791410/samples/sheep.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791409/samples/cloudinary-logo-vector.svg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791410/samples/food/pot-mussels.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791410/samples/food/fish-vegetables.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791410/samples/animals/reindeer.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791410/samples/people/kitchen-bar.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791409/samples/ecommerce/analog-classic.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791409/samples/food/dessert.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791409/samples/animals/cat.jpg",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791409/samples/cloudinary-icon.png",
  "https://res.cloudinary.com/dovy5scxo/image/upload/v1738791407/sample.jpg",
];

function ImgIndex(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export const Game = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [solved, setSolved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [points, setPoints] = useState(1);
  const [curImg, setCurImg] = useState<any>();
  const [timer, setTimer] = useState<number>(Date.now());
  const [displayImg, setDisplayImg] = useState<any>();

  const diff = ["", "EASY", "MEDIUM", "EXPERT"];

  const { user: userDetails } = useAuth();
  const [loading, setLoading] = useState(false);
  const [multiplier, setMultiplier] = useState(1);

  useEffect(() => {
    if (isPlaying && !solved) return;
    const setUp = async () => {
      const img = await preloadImage(images[ImgIndex(0, images.length - 1)]);
      setCurImg(img);
    };
    setUp();
  }, [solved]);

  const preloadImage = (src: string) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = document.createElement("img"); // ✅ Properly typed
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
    });
  };
  
  
  const playGame = async () => {
    setSolved(false);
    setIsPlaying(true);
    setDisplayImg(curImg);
    let audio = new Audio("click.mp3");

    if (!userDetails) {
      return;
    }

    const initialWidth = window.innerWidth > 430 ? 430 : window.innerWidth - 50;
    const initialHeight = window.innerHeight / 2;

    const piecesX = userDetails.level + userDetails.difficulty;
    const piecesY = userDetails.level + userDetails.difficulty;

    const pieceSize = Math.min(initialWidth / piecesX, initialHeight / piecesY);

    const background = new headbreaker.Canvas("canvas", {
      width: initialWidth,
      height: initialHeight,
      pieceSize:
        userDetails.level + userDetails.difficulty == 2
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
      // maxPiecesCount: { x: 4, y: 7 },
    });

    background.adjustImagesToPuzzleHeight();
    background.autogenerate({
      horizontalPiecesCount: userDetails.level + userDetails.difficulty,
      verticalPiecesCount: userDetails.level + userDetails.difficulty,
    });

    background.shuffle(0.8);
    background.attachSolvedValidator();
    background.onValid(() => {
      const timeDiff = (Date.now() - timer) / 1000;
      const points =
        timeDiff < 120 ? 100 : timeDiff > 120 && timeDiff < 240 ? 75 : 50;

      setTimeout(() => {
        setPoints(
          points * userDetails.level * (multiplier > 0 ? multiplier : 1)
        );
        setSolved(true);
        // TODO: Implement claim points with new auth system
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
        // play sound
        audio.play();

        // paint borders on click
        // of conecting and conected figures
        figure.shape.stroke("yellow");
        targetFigure.shape.stroke("yellow");
        background.redraw();

        setTimeout(() => {
          // restore border colors
          // later
          figure.shape.stroke("black");
          targetFigure.shape.stroke("black");
          background.redraw();
        }, 200);
      }
    );

    background.onDisconnect((it: any) => {
      audio.play();
    });
  };

  if (!userDetails) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"
         style={{ backgroundImage: "url('/tropical-adventure-bg.jpg')" }}
        ></div>
      </div>
    );
  } else
    return (
      <div className="bg-[#0B0B14] h-[90vh] flex flex-col items-center justify-center w-full py-4 px-4 md:py-6">
        <div>
          <div
            className={`${
              !isPlaying || solved ? "hidden" : "block"
            } flex flex-col items-center space-y-4 mb-6`}
          >
            <div className="bg-[#151524] rounded-xl p-4 border border-[#2A2A45] shadow-[0_0_15px_rgba(41,41,69,0.5)]">
              <div className="flex flex-col items-center">
                <span className="text-[#8E8EA8] text-sm mb-1">
                  Time Elapsed
                </span>
                <span className="text-[#4C6FFF] text-4xl font-bold">
                  <GameTimer time={timer} />
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-8">
              <div className="flex flex-col items-center">
                <span className="text-[#8E8EA8] text-sm mb-1">Level</span>
                <span className="text-white text-xl font-semibold">
                  {userDetails.level}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[#8E8EA8] text-sm mb-1">Puzzle</span>
                <span className="text-white text-xl font-semibold">
                  {userDetails.puzzleCount}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[#8E8EA8] text-sm mb-1">Difficulty</span>
                <span className="text-white text-xl font-semibold">
                  {diff[userDetails.difficulty]}
                </span>
              </div>
            </div>
          </div>

          <div
            className={`${
              !isPlaying || solved ? "hidden" : "block"
            } bg-[#151524] border border-[#2A2A45] rounded-2xl mt-4 w-full max-w-[1200px] mx-auto overflow-hidden`}
            id="canvas"
            style={{ minHeight: "400px" }}
          ></div>
        </div>

        <div
          id="validated-canvas-overlay"
          className={`z-[9999999999] w-[60vw] ${
            !solved ? "hidden" : "flex"
          } flex-col items-center bg-[#151524] border border-[#2A2A45] rounded-2xl p-6 shadow-[0_0_15px_rgba(41,41,69,0.5)] mt-4`}
        >
          <p className="text-2xl font-bold text-[#4C6FFF] mb-2">Huray!!</p>
          <p className="text-white text-lg mb-2">You Solved This Puzzle</p>
          <p className="text-[#8E8EA8] mb-4">
            You have earned{" "}
            <span className="text-[#4C6FFF] font-bold">{points} SOLV</span>
          </p>
          <Image
            className="my-4 rounded-lg border border-[#2A2A45] max-w-full h-auto"
            src={displayImg?.src}
            alt="Completed puzzle"
          />
          {(userDetails?.level ?? 0) > 3 ? (
            <p className="text-[#8E8EA8] text-center">
              You have finished all stages for today, come back tomorrow
            </p>
          ) : (
            <Button
              onClick={() => {
                playGame();
              }}
              className="bg-[#4C6FFF] hover:bg-[#4C6FFF]/80 text-white"
            >
              Next Game
            </Button>
          )}
        </div>
        {!isPlaying && curImg && (
          <div className="flex items-center justify-center">
            <Button
              onClick={() => {
                playGame();
              }}
              className="bg-[#4C6FFF]  hover:bg-[#4C6FFF]/80 text-white mt-4"
            >
              Play Game
            </Button>
          </div>
        )}
      </div>
    );
};
