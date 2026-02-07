import React from "react";
import { Spring } from "react-spring/renderprops";

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
}: NavBarProps): React.JSX.Element => {
  return (
    <div>
      <Spring
        from={{
          marginTop: inProgress && !initial ? 0 : -190,
          cancel: inProgress && !initial ? -190 : -190,
        }}
        to={{
          marginTop: inProgress ? -190 : 0,
          cancel: inProgress && !initial ? 180 : -190,
        }}
        config={{ mass: 3, tension: 600, friction: 100 }}
        key={String(inProgress)}
      >
        {(springProps: { marginTop: number; cancel: number }) => (
          <div
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
            <button
              style={{
                marginTop: springProps.cancel,
              }}
              className="navButton cancel"
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        )}
      </Spring>
    </div>
  );
};
