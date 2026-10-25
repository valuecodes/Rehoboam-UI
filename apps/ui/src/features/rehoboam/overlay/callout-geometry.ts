import type { CSSProperties } from "react";

import type { WorldEvent } from "~/features/rehoboam/engine/types";
import { polarToCartesian } from "~/features/rehoboam/layout/polar";

import type { CalloutDebugLock, CalloutDebugSideLock } from "./callout-debug";
import { clampNumber, toPointList } from "./utils";
import type { Point } from "./utils";

type InstrumentSize = Readonly<{
  width: number;
  height: number;
}>;

type CalloutOverlayTarget = Readonly<{
  event: WorldEvent;
  angleRad: number;
  anchorRadius: number;
}>;

type CalloutGeometry = Readonly<{
  event: WorldEvent;
  anchorX: number;
  anchorY: number;
  labelX: number;
  labelY: number;
  labelWidth: number;
  textAlign: "left" | "right";
  connectorPath: string;
  framePoints: string;
  timeMarginTop: number;
  endpointOuterRadius: number;
  endpointInnerRadius: number;
  titleLocationStyle: Pick<CSSProperties, "display" | "marginInlineStart">;
}>;

const CALLOUT_ENDPOINT_OUTER_RADIUS_PX = 6;
const CALLOUT_ENDPOINT_INNER_RADIUS_PX = 2.25;
const TOP_LAYOUT_TIME_MARGIN_PX = 10;
const RIGHT_LAYOUT_FRAME_START_RATIO = 2 / 3;
const TOP_LAYOUT_HEADER_LINE_LENGTH_RATIO = 0.53;
const BOTTOM_LAYOUT_HEADER_LINE_LENGTH_RATIO = 0.53;
const TOP_LAYOUT_FIRST_FRAME_OFFSET_PX = 30;
const BOTTOM_LAYOUT_FIRST_FRAME_OFFSET_PX = 55;
const TOP_LAYOUT_THIRD_FRAME_OFFSET_PX = 40;
const TOP_LAYOUT_FOURTH_FRAME_OFFSET_PX = 60;
const TOP_LAYOUT_FIFTH_FRAME_OFFSET_PX = 75;
const BOTTOM_LAYOUT_THIRD_FRAME_OFFSET_PX = 40;
const BOTTOM_LAYOUT_FOURTH_FRAME_OFFSET_PX = 20;
const BOTTOM_LAYOUT_FIFTH_FRAME_OFFSET_PX = 0;
const CALLOUT_CENTER_KEEP_OUT_PX = 12;
const COMPACT_LAYOUT_WIDTH_PX = 700;
const COMPACT_LABEL_HEIGHT_PX = 108;
const COMPACT_LABEL_LEFT_INSET_PX = 24;
const COMPACT_FRAME_INSET_X_PX = 10;
const COMPACT_BOTTOM_LABEL_SHIFT_PX = 70;
const COMPACT_TOP_LAYOUT_HEADER_LINE_LENGTH_RATIO = 0.56;
const COMPACT_BOTTOM_LAYOUT_HEADER_LINE_LENGTH_RATIO = 0.56;
const COMPACT_TOP_LAYOUT_FIRST_FRAME_OFFSET_PX = 24;
const COMPACT_BOTTOM_LAYOUT_FIRST_FRAME_OFFSET_PX = 37;
const COMPACT_TOP_LAYOUT_THIRD_FRAME_OFFSET_PX = 32;
const COMPACT_TOP_LAYOUT_FOURTH_FRAME_OFFSET_PX = 44;
const COMPACT_TOP_LAYOUT_FIFTH_FRAME_OFFSET_PX = 59;
const COMPACT_BOTTOM_LAYOUT_THIRD_FRAME_OFFSET_PX = 30;
const COMPACT_BOTTOM_LAYOUT_FOURTH_FRAME_OFFSET_PX = 16;
const COMPACT_BOTTOM_LAYOUT_FIFTH_FRAME_OFFSET_PX = 0;
const COMPACT_ENDPOINT_OUTER_RADIUS_PX = 4.5;
const COMPACT_ENDPOINT_INNER_RADIUS_PX = 1.8;

const getCalloutGeometry = (
  instrumentSize: InstrumentSize,
  target: CalloutOverlayTarget,
  debugLock: CalloutDebugLock | null,
  debugSideLock: CalloutDebugSideLock | null
): CalloutGeometry | null => {
  if (instrumentSize.width <= 0 || instrumentSize.height <= 0) {
    return null;
  }

  const center = {
    x: instrumentSize.width / 2,
    y: instrumentSize.height / 2,
  };
  const anchor = polarToCartesian(
    {
      radius: target.anchorRadius,
      angleRad: target.angleRad,
    },
    center
  );
  const isLowerHalf = anchor.y >= center.y;
  const isCompactViewport = instrumentSize.width <= COMPACT_LAYOUT_WIDTH_PX;
  const margin = isCompactViewport
    ? Math.max(20, instrumentSize.width * 0.05)
    : Math.max(12, instrumentSize.width * 0.02);
  const lockedToTop = debugLock === "top";
  const lockedToBottom = debugLock === "bottom";
  const lockedToLeft = debugSideLock === "left";

  if (isCompactViewport) {
    const labelX = margin + COMPACT_LABEL_LEFT_INSET_PX;
    const maxLabelWidth = Math.max(180, instrumentSize.width - labelX - margin);
    const labelWidth = maxLabelWidth;
    const labelHeight = COMPACT_LABEL_HEIGHT_PX;
    const shouldPlaceBottom = lockedToBottom || (!lockedToTop && !isLowerHalf);
    const compactBottomMargin = Math.max(
      8,
      margin - COMPACT_BOTTOM_LABEL_SHIFT_PX
    );
    const labelY = shouldPlaceBottom
      ? instrumentSize.height - labelHeight - compactBottomMargin
      : margin;
    const compactCornerStep = clampNumber(
      Math.round(instrumentSize.width * 0.024),
      8,
      12
    );
    const firstFrameX = labelX + COMPACT_FRAME_INSET_X_PX;
    const firstFrameY =
      labelY +
      (shouldPlaceBottom
        ? COMPACT_BOTTOM_LAYOUT_FIRST_FRAME_OFFSET_PX
        : COMPACT_TOP_LAYOUT_FIRST_FRAME_OFFSET_PX);
    const secondFrameX = firstFrameX - compactCornerStep;
    const secondFrameY = firstFrameY;
    const thirdFrameX = firstFrameX - compactCornerStep * 2;
    const thirdFrameY =
      labelY +
      (shouldPlaceBottom
        ? COMPACT_BOTTOM_LAYOUT_THIRD_FRAME_OFFSET_PX
        : COMPACT_TOP_LAYOUT_THIRD_FRAME_OFFSET_PX);
    const fourthFrameX = thirdFrameX;
    const fourthFrameY =
      labelY +
      (shouldPlaceBottom
        ? COMPACT_BOTTOM_LAYOUT_FOURTH_FRAME_OFFSET_PX
        : COMPACT_TOP_LAYOUT_FOURTH_FRAME_OFFSET_PX);
    const fifthFrameX = firstFrameX;
    const fifthFrameY =
      labelY +
      (shouldPlaceBottom
        ? COMPACT_BOTTOM_LAYOUT_FIFTH_FRAME_OFFSET_PX
        : COMPACT_TOP_LAYOUT_FIFTH_FRAME_OFFSET_PX);
    const compactLineLengthRatio = shouldPlaceBottom
      ? COMPACT_BOTTOM_LAYOUT_HEADER_LINE_LENGTH_RATIO
      : COMPACT_TOP_LAYOUT_HEADER_LINE_LENGTH_RATIO;
    const compactLineLength = labelWidth * compactLineLengthRatio;
    const lineEndX = firstFrameX + compactLineLength;
    const lineEndY = fifthFrameY;
    const framePointList: readonly Point[] = [
      {
        x: firstFrameX,
        y: firstFrameY,
      },
      {
        x: secondFrameX,
        y: secondFrameY,
      },
      {
        x: thirdFrameX,
        y: thirdFrameY,
      },
      {
        x: fourthFrameX,
        y: fourthFrameY,
      },
      {
        x: fifthFrameX,
        y: fifthFrameY,
      },
      {
        x: lineEndX,
        y: lineEndY,
      },
    ];

    return {
      event: target.event,
      anchorX: anchor.x,
      anchorY: anchor.y,
      labelX,
      labelY,
      labelWidth,
      textAlign: "left",
      connectorPath: `M ${anchor.x} ${anchor.y} L ${lineEndX} ${lineEndY}`,
      framePoints: toPointList(framePointList),
      timeMarginTop: 0,
      endpointOuterRadius: COMPACT_ENDPOINT_OUTER_RADIUS_PX,
      endpointInnerRadius: COMPACT_ENDPOINT_INNER_RADIUS_PX,
      titleLocationStyle: {
        display: "inline",
        marginInlineStart: "0.3ch",
      },
    };
  }

  const maxPanelWidth = Math.max(180, instrumentSize.width - margin * 2);
  const minPanelWidth = Math.min(260, maxPanelWidth);
  const panelWidth = clampNumber(600, minPanelWidth, maxPanelWidth);
  const maxPanelHeight = Math.max(120, instrumentSize.height - margin * 2);
  const minPanelHeight = Math.min(120, maxPanelHeight);
  const panelHeight = clampNumber(200, minPanelHeight, maxPanelHeight);
  const isRightSide = anchor.x >= center.x;
  const rightPanelX = instrumentSize.width * 0.7;
  const leftPanelX = instrumentSize.width * 0.1;
  const prefersSingleSide = instrumentSize.width < 1050;
  const hasVerticalDebugLock = lockedToTop || lockedToBottom;
  // A vertical debug lock also pins the side (right unless locked left);
  // otherwise narrow viewports and left-half anchors use the left panel.
  const prefersLeftPanel = hasVerticalDebugLock
    ? lockedToLeft
    : prefersSingleSide || !isRightSide;
  const basePanelX = prefersLeftPanel ? leftPanelX : rightPanelX;
  const prefersBottomPanel = lockedToBottom || (!lockedToTop && isLowerHalf);
  const basePanelY = prefersBottomPanel
    ? instrumentSize.height - panelHeight
    : Math.max(30, margin);
  const panelX = clampNumber(
    basePanelX,
    margin,
    instrumentSize.width - panelWidth - margin
  );
  const panelY = clampNumber(
    basePanelY,
    margin,
    instrumentSize.height - panelHeight - margin
  );
  const isLeftLayout = panelX < center.x;
  const isBottomLayout = panelY > center.y;
  const cornerStep = 10;
  const firstFrameX =
    panelX + (isLeftLayout ? 0 : panelWidth * RIGHT_LAYOUT_FRAME_START_RATIO);
  const firstFrameY =
    panelY +
    (isBottomLayout
      ? BOTTOM_LAYOUT_FIRST_FRAME_OFFSET_PX
      : TOP_LAYOUT_FIRST_FRAME_OFFSET_PX);
  const secondFrameX = firstFrameX + (isLeftLayout ? -cornerStep : cornerStep);
  const secondFrameY = firstFrameY;
  const thirdFrameX =
    firstFrameX + (isLeftLayout ? -cornerStep * 2 : cornerStep * 2);
  const thirdFrameY =
    panelY +
    (isBottomLayout
      ? BOTTOM_LAYOUT_THIRD_FRAME_OFFSET_PX
      : TOP_LAYOUT_THIRD_FRAME_OFFSET_PX);
  const fourthFrameX = thirdFrameX;
  const fourthFrameY =
    panelY +
    (isBottomLayout
      ? BOTTOM_LAYOUT_FOURTH_FRAME_OFFSET_PX
      : TOP_LAYOUT_FOURTH_FRAME_OFFSET_PX);
  const fifthFrameX = firstFrameX;
  const fifthFrameY =
    panelY +
    (isBottomLayout
      ? BOTTOM_LAYOUT_FIFTH_FRAME_OFFSET_PX
      : TOP_LAYOUT_FIFTH_FRAME_OFFSET_PX);
  const lineLengthRatio = isBottomLayout
    ? BOTTOM_LAYOUT_HEADER_LINE_LENGTH_RATIO
    : TOP_LAYOUT_HEADER_LINE_LENGTH_RATIO;
  const lineLength = panelWidth * lineLengthRatio;
  const lineEndX = firstFrameX + (isLeftLayout ? lineLength : -lineLength);
  const lineEndY = fifthFrameY;
  const framePointList: readonly Point[] = [
    {
      x: firstFrameX,
      y: firstFrameY,
    },
    {
      x: secondFrameX,
      y: secondFrameY,
    },
    {
      x: thirdFrameX,
      y: thirdFrameY,
    },
    {
      x: fourthFrameX,
      y: fourthFrameY,
    },
    {
      x: fifthFrameX,
      y: fifthFrameY,
    },
    {
      x: lineEndX,
      y: lineEndY,
    },
  ];
  const textAlign = panelX < center.x ? "left" : "right";
  const preferredLabelX = panelX > center.x ? panelX - panelWidth / 3 : panelX;
  const desiredCenterGap = Math.max(CALLOUT_CENTER_KEEP_OUT_PX, margin);
  const safeLabelLeftEdge = center.x + desiredCenterGap;
  const safeLabelRightEdge = center.x - desiredCenterGap;
  const viewportRightEdge = instrumentSize.width - margin;
  const availableLeftWidth = Math.max(0, safeLabelRightEdge - margin);
  const availableRightWidth = Math.max(
    0,
    viewportRightEdge - safeLabelLeftEdge
  );
  const labelWidth = isLeftLayout
    ? Math.min(panelWidth, availableLeftWidth)
    : Math.min(panelWidth, availableRightWidth);
  const labelX = isLeftLayout
    ? clampNumber(
        preferredLabelX,
        margin,
        Math.max(margin, safeLabelRightEdge - labelWidth)
      )
    : clampNumber(
        preferredLabelX,
        Math.min(viewportRightEdge, safeLabelLeftEdge),
        Math.max(margin, viewportRightEdge - labelWidth)
      );
  const labelY = panelY;
  const timeMarginTop = panelY < 300 ? TOP_LAYOUT_TIME_MARGIN_PX : 0;

  return {
    event: target.event,
    anchorX: anchor.x,
    anchorY: anchor.y,
    labelX,
    labelY,
    labelWidth,
    textAlign,
    connectorPath: `M ${anchor.x} ${anchor.y} L ${lineEndX} ${lineEndY}`,
    framePoints: toPointList(framePointList),
    timeMarginTop,
    endpointOuterRadius: CALLOUT_ENDPOINT_OUTER_RADIUS_PX,
    endpointInnerRadius: CALLOUT_ENDPOINT_INNER_RADIUS_PX,
    titleLocationStyle: {
      display: "inline",
      marginInlineStart: "0.35ch",
    },
  };
};

export { getCalloutGeometry };
export type { CalloutOverlayTarget, InstrumentSize };
