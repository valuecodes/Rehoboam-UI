import React, { useCallback, useState } from "react";

import type {
  DisplayPositions,
  RingPosition,
  TimelineEvent,
} from "../../types";
import { EMPTY_DISPLAY_POSITIONS } from "../../types";
import { Animation } from "./animation/animation";
import { Divergency } from "./divergency/divergengy";
import { MainSVG } from "./divergency/mainSVG";

export const Reheboam = (): React.JSX.Element => {
  const [positions, setPositions] = useState<DisplayPositions>(
    EMPTY_DISPLAY_POSITIONS
  );

  const active = useCallback((pos: RingPosition, data: TimelineEvent) => {
    const centerElement = document.getElementById("center");
    const homePageContentElement = document.getElementById("homePageContent");

    if (!centerElement || !homePageContentElement) {
      return;
    }

    const centerOffsets = centerElement.getBoundingClientRect();
    const homePageOffsets = homePageContentElement.getBoundingClientRect();

    const top = centerOffsets.top;
    const left = centerOffsets.left;

    let positionx = 0;
    let positiony = 30;

    if (pos.num < 8) {
      positionx = homePageOffsets.width * 0.7;
      positiony = homePageOffsets.height - 200;
    }

    if (pos.num < 17 && pos.num > 7) {
      positionx = homePageOffsets.width * 0.1;
      positiony = homePageOffsets.height - 200;
    }

    if (pos.num < 26 && pos.num > 16) {
      positionx = homePageOffsets.width * 0.1;
      positiony = 30;
    }

    if (pos.num > 25) {
      positionx = homePageOffsets.width * 0.7;
      positiony = 30;
    }

    if (document.documentElement.clientWidth < 1050) {
      if (pos.num < 8) {
        positionx = homePageOffsets.width * 0.1;
        positiony = homePageOffsets.height - 200;
      }

      if (pos.num > 25) {
        positionx = homePageOffsets.width * 0.1;
        positiony = 30;
      }
    }

    if (data.initial) {
      positiony = homePageOffsets.height / 2 - 60;
      positionx = homePageOffsets.width / 2 - 200;
    }

    setPositions({
      x: positionx,
      y: positiony,
      x2: left + pos.x2,
      y2: top + pos.y2,
      num: pos.num,
      data,
    });
  }, []);

  return (
    <div id="homePageContent">
      <Animation active={active} />
      <MainSVG positions={positions} />
      <Divergency positions={positions} />
    </div>
  );
};
