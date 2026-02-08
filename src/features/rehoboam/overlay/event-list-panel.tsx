import { useMemo } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import type { WorldEventSeverity } from "../engine/types";
import type { ComputedEventAngle } from "../layout/compute-angles";

export type EventListPanelProps = Readonly<{
  eventAngles: readonly ComputedEventAngle[];
  activeEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  onClearSelection: () => void;
}>;

type EventListPanelItem = Readonly<{
  eventAngle: ComputedEventAngle;
  optionId: string;
}>;

const SEVERITY_RANK: Readonly<Record<WorldEventSeverity, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const comparePanelItems = (
  left: EventListPanelItem,
  right: EventListPanelItem
): number => {
  const severityDelta =
    SEVERITY_RANK[right.eventAngle.event.severity] -
    SEVERITY_RANK[left.eventAngle.event.severity];

  if (severityDelta !== 0) {
    return severityDelta;
  }

  if (
    left.eventAngle.event.timestampMs !== right.eventAngle.event.timestampMs
  ) {
    return (
      right.eventAngle.event.timestampMs - left.eventAngle.event.timestampMs
    );
  }

  return left.eventAngle.event.id.localeCompare(right.eventAngle.event.id);
};

const formatPanelTime = (timestampMs: number): string => {
  const isoTime = new Date(timestampMs).toISOString().slice(11, 19);

  return isoTime.replace(/:/gu, ".");
};

const getActivePanelIndex = (
  items: readonly EventListPanelItem[],
  activeEventId: string | null
): number => {
  if (activeEventId === null) {
    return -1;
  }

  for (let index = 0; index < items.length; index += 1) {
    if (items[index].eventAngle.eventIds.includes(activeEventId)) {
      return index;
    }
  }

  return -1;
};

export const getNextPanelIndexForLength = (
  length: number,
  currentIndex: number,
  direction: -1 | 1
): number => {
  const sanitizedLength = Math.max(0, Math.trunc(length));

  if (sanitizedLength === 0) {
    return -1;
  }

  if (currentIndex < 0 || currentIndex >= sanitizedLength) {
    return direction > 0 ? 0 : sanitizedLength - 1;
  }

  const nextIndex = currentIndex + direction;

  if (nextIndex < 0) {
    return sanitizedLength - 1;
  }

  if (nextIndex >= sanitizedLength) {
    return 0;
  }

  return nextIndex;
};

const getPanelItemClassName = (isActive: boolean): string => {
  return isActive
    ? "rehoboam-scene__event-option rehoboam-scene__event-option--active"
    : "rehoboam-scene__event-option";
};

export const EventListPanel = ({
  eventAngles,
  activeEventId,
  onSelectEvent,
  onClearSelection,
}: EventListPanelProps) => {
  const panelItems = useMemo(() => {
    return [...eventAngles]
      .map((eventAngle) => {
        return {
          eventAngle,
          optionId: `rehoboam-event-option-${eventAngle.event.id}`,
        };
      })
      .sort(comparePanelItems);
  }, [eventAngles]);
  const activePanelIndex = getActivePanelIndex(panelItems, activeEventId);
  const activeDescendantId =
    activePanelIndex < 0 ? undefined : panelItems[activePanelIndex].optionId;

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (panelItems.length === 0) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      const nextIndex = getNextPanelIndexForLength(
        panelItems.length,
        activePanelIndex,
        1
      );

      if (nextIndex >= 0) {
        event.preventDefault();
        onSelectEvent(panelItems[nextIndex].eventAngle.event.id);
      }

      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      const nextIndex = getNextPanelIndexForLength(
        panelItems.length,
        activePanelIndex,
        -1
      );

      if (nextIndex >= 0) {
        event.preventDefault();
        onSelectEvent(panelItems[nextIndex].eventAngle.event.id);
      }

      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      onSelectEvent(panelItems[0].eventAngle.event.id);

      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      onSelectEvent(panelItems[panelItems.length - 1].eventAngle.event.id);

      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClearSelection();
    }
  };

  return (
    <aside
      aria-label="Observed event list"
      className="rehoboam-scene__event-panel"
    >
      <header className="rehoboam-scene__event-panel-header">
        <h2
          className="rehoboam-scene__event-panel-title"
          id="rehoboam-event-panel-title"
        >
          Observed Events
        </h2>
        <p className="rehoboam-scene__event-panel-subtitle">
          {panelItems.length} ACTIVE SIGNALS
        </p>
      </header>
      <div
        aria-activedescendant={activeDescendantId}
        aria-labelledby="rehoboam-event-panel-title"
        className="rehoboam-scene__event-list"
        onKeyDown={handleListKeyDown}
        role="listbox"
        tabIndex={0}
      >
        {panelItems.length === 0 ? (
          <p className="rehoboam-scene__event-empty">No events available.</p>
        ) : (
          panelItems.map((item) => {
            const isActive =
              activeEventId !== null &&
              item.eventAngle.eventIds.includes(activeEventId);

            return (
              <div
                aria-selected={isActive}
                className={getPanelItemClassName(isActive)}
                id={item.optionId}
                key={item.eventAngle.event.id}
                onClick={() => {
                  onSelectEvent(item.eventAngle.event.id);
                }}
                role="option"
              >
                <p className="rehoboam-scene__event-time">
                  {formatPanelTime(item.eventAngle.event.timestampMs)}
                </p>
                <p className="rehoboam-scene__event-title">
                  {item.eventAngle.event.title.toUpperCase()}
                </p>
                <p className="rehoboam-scene__event-meta">
                  {item.eventAngle.event.severity.toUpperCase()} /{" "}
                  {item.eventAngle.event.category.toUpperCase()}
                  {item.eventAngle.isCluster
                    ? ` / CLUSTER ${item.eventAngle.clusterSize}`
                    : ""}
                </p>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
