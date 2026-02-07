import React, { useRef, useState } from "react";
import { Spring } from "react-spring/renderprops";
import ActionBlock from "./actionBlock";
import { TimelineEvent } from "../../../../types";

interface CreateProps {
  initial: boolean;
  isOn: boolean;
  launchCustom: (customData: TimelineEvent[]) => void;
}

type EditableField = "Date" | "Country" | "Message" | "Add";

interface CustomAction extends TimelineEvent {
  id: number;
}

function buildEmptyAction(id: number): CustomAction {
  return {
    id,
    Date: "",
    Country: "",
    Country2: "",
    Type: "",
    Location: "",
    Message: "",
    Add: "",
    initial: false,
  };
}

function Create({ isOn, initial, launchCustom }: CreateProps): JSX.Element {
  const [actions, setActions] = useState<CustomAction[]>([buildEmptyAction(1)]);
  const nextIdRef = useRef(1);

  const addNew = () => {
    nextIdRef.current += 1;
    setActions((currentActions) => [
      ...currentActions,
      buildEmptyAction(nextIdRef.current),
    ]);
  };

  const deleteActionBlock = (id: number) => {
    setActions((currentActions) =>
      currentActions.filter((action) => action.id !== id),
    );
  };

  const launch = () => {
    launchCustom(actions);
  };

  const addData = (field: EditableField, index: number, value: string) => {
    setActions((currentActions) =>
      currentActions.map((action, actionIndex) => {
        if (actionIndex !== index) {
          return action;
        }

        return {
          ...action,
          [field]: value,
        };
      }),
    );
  };

  return (
    <Spring
      from={{
        marginRight: !isOn && initial !== true ? 0 : -600,
      }}
      to={{
        marginRight: !isOn ? -600 : 0,
      }}
      config={{ mass: 5, tension: 600, friction: 80 }}
      key={String(isOn)}
    >
      {(springProps: any) => (
        <div
          className="createMenu"
          style={{
            marginRight: springProps.marginRight,
          }}
        >
          <div className="menuButtons">
            <svg className="createSvg" height="100%" width="400px">
              <polyline
                points={
                  "5 1505," + "5 15," + "20 2," + "220 2," + "420 2,"
                }
                style={{
                  fill: "none",
                  stroke: "black",
                  strokeWidth: 2,
                }}
              />
            </svg>
            <button className="menuActionButton" onClick={addNew}>
              Add new
            </button>
            <button className="menuActionButton" onClick={launch}>
              Launch
            </button>
          </div>
          <div className="createBlock">
            {actions.map((action, index) => (
              <ActionBlock
                id={action.id}
                key={action.id}
                data={action}
                index={index}
                deleteActionBlock={deleteActionBlock}
                addData={addData}
              />
            ))}
          </div>
        </div>
      )}
    </Spring>
  );
}

export default Create;
