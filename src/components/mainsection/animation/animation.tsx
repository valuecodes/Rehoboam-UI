import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  HIDDEN_RING_POSITION,
  RingPosition,
  TimelineEvent,
} from "../../../types";
import CoronaData from "./../data/corona.json";
import Create from "./../navigation/create/create";
import NavBar from "./../navigation/navbar";
import Canvas from "./canvas";

interface AnimationProps {
  active: (pos: RingPosition, data: TimelineEvent) => void;
}

interface CoronaDataPayload {
  data: TimelineEvent[];
}

const INITIAL_SYSTEM_EVENT: TimelineEvent = {
  Date: "21.04.20",
  Country: "SYSTEM INIATED",
  Country2: "",
  Type: "",
  Location: "",
  Message: "UNDISCLOSED LOCATION",
  Add: "'ABSALOM' BUILD 0.08",
  initial: true,
};

function getRandomInt(max: number): number {
  return Math.floor(Math.random() * Math.floor(max));
}

function createHiddenPosition(): RingPosition {
  return { ...HIDDEN_RING_POSITION };
}

function buildPositions(): RingPosition[] {
  const points: RingPosition[] = [];
  const value = 5.56;

  for (let i = 0; i < 35; i += 1) {
    points.push({
      x1: 400 + 390 * Math.cos(i / value),
      y1: 400 + 390 * Math.sin(i / value),
      x2: 400 + 396 * Math.cos(i / value),
      y2: 400 + 396 * Math.sin(i / value),
      num: i,
    });
  }

  return points;
}

function Animation({ active }: AnimationProps): JSX.Element {
  const [positions, setPositions] = useState<RingPosition[]>([]);
  const [pos, setPos] = useState<RingPosition>(createHiddenPosition());
  const [dataPosition, setDataPosition] = useState(0);
  const [inProgress, setInProgress] = useState(true);
  const [initial, setInitial] = useState(true);
  const [create, setCreate] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const introTimeoutRef = useRef<number | null>(null);
  const dataPositionRef = useRef(0);
  const positionsRef = useRef<RingPosition[]>([]);

  const clearPlaybackInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const getActivePositionForIndex = useCallback(
    (
      timelineData: TimelineEvent[],
      index: number,
      update: boolean
    ): RingPosition => {
      const selectedData = timelineData[index];

      if (!selectedData) {
        return createHiddenPosition();
      }

      let num = getRandomInt(34);

      if (selectedData.Add.length !== 0) {
        num = getRandomInt(16);
      }

      if (selectedData.initial) {
        num = 2;
      }

      const basePosition = positionsRef.current[num] ?? createHiddenPosition();
      const activePosition = {
        ...basePosition,
        num,
      };

      if (update) {
        active(activePosition, selectedData);
      }

      return activePosition;
    },
    [active]
  );

  const startPlayback = useCallback(
    (timelineData: TimelineEvent[]) => {
      if (timelineData.length === 0) {
        return;
      }

      clearPlaybackInterval();

      const firstPosition = getActivePositionForIndex(timelineData, 0, true);
      setPos(firstPosition);
      setDataPosition(1);
      dataPositionRef.current = 1;
      setInProgress(true);
      setCreate(false);

      intervalRef.current = window.setInterval(() => {
        const nextDataPosition = dataPositionRef.current + 1;

        if (nextDataPosition > timelineData.length) {
          setPos(createHiddenPosition());
          setDataPosition(0);
          dataPositionRef.current = 0;
          setInProgress(false);
          clearPlaybackInterval();
          return;
        }

        const nextPosition = getActivePositionForIndex(
          timelineData,
          dataPositionRef.current,
          true
        );

        setPos(nextPosition);
        setDataPosition(nextDataPosition);
        dataPositionRef.current = nextDataPosition;
        setInProgress(true);
      }, 8000);
    },
    [clearPlaybackInterval, getActivePositionForIndex]
  );

  const restart = useCallback(() => {
    const data = (CoronaData as CoronaDataPayload).data;
    startPlayback(data);
  }, [startPlayback]);

  const toggleCreate = useCallback(() => {
    setCreate((currentCreate) => !currentCreate);
  }, []);

  const launchCustom = useCallback(
    (customData: TimelineEvent[]) => {
      startPlayback(customData);
    },
    [startPlayback]
  );

  const cancel = useCallback(() => {
    clearPlaybackInterval();
    setPos(createHiddenPosition());
    setDataPosition(0);
    dataPositionRef.current = 0;
    setInProgress(false);
  }, [clearPlaybackInterval]);

  useEffect(() => {
    const generatedPositions = buildPositions();
    const firstPos = 30;
    const firstPosition = {
      ...generatedPositions[firstPos],
      num: firstPos,
    };

    positionsRef.current = generatedPositions;
    setPositions(generatedPositions);
    setPos(firstPosition);
    active(firstPosition, INITIAL_SYSTEM_EVENT);

    introTimeoutRef.current = window.setTimeout(() => {
      setPos(createHiddenPosition());
      setDataPosition(0);
      dataPositionRef.current = 0;
      setInProgress(false);
      setInitial(false);
    }, 7000);

    return () => {
      clearPlaybackInterval();

      if (introTimeoutRef.current !== null) {
        window.clearTimeout(introTimeoutRef.current);
        introTimeoutRef.current = null;
      }
    };
  }, [active, clearPlaybackInterval]);

  useEffect(() => {
    dataPositionRef.current = dataPosition;
  }, [dataPosition]);

  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  return (
    <div id="center" className="mainContainer">
      <svg className="svgCenter" width="800px" height="800px">
        {positions.map((line, index) => (
          <circle
            key={index}
            cx={line.x2}
            cy={line.y2}
            r="0"
            style={{
              r: 0,
              stroke: "black",
            }}
          />
        ))}
      </svg>
      <Canvas divergence={pos} />
      <NavBar
        inProgress={inProgress}
        initial={initial}
        restart={restart}
        create={toggleCreate}
        cancel={cancel}
      />
      <Create initial={initial} isOn={create} launchCustom={launchCustom} />
    </div>
  );
}

export default Animation;
