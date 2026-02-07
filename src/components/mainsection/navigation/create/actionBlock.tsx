import React, { ChangeEvent } from "react";
import { Spring } from "react-spring/renderprops";

import { TimelineEvent } from "../../../../types";

type EditableField = "Date" | "Country" | "Message" | "Add";

interface ActionBlockProps {
  id: number;
  index: number;
  data: TimelineEvent;
  deleteActionBlock: (id: number) => void;
  addData: (field: EditableField, index: number, value: string) => void;
}

function ActionBlock({
  id,
  index,
  data,
  deleteActionBlock,
  addData,
}: ActionBlockProps): JSX.Element {
  const handleChange =
    (field: EditableField) => (event: ChangeEvent<HTMLInputElement>) => {
      addData(field, index, event.target.value);
    };

  return (
    <div className="actionBlock">
      <Spring
        from={{
          x: -800,
          opacity: 0,
          width: 0,
        }}
        to={{
          x: 0,
          opacity: 1,
          width: 220,
        }}
        config={{ duration: 400 }}
      >
        {(springProps: any) => (
          <div>
            <div
              className="actionHeader"
              style={{
                opacity: springProps.opacity,
              }}
            >
              <h2>Event {index + 1}</h2>
              <button
                className="menuActionButton"
                onClick={() => deleteActionBlock(id)}
              >
                Delete
              </button>
            </div>
            <div className="addText">
              <svg className="actionBlockSVG" height="150" width="100%">
                <polyline
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
                    strokeDashoffset: -springProps.x,
                  }}
                />
              </svg>
              <div className="textInputs">
                <input
                  style={{
                    width: springProps.width,
                  }}
                  value={data.Date}
                  onChange={handleChange("Date")}
                  className="addInput"
                  placeholder="Date"
                />
                <input
                  style={{
                    width: springProps.width,
                  }}
                  value={data.Country}
                  onChange={handleChange("Country")}
                  className="addInput"
                  placeholder="Location"
                />
                <input
                  style={{
                    width: springProps.width,
                  }}
                  value={data.Message}
                  onChange={handleChange("Message")}
                  className="addInput"
                  placeholder="Message"
                />
                <input
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
        )}
      </Spring>
    </div>
  );
}

export default ActionBlock;
