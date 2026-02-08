import type {
  RehoboamTheme,
  ViewportState,
  WorldEvent,
  WorldEventSeverity,
} from "../../../engine/types";
import {
  computeAngles,
  DEFAULT_LAYOUT_WINDOW_MS,
  DEFAULT_MAX_VISIBLE_EVENT_COUNT,
} from "../../../layout/compute-angles";
import {
  normalizeAngle,
  polarToCartesian,
  shortestAngularDistance,
  TAU,
} from "../../../layout/polar";
import {
  DIVERGENCE_ATTACK_MS,
  DIVERGENCE_DECAY_MS,
  DIVERGENCE_PULSE_LIFETIME_MS,
} from "../divergence-constants";
import type { DivergencePulse } from "../divergence-pulse-tracker";

const LEADING_TIME_OFFSET_MS = 45 * 60 * 1000;

const PULSE_AMPLITUDE_SCALE: Readonly<Record<WorldEventSeverity, number>> = {
  low: 0.014,
  medium: 0.024,
  high: 0.038,
  critical: 0.06,
};

const PULSE_WINDOW_RAD: Readonly<Record<WorldEventSeverity, number>> = {
  low: 0.12,
  medium: 0.16,
  high: 0.2,
  critical: 0.24,
};

export type DivergencePassInput = Readonly<{
  context: CanvasRenderingContext2D;
  viewport: ViewportState;
  theme: RehoboamTheme;
  events: readonly WorldEvent[];
  pulses: readonly DivergencePulse[];
  elapsedMs: number;
  timeMs: number;
}>;

type ContourSample = Readonly<{
  angleRad: number;
  radius: number;
  pulseInfluence: number;
}>;

type ActivePulseDescriptor = Readonly<{
  angleRad: number;
  strength: number;
  severity: WorldEventSeverity;
}>;

const getTearCountForSeverity = (severity: WorldEventSeverity): number => {
  if (severity === "critical") {
    return 9;
  }

  if (severity === "high") {
    return 8;
  }

  if (severity === "medium") {
    return 7;
  }

  return 6;
};

const getLayoutNowMs = (events: readonly WorldEvent[]): number => {
  if (events.length === 0) {
    return 0;
  }

  const latestTimestampMs = events.reduce((latest, event) => {
    return Math.max(latest, event.timestampMs);
  }, 0);

  return latestTimestampMs + LEADING_TIME_OFFSET_MS;
};

const getPulseEnvelope = (elapsedMs: number): number => {
  if (elapsedMs <= 0 || elapsedMs >= DIVERGENCE_PULSE_LIFETIME_MS) {
    return 0;
  }

  if (elapsedMs <= DIVERGENCE_ATTACK_MS) {
    const attackProgress = elapsedMs / DIVERGENCE_ATTACK_MS;

    return attackProgress * attackProgress;
  }

  const decayProgress =
    (elapsedMs - DIVERGENCE_ATTACK_MS) / DIVERGENCE_DECAY_MS;

  return (1 - decayProgress) ** 2;
};

const getRaisedCosineWindow = (
  distanceRad: number,
  windowRad: number
): number => {
  if (distanceRad >= windowRad) {
    return 0;
  }

  return 0.5 * (1 + Math.cos((Math.PI * distanceRad) / windowRad));
};

const resolvePulseAngles = (
  events: readonly WorldEvent[],
  pulses: readonly DivergencePulse[]
): ReadonlyMap<string, number> => {
  const eventAngles = computeAngles(events, {
    nowMs: getLayoutNowMs(events),
    windowMs: DEFAULT_LAYOUT_WINDOW_MS,
    maxVisibleCount: DEFAULT_MAX_VISIBLE_EVENT_COUNT,
  });
  const angleByEventId = new Map<string, number>();

  for (const eventAngle of eventAngles) {
    for (const eventId of eventAngle.eventIds) {
      angleByEventId.set(eventId, eventAngle.angleRad);
    }
  }

  const pulseAngleByEventId = new Map<string, number>();

  for (const pulse of pulses) {
    const angleRad = angleByEventId.get(pulse.eventId);

    if (angleRad !== undefined) {
      pulseAngleByEventId.set(pulse.eventId, angleRad);
    }
  }

  return pulseAngleByEventId;
};

const resolveActivePulseDescriptors = (
  pulses: readonly DivergencePulse[],
  pulseAngles: ReadonlyMap<string, number>,
  timeMs: number
): readonly ActivePulseDescriptor[] => {
  const descriptors: ActivePulseDescriptor[] = [];

  for (const pulse of pulses) {
    const angleRad = pulseAngles.get(pulse.eventId);

    if (angleRad === undefined) {
      continue;
    }

    const elapsedPulseMs = timeMs - pulse.startedAtMs;
    const strength =
      getPulseEnvelope(elapsedPulseMs) * PULSE_AMPLITUDE_SCALE[pulse.severity];

    if (strength <= 0) {
      continue;
    }

    descriptors.push({
      angleRad,
      strength,
      severity: pulse.severity,
    });
  }

  return descriptors.sort((left, right) => {
    return right.strength - left.strength;
  });
};

const createContourSamples = (
  viewport: ViewportState,
  elapsedMs: number,
  timeMs: number,
  pulses: readonly DivergencePulse[],
  pulseAngles: ReadonlyMap<string, number>
): readonly ContourSample[] => {
  const samples = 360;
  const elapsedSeconds = elapsedMs / 1000;
  const baseRadius = viewport.outerRadius * 0.84;

  return Array.from({ length: samples + 1 }, (_, index) => {
    const angleRad = (index / samples) * TAU;
    const baselineOffset =
      Math.sin(angleRad * 11 + elapsedSeconds * 0.46) *
        viewport.outerRadius *
        0.0029 +
      Math.sin(angleRad * 23 - elapsedSeconds * 0.29) *
        viewport.outerRadius *
        0.0023;

    let pulseInfluence = 0;
    const pulseOffset = pulses.reduce((sum, pulse) => {
      const pulseAngleRad = pulseAngles.get(pulse.eventId);

      if (pulseAngleRad === undefined) {
        return sum;
      }

      const pulseElapsedMs = timeMs - pulse.startedAtMs;
      const timeEnvelope = getPulseEnvelope(pulseElapsedMs);

      if (timeEnvelope <= 0) {
        return sum;
      }

      const angularDistance = Math.abs(
        shortestAngularDistance(angleRad, pulseAngleRad)
      );
      const windowRad = PULSE_WINDOW_RAD[pulse.severity];
      const angularEnvelope = getRaisedCosineWindow(angularDistance, windowRad);

      if (angularEnvelope <= 0) {
        return sum;
      }

      const ripple =
        0.88 + 0.12 * Math.sin((pulseElapsedMs / 1000) * 10 + pulseAngleRad);
      const amplitude =
        viewport.outerRadius * PULSE_AMPLITUDE_SCALE[pulse.severity];
      const influence = timeEnvelope * angularEnvelope;
      pulseInfluence += influence;

      return sum + amplitude * influence * ripple;
    }, 0);
    const grainOffset =
      pulseInfluence <= 0
        ? 0
        : ((Math.sin(angleRad * 91 + elapsedSeconds * 8.4) +
            Math.sin(angleRad * 147 - elapsedSeconds * 6.2)) /
            2) *
          viewport.outerRadius *
          0.008 *
          Math.min(1, pulseInfluence * 1.25);
    const roughnessOffset =
      pulseInfluence <= 0
        ? 0
        : ((Math.sin(angleRad * 211 + elapsedSeconds * 10.6) +
            Math.sin(angleRad * 317 - elapsedSeconds * 8.1) +
            Math.sin(angleRad * 503 + elapsedSeconds * 13.2)) /
            3) *
          viewport.outerRadius *
          0.009 *
          Math.min(1, pulseInfluence * 1.35);

    return {
      angleRad,
      radius:
        baseRadius +
        baselineOffset +
        pulseOffset +
        grainOffset +
        roughnessOffset,
      pulseInfluence: Math.min(1, pulseInfluence),
    };
  });
};

const drawContourStroke = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  samples: readonly ContourSample[],
  strokeStyle: string,
  alpha: number,
  width: number
): void => {
  context.save();
  context.strokeStyle = strokeStyle;
  context.globalAlpha = alpha;
  context.lineWidth = width;
  context.setLineDash([]);
  context.lineDashOffset = 0;
  context.beginPath();

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const point = polarToCartesian(
      {
        radius: sample.radius,
        angleRad: sample.angleRad,
      },
      viewport.center
    );

    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  }

  context.stroke();
  context.restore();
};

const drawPulseGrain = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  samples: readonly ContourSample[],
  elapsedMs: number
): void => {
  const elapsedSeconds = elapsedMs / 1000;

  context.save();
  context.fillStyle = "#171717";

  for (let index = 0; index < samples.length; index += 2) {
    const sample = samples[index];

    if (sample.pulseInfluence < 0.08) {
      continue;
    }

    const jitter =
      (Math.sin(sample.angleRad * 133 + elapsedSeconds * 7.2) +
        Math.sin(sample.angleRad * 79 - elapsedSeconds * 5.6)) /
      2;
    const grainRadius =
      sample.radius +
      jitter * viewport.outerRadius * 0.01 * sample.pulseInfluence +
      viewport.outerRadius * 0.008 * sample.pulseInfluence;
    const point = polarToCartesian(
      {
        radius: grainRadius,
        angleRad: sample.angleRad,
      },
      viewport.center
    );

    context.globalAlpha = 0.05 + sample.pulseInfluence * 0.11;
    context.beginPath();
    context.arc(point.x, point.y, 0.9 + sample.pulseInfluence * 1.05, 0, TAU);
    context.fill();
  }

  context.restore();
};

const drawDirectionalTears = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  theme: RehoboamTheme,
  pulses: readonly ActivePulseDescriptor[],
  elapsedMs: number
): void => {
  const strongestPulses = pulses.slice(0, 2);
  const elapsedSeconds = elapsedMs / 1000;
  const baseRadius = viewport.outerRadius * 0.84;

  context.save();
  context.fillStyle = theme.ringColor;
  context.strokeStyle = theme.ringColor;

  for (const pulse of strongestPulses) {
    const tearCount = getTearCountForSeverity(pulse.severity);

    for (let index = 0; index < tearCount; index += 1) {
      const normalizedIndex =
        tearCount <= 1 ? 0 : index / (tearCount - 1) - 0.5;
      const localOffset = normalizedIndex * 0.22;
      const flutter =
        Math.sin(elapsedSeconds * 0.7 + pulse.angleRad * 4 + index * 0.8) *
        0.014;
      const angleRad = normalizeAngle(pulse.angleRad + localOffset + flutter);
      const noise =
        (Math.sin(angleRad * 41 + index * 1.37 + elapsedSeconds * 4.6) + 1) / 2;
      const widthRad = 0.0036 + pulse.strength * 0.14 * (0.5 + noise * 0.7);
      const tearHeight =
        viewport.outerRadius *
        (0.014 + pulse.strength * 1.45) *
        (0.52 + noise * 1.18);
      const tipRadius = baseRadius + tearHeight;
      const leftPoint = polarToCartesian(
        {
          radius: baseRadius,
          angleRad: normalizeAngle(angleRad - widthRad),
        },
        viewport.center
      );
      const rightPoint = polarToCartesian(
        {
          radius: baseRadius,
          angleRad: normalizeAngle(angleRad + widthRad),
        },
        viewport.center
      );
      const tipPoint = polarToCartesian(
        {
          radius: tipRadius,
          angleRad,
        },
        viewport.center
      );

      context.globalAlpha = 0.09 + pulse.strength * 4.4;
      context.beginPath();
      context.moveTo(leftPoint.x, leftPoint.y);
      context.lineTo(tipPoint.x, tipPoint.y);
      context.lineTo(rightPoint.x, rightPoint.y);
      context.lineTo(leftPoint.x, leftPoint.y);
      context.fill();
      context.globalAlpha = 0.06 + pulse.strength * 2.4;
      context.lineWidth = 0.95;
      context.stroke();
    }
  }

  context.restore();
};

export const drawDivergencePass = (input: DivergencePassInput): void => {
  const { context, viewport, theme, events, pulses, elapsedMs, timeMs } = input;

  if (events.length === 0) {
    return;
  }

  const pulseAngles = resolvePulseAngles(events, pulses);
  const activePulseDescriptors = resolveActivePulseDescriptors(
    pulses,
    pulseAngles,
    timeMs
  );
  const samples = createContourSamples(
    viewport,
    elapsedMs,
    timeMs,
    pulses,
    pulseAngles
  );

  drawContourStroke(context, viewport, samples, theme.ringColor, 0.22, 1.6);
  drawContourStroke(context, viewport, samples, theme.ringColor, 0.07, 4.2);
  drawPulseGrain(context, viewport, samples, elapsedMs);
  drawDirectionalTears(
    context,
    viewport,
    theme,
    activePulseDescriptors,
    elapsedMs
  );
};
