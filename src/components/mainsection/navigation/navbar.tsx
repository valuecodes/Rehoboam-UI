import React from "react";
import { animated, useSpring } from "react-spring";

type NavBarProps = {
  initial: boolean;
  inProgress: boolean;
  restart: () => void;
  create: () => void;
  cancel: () => void;
};

export const NavBar = ({
  initial,
  inProgress,
  restart,
  create,
  cancel,
}: NavBarProps) => {
  const springProps = useSpring({
    from: {
      marginTop: inProgress && !initial ? 0 : -190,
      cancelMargin: inProgress && !initial ? -190 : -190,
    },
    to: {
      marginTop: inProgress ? -190 : 0,
      cancelMargin: inProgress && !initial ? 180 : -190,
    },
    config: { mass: 3, tension: 600, friction: 100 },
  });

  return (
    <div>
      <animated.div
        className="navBar"
        style={{
          marginTop: springProps.marginTop,
        }}
      >
        <svg className="navSvg" height="150" width="100%">
          <polyline
            points="
                            5 25,
                            5 10,
                            20 0,
                            220 0,
                            320 0,
                            "
            style={{ fill: "none", stroke: "black", strokeWidth: 1 }}
          />
        </svg>
        <button className="navButton" onClick={restart}>
          Covid 19
        </button>
        <button className="navButton" onClick={create}>
          Create
        </button>
        <animated.button
          style={{
            marginTop: springProps.cancelMargin,
          }}
          className="navButton cancel"
          onClick={cancel}
        >
          Cancel
        </animated.button>
      </animated.div>
    </div>
  );
};
