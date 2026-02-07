import React, { useEffect, useState } from "react";
import { Spring } from "react-spring/renderprops";

import type { DisplayPositions } from "../../../types";
import { Hexagon } from "./svg/hexagon";

type MainSVGProps = {
  positions: DisplayPositions;
};

export const MainSVG = ({ positions }: MainSVGProps): React.JSX.Element => {
  const [open, setOpen] = useState<"open" | "close">("open");

  useEffect(() => {
    setOpen("open");

    const timeoutId = window.setTimeout(() => {
      setOpen("close");
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [positions]);

  const x = positions.x;
  const y = positions.y;

  return (
    <div className="mainSVGcontainer">
      <Spring
        from={{
          x: open === "open" ? -1800 : 0,
          size16: open === "open" ? 0 : 16,
          size36: open === "open" ? 0 : 36,
          size42: open === "open" ? 0 : 42,
          r: 0,
          opacity: open === "open" ? 0 : 1,
        }}
        delay={1000}
        to={{
          x: open === "open" ? 0 : 1800,
          size16: open === "open" ? 16 : 0,
          size36: open === "open" ? 36 : 0,
          size42: open === "open" ? 42 : 0,
          r: 1.5,
          opacity: open === "open" ? 1 : 0,
        }}
        config={{ duration: 1000 }}
        key={positions.num}
      >
        {(springProps: {
          x: number;
          size16: number;
          size36: number;
          size42: number;
          r: number;
          opacity: number;
        }) => (
          <svg className="mainSvg" width="100%" height="100%">
            <line
              id="svgLine"
              x2={positions.x + (positions.x < 1000 ? 300 : 100)}
              y2={positions.y + (positions.y > 400 ? -0 : 100)}
              x1={positions.x2}
              y1={positions.y2}
              style={{
                stroke: "black",
                strokeWidth: 1,
                strokeDashoffset: springProps.x,
              }}
            />
            <polyline
              className="polyLine"
              points={
                `${x + (x < 1000 ? -0 : 400)} ${y + (y > 400 ? 70 : 30)},` +
                `${x + (x < 1000 ? -10 : 410)} ${y + (y > 400 ? 70 : 30)},` +
                `${x + (x < 1000 ? -20 : 420)} ${y + (y > 400 ? 60 : 40)},` +
                `${x + (x < 1000 ? -20 : 420)} ${y + (y > 400 ? 20 : 80)},` +
                `${x + (x < 1000 ? -0 : 400)} ${y + (y > 400 ? -0 : 100)},` +
                `${x + (positions.x < 1000 ? -0 + 300 : 400 - 300)} ${
                  y + (positions.y > 400 ? -0 : 100)
                }`
              }
              style={{
                fill: "none",
                stroke: "rgb(124, 124, 124)",
                strokeWidth: 2,
                strokeDashoffset: springProps.x,
              }}
            />
            <circle
              cx={positions.x2}
              cy={positions.y2}
              r={springProps.r}
              stroke="black"
              strokeWidth="1"
              style={{
                opacity: springProps.opacity,
              }}
            />
            <Hexagon
              top={positions.y2}
              left={positions.x2}
              opacity={springProps.opacity}
              size={springProps.size16}
            />
            <Hexagon
              top={positions.y2}
              left={positions.x2}
              opacity={springProps.opacity}
              size={springProps.size36}
            />
            <Hexagon
              top={positions.y2}
              left={positions.x2}
              opacity={springProps.opacity}
              size={springProps.size42}
            />
          </svg>
        )}
      </Spring>
    </div>
  );
};
