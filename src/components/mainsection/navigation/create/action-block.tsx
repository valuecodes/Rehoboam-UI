import type { ChangeEvent } from "react";
import React from "react";
import { animated, useSpring } from "react-spring";

import type { TimelineEvent } from "../../../../types";

type EditableField = "Date" | "Country" | "Message" | "Add";

type ActionBlockProps = {
  id: number;
  index: number;
  data: TimelineEvent;
  deleteActionBlock: (id: number) => void;
  addData: (field: EditableField, index: number, value: string) => void;
};

export const ActionBlock = ({
  id,
  index,
  data,
  deleteActionBlock,
  addData,
}: ActionBlockProps) => {
  const handleChange =
    (field: EditableField) => (event: ChangeEvent<HTMLInputElement>) => {
      addData(field, index, event.target.value);
    };

  const springProps = useSpring({
    from: {
      x: -800,
      opacity: 0,
      width: 0,
    },
    to: {
      x: 0,
      opacity: 1,
      width: 220,
    },
    config: { duration: 400 },
  });

  return (
    <div className="actionBlock">
      <animated.div
        className="actionHeader"
        style={{
          opacity: springProps.opacity,
        }}
      >
        <h2>Event {index + 1}</h2>
        <button
          className="menuActionButton"
          onClick={() => {
            deleteActionBlock(id);
          }}
        >
          Delete
        </button>
      </animated.div>
      <div className="addText">
        <svg className="actionBlockSVG" height="150" width="100%">
          <animated.polyline
            points="
                            5 0,
                            5 60,
                            15 70,
                            30 70,
                            30 110,
                            40 120,
                            50 120,
                            40 120,
                            30 110,
                            30 70,
                            50 50,
                            275 50
                            "
            style={{
              fill: "none",
              stroke: "black",
              strokeWidth: 2,
              strokeDashoffset: springProps.x.to((v) => -v),
            }}
          />
        </svg>
        <div className="textInputs">
          <animated.input
            style={{
              width: springProps.width,
            }}
            value={data.Date}
            onChange={handleChange("Date")}
            className="addInput"
            placeholder="Date"
          />
          <animated.input
            style={{
              width: springProps.width,
            }}
            value={data.Country}
            onChange={handleChange("Country")}
            className="addInput"
            placeholder="Location"
          />
          <animated.input
            style={{
              width: springProps.width,
            }}
            value={data.Message}
            onChange={handleChange("Message")}
            className="addInput"
            placeholder="Message"
          />
          <animated.input
            style={{
              width: springProps.width,
            }}
            value={data.Add}
            onChange={handleChange("Add")}
            className="addInput"
            placeholder="Additional"
          />
        </div>
        <div className="addSettings" />
      </div>
    </div>
  );
};
