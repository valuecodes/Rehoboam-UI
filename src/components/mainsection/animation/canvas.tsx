import React, { useEffect, useRef } from "react";

import type { RingPosition } from "../../../types";

type CanvasProps = {
  divergence: RingPosition;
};

type HexPoint = [number, number, number, number, number, number];

const getRandomInt = (max: number): number => {
  return Math.floor(Math.random() * Math.floor(max));
};

export const Canvas = ({ divergence }: CanvasProps): React.JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const divergenceRef = useRef<number | null>(null);

  useEffect(() => {
    divergenceRef.current = divergence.num;
  }, [divergence.num]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return undefined;
    }

    let divergenceValue: number | null = null;
    let diverPos = 5;

    const clearCanvas = () => {
      ctx.clearRect(-50, -50, 3000, 3000);
    };

    const createHexagon = (): HexPoint[] => {
      const numberOfSides = 1050;
      const size = 310;
      const xCenter = 405;
      const yCenter = 405;

      ctx.beginPath();
      ctx.moveTo(xCenter + size * Math.cos(0), yCenter + size * Math.sin(0));

      const hex: HexPoint[] = [];

      for (let i = 1; i <= numberOfSides; i += 1) {
        hex.push([
          xCenter + size * Math.cos((i * 2 * Math.PI) / numberOfSides),
          yCenter + size * Math.sin((i * 2 * Math.PI) / numberOfSides),
          0,
          0,
          0,
          0,
        ]);
        ctx.stroke();
      }

      return hex;
    };

    const getVariance = (
      hexValue: number,
      a: number,
      dive: number,
      pos: boolean,
      extra: number
    ): number => {
      const variance = 35 + extra;

      if (extra !== 0) {
        return hexValue + getRandomInt(a) * -1 + getRandomInt(a + 0.8);
      }

      if (!pos) {
        if (hexValue < variance || hexValue > -variance) {
          if (hexValue > 0) {
            return hexValue - 1;
          }

          if (hexValue < 0) {
            return hexValue + 1;
          }
        }

        return hexValue;
      }

      if (hexValue > variance || hexValue < 0) {
        if (hexValue > variance) {
          return hexValue - 2;
        }

        if (hexValue < 0) {
          return hexValue + 2;
        }
      }

      return hexValue + getRandomInt(a) * -1 + getRandomInt(a);
    };

    const animateHexagon = (hex: HexPoint[], dive: number) => {
      const last = divergenceValue;
      const nextDivergence = divergenceRef.current;

      divergenceValue =
        typeof nextDivergence === "number" ? nextDivergence * 3 : null;

      if (last !== divergenceValue || divergenceValue === null) {
        diverPos = 0;
        dive = 0;
      } else {
        diverPos = diverPos * 1.09 + 0.12;
      }

      const numberOfSides = 105;
      const sides = numberOfSides;
      const size = 270;
      const xCenter = 400;
      const yCenter = 400;

      ctx.beginPath();
      ctx.moveTo(xCenter + size * Math.cos(0), yCenter + size * Math.sin(0));

      let width = 1;

      for (let i = 0; i < hex.length; i += 1) {
        let currentSize = size;

        const checkDive = i % 105 === divergenceValue;

        if (checkDive && i >= 0 && i < 100) {
          if (dive > 130) {
            dive = 130;
          }

          currentSize = size + dive - 10;
          hex[i][2] = 0;
          hex[i][3] = 0;

          for (let q = 0; q < 5; q += 1) {
            ctx.moveTo(
              xCenter +
                (currentSize + hex[i][2] + width - dive) *
                  Math.cos((i * 2 * Math.PI) / sides),
              yCenter +
                (currentSize + hex[i][3] + width - dive + (30 - q * 10)) *
                  Math.sin((i * 2 * Math.PI) / sides)
            );
            ctx.lineTo(
              xCenter +
                (currentSize + hex[i][2] + width) *
                  Math.cos((i * 2 * Math.PI) / sides),
              yCenter +
                (currentSize + hex[i][3] + width) *
                  Math.sin((i * 2 * Math.PI) / sides)
            );
          }
        }

        if (checkDive && i >= 400 && i < 500) {
          if (dive > 130) {
            dive = 130;
          }

          currentSize = size + dive - 10;
          hex[i][2] = 0;
          hex[i][3] = 0;
        }

        if (checkDive && i >= 500 && i < 600) {
          if (dive > 120) {
            dive = 120;
          }

          currentSize = size + dive - 10;
          hex[i][2] = 0;
          hex[i][3] = 0;
        }

        if (checkDive && i >= 600 && i < 700) {
          if (dive > 120) {
            dive = 120;
          }

          currentSize = size + dive - 10;
          hex[i][2] = 0;
          hex[i][3] = 0;
        }

        if (checkDive && i >= 600 && i < 700) {
          if (dive > 120) {
            dive = 120;
          }

          currentSize = size + dive - 10;
          hex[i][2] = 0;
          hex[i][3] = 0;
        }

        if (checkDive && i >= 200 && i < 300) {
          currentSize = size + dive / 2 + 20;
        }

        if (checkDive && i > 300 && i < 400) {
          currentSize = size + dive / 3;
        }

        if (checkDive && i >= 900) {
          currentSize = size - (dive / 3 - 10) - getRandomInt(2);
        }

        ctx.lineTo(
          xCenter +
            (currentSize + hex[i][2] + width) *
              Math.cos((i * 2 * Math.PI) / sides),
          yCenter +
            (currentSize + hex[i][3] + width) *
              Math.sin((i * 2 * Math.PI) / sides)
        );

        width += 0.005;
      }

      ctx.strokeStyle = "black";
      ctx.filter = "blur(3px)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    const hexa = createHexagon();
    const a = 2;

    let startPos = 0;
    let startPosTime = 0;
    let startPos2 = 0;
    let startPosTime2 = 0;

    let start = 0;
    let start1 = start + 105;
    let start2 = start1 + 105;
    let start3 = start2 + 105;
    let start4 = start3 + 105;
    let start5 = start4 + 105;

    const intervalId = window.setInterval(() => {
      if (startPosTime === 2) {
        startPos += 1;
        startPosTime = 0;

        if (startPos === 600) {
          startPos = 0;
        }
      }

      const dwidth = 200;
      const dive = 1;
      const diveStart = 0 + startPos;
      const diveEnd = dwidth + startPos;

      const diveV = 1;
      const diveVStart = 0 + startPos;
      const diveVEnd = dwidth + startPos;

      if (startPosTime2 === 2) {
        startPos2 += 1;
        startPosTime2 = 0;

        if (startPos2 === 100) {
          startPos2 = 0;
          start = getRandomInt(100);
          start1 = start + 105;
          start2 = start1 + 105;
          start3 = start2 + 105;
          start4 = start3 + 105;
          start5 = start4 + 105;
        }
      }

      for (let i = 0; i < hexa.length; i += 1) {
        let extra = 0;
        let pos = false;

        if (i > diveStart && i < diveStart + (diveEnd - diveStart) / 2) {
          pos = true;
        }

        if (i > diveStart + (diveEnd - diveStart) / 2 && i < diveEnd) {
          pos = true;
        }

        if (i > diveVStart && i < diveVStart + (diveVEnd - diveVStart) / 2) {
          pos = true;
        }

        if (i > diveVStart + (diveVEnd - diveVStart) / 2 && i < diveVEnd) {
          pos = true;
        }

        if (
          (i > start1 && i < start1 + 25) ||
          (i > start2 && i < start2 + 25) ||
          (i > start3 && i < start3 + 25) ||
          (i > start4 && i < start4 + 25) ||
          (i > start5 && i < start5 + 25)
        ) {
          extra = 20;
        }

        hexa[i][2] = getVariance(hexa[i][2], a, dive, pos, extra);
        hexa[i][3] = getVariance(hexa[i][3], a, diveV, pos, extra);
      }

      clearCanvas();
      animateHexagon(hexa, diverPos);
      startPosTime += 1;
      startPosTime2 += 1;
    }, 20);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="canvas">
      <canvas id="canvas" ref={canvasRef} width={800} height={800} />
    </div>
  );
};
