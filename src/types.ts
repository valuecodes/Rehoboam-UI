export type TimelineEvent = {
  id?: number;
  Date: string;
  Country: string;
  Country2: string;
  Type: string;
  Location: string;
  Message: string;
  Add: string;
  initial: boolean;
};

export type RingPosition = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  num: number;
};

export type DisplayPositions = {
  x: number;
  y: number;
  x2: number;
  y2: number;
  num: number;
  data: TimelineEvent;
};

export const EMPTY_TIMELINE_EVENT: TimelineEvent = {
  Date: "",
  Country: "",
  Country2: "",
  Type: "",
  Location: "",
  Message: "",
  Add: "",
  initial: false,
};

export const HIDDEN_RING_POSITION: RingPosition = {
  x1: 0,
  y1: 0,
  x2: 1,
  y2: 1,
  num: -1,
};

export const EMPTY_DISPLAY_POSITIONS: DisplayPositions = {
  x: 0,
  y: 0,
  x2: 0,
  y2: 0,
  num: -1,
  data: EMPTY_TIMELINE_EVENT,
};
