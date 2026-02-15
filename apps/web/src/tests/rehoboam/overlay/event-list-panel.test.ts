import { getNextPanelIndexForLength } from "../../../features/rehoboam/overlay/event-list-panel";

describe("getNextPanelIndexForLength", () => {
  it("returns -1 for empty lists", () => {
    expect(getNextPanelIndexForLength(0, -1, 1)).toBe(-1);
  });

  it("selects first/last when current selection is missing", () => {
    expect(getNextPanelIndexForLength(4, -1, 1)).toBe(0);
    expect(getNextPanelIndexForLength(4, -1, -1)).toBe(3);
  });

  it("wraps index forward and backward", () => {
    expect(getNextPanelIndexForLength(4, 3, 1)).toBe(0);
    expect(getNextPanelIndexForLength(4, 0, -1)).toBe(3);
    expect(getNextPanelIndexForLength(4, 1, 1)).toBe(2);
  });
});
