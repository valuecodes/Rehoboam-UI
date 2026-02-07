import React, { useEffect, useState } from "react";
import { Spring } from "react-spring/renderprops";

import type { DisplayPositions } from "../../../types";

type DivergengyProps = {
  positions: DisplayPositions;
};

export const Divergency = ({
  positions: nextPositions,
}: DivergengyProps): React.JSX.Element => {
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

  return (
    <div className="divergency">
      <Spring
        from={{
          opacity: open === "open" ? 0 : 1,
          width: open === "open" ? -10 : 0,
        }}
        delay={2000}
        to={{
          opacity: open === "open" ? 1 : 0,
          width: open === "open" ? 0 : 10,
        }}
        config={{ mass: 3, tension: 600, friction: 100 }}
        key={positions.num}
      >
        {(springProps: { opacity: number; width: number }) => (
          <div
            className="divergencyBlock"
            style={{
              top: positions.y,
              left: positions.x > 1000 ? positions.x - 200 : positions.x,
              textAlign: positions.x < 1000 ? "left" : "right",
              opacity: springProps.opacity,
              letterSpacing: springProps.width,
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
          </div>
        )}
      </Spring>
    </div>
  );
};
