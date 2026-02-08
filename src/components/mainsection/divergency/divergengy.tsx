import React, { useEffect, useState } from "react";
import { animated, useSpring } from "react-spring";

import type { DisplayPositions } from "../../../types";

type DivergengyProps = {
  positions: DisplayPositions;
};

export const Divergency = ({ positions: nextPositions }: DivergengyProps) => {
  const [positions, setPositions] = useState<DisplayPositions>(nextPositions);
  const [open, setOpen] = useState<"open" | "close">("open");

  useEffect(() => {
    setPositions(nextPositions);
    setOpen("open");

    const timeoutId = window.setTimeout(() => {
      setOpen("close");
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [nextPositions]);

  const date = positions.data.Date;
  const country = positions.data.Country;
  const message = positions.data.Message;
  const add = positions.data.Add;

  const springProps = useSpring({
    from: {
      opacity: open === "open" ? 0 : 1,
      letterSpacing: open === "open" ? -10 : 0,
    },
    to: {
      opacity: open === "open" ? 1 : 0,
      letterSpacing: open === "open" ? 0 : 10,
    },
    delay: 2000,
    config: { mass: 3, tension: 600, friction: 100 },
    reset: true,
  });

  return (
    <div className="divergency">
      <animated.div
        className="divergencyBlock"
        style={{
          top: positions.y,
          left: positions.x > 1000 ? positions.x - 200 : positions.x,
          textAlign: positions.x < 1000 ? "left" : "right",
          opacity: springProps.opacity,
          letterSpacing: springProps.letterSpacing,
        }}
      >
        <h3
          className="divDate"
          style={{ marginTop: positions.y < 300 ? 20 : 0 }}
        >
          {date}
        </h3>

        <h2
          className="divCountry"
          style={{
            fontSize: country.length < 30 ? 35 : 20,
            marginTop: country.length < 30 ? 0 : 10,
          }}
        >
          {country}
        </h2>

        <h2 className="divMessage">{message}</h2>

        <h2 className="divAdd">{add}</h2>
      </animated.div>
    </div>
  );
};
