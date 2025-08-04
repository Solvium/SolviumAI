"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/contexts/AuthContext";
import { GameTimer } from "../../Timer";

// Add error handling for headbreaker import
let headbreaker: any;
try {
  headbreaker = require("headbreaker");
} catch (error) {
  console.error("Failed to load headbreaker library:", error);
  headbreaker = null;
}

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
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const PicturePuzzle = () => {
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

  const diff = ["", "EASY", "MEDIUM", "EXPERT"];

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
    // Check if headbreaker is available
    if (!headbreaker) {
      console.error("Headbreaker library not available");
      return;
    }

    setSolved(false);
    setIsPlaying(true);
    setDisplayImg(curImg);
    let audio = new Audio("click.mp3");

    if (!userDetails) {
      return;
    }

    const initialWidth = window.innerWidth > 430 ? 430 : window.innerWidth - 50;
    const initialHeight = window.innerHeight / 2;

    const piecesX = (userDetails?.level ?? 1) + (userDetails?.difficulty ?? 1);
    const piecesY = (userDetails?.level ?? 1) + (userDetails?.difficulty ?? 1);

    const pieceSize = Math.min(initialWidth / piecesX, initialHeight / piecesY);

    try {
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
          // TODO: Implement claim points with new auth system
          console.log(
            "Claiming points:",
            points *
              (userDetails?.level ?? 1) *
              (multiplier > 0 ? multiplier : 1)
          );
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
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Picture Puzzle
          </h1>
          <p className="text-gray-600">
            Arrange the pieces to complete the image
          </p>
        </div>

        {!headbreaker && (
          <div className="text-center p-4 bg-red-100 text-red-700 rounded-lg mb-4">
            <p>Puzzle game is currently unavailable. Please try again later.</p>
          </div>
        )}

        {!isPlaying && !solved && (
          <div className="text-center">
            <Button
              onClick={playGame}
              disabled={!headbreaker}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-semibold"
            >
              Start Game
            </Button>
          </div>
        )}

        {isPlaying && (
          <div className="space-y-4">
            <GameTimer time={timer} />
            <div
              id="canvas"
              className="border-2 border-gray-300 rounded-lg mx-auto"
            ></div>
          </div>
        )}

        {solved && (
          <div className="text-center space-y-4">
            <div className="text-2xl font-bold text-green-600">
              Congratulations! Puzzle Solved!
            </div>
            <div className="text-xl text-gray-700">Points Earned: {points}</div>
            {saving && <div className="text-blue-600">Saving points...</div>}
            <Button
              onClick={() => {
                setSolved(false);
                setIsPlaying(false);
                setPoints(0);
              }}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg"
            >
              Play Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
