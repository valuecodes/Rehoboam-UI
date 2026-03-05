import type { CSSProperties } from "react";

import type { RehoboamRenderDiagnostics } from "../engine/types";
import type { SceneQualityTier } from "../scene/quality";
import type { InstrumentSize } from "./callout-overlay";

type DeveloperHudNetworkStatus = "idle" | "loading" | "success" | "fallback";

export type DeveloperHudProps = Readonly<{
  diagnostics: RehoboamRenderDiagnostics | null;
  eventCount: number;
  instrumentSize: InstrumentSize;
  networkStatus: DeveloperHudNetworkStatus;
  qualityTier: SceneQualityTier;
}>;

type HudMetric = Readonly<{
  label: string;
  value: string;
}>;

type HudMetricStyle = CSSProperties & {
  "--hud-angle": string;
  "--hud-angle-inverse": string;
};

type HudRootStyle = CSSProperties & {
  "--rehoboam-hud-size": string;
};

const formatFixed = (value: number, fractionDigits: number): string => {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return value.toFixed(fractionDigits);
};

const getDiagnosticsMetrics = (
  diagnostics: RehoboamRenderDiagnostics | null
): readonly HudMetric[] => {
  if (diagnostics === null) {
    return [
      { label: "FPS", value: "--" },
      { label: "Frame", value: "--" },
      { label: "Bg", value: "--" },
      { label: "Rings", value: "--" },
      { label: "Contour", value: "--" },
      { label: "Divergence", value: "--" },
      { label: "Sweep", value: "--" },
      { label: "Pulses", value: "--" },
      { label: "Clusters", value: "--" },
      { label: "Rings cfg", value: "--" },
      { label: "Div cfg", value: "--" },
    ];
  }

  return [
    { label: "FPS", value: formatFixed(diagnostics.fps, 1) },
    { label: "Frame", value: `${formatFixed(diagnostics.frameMs, 2)} ms` },
    {
      label: "Bg",
      value: `${formatFixed(diagnostics.passMs.background, 2)} ms`,
    },
    {
      label: "Rings",
      value: `${formatFixed(diagnostics.passMs.rings, 2)} ms`,
    },
    {
      label: "Contour",
      value: `${formatFixed(diagnostics.passMs.contour, 2)} ms`,
    },
    {
      label: "Divergence",
      value: `${formatFixed(diagnostics.passMs.divergence, 2)} ms`,
    },
    {
      label: "Sweep",
      value: `${formatFixed(diagnostics.passMs.sweep, 2)} ms`,
    },
    {
      label: "Pulses",
      value: `${diagnostics.activePulseCount}`,
    },
    {
      label: "Clusters",
      value: `${diagnostics.activeClusterCount}`,
    },
    {
      label: "Rings cfg",
      value: `${diagnostics.ringCount}`,
    },
    {
      label: "Div cfg",
      value: `${diagnostics.divergenceSampleCount}`,
    },
  ];
};

export const DeveloperHud = ({
  diagnostics,
  eventCount,
  instrumentSize,
  networkStatus,
  qualityTier,
}: DeveloperHudProps) => {
  const metrics: readonly HudMetric[] = [
    { label: "Quality", value: qualityTier },
    { label: "Events", value: `${eventCount}` },
    { label: "Network", value: networkStatus },
    ...getDiagnosticsMetrics(diagnostics),
  ];
  const angleStep = 360 / metrics.length;
  const hudDiameter = Math.max(
    0,
    Math.min(instrumentSize.width, instrumentSize.height) * 0.92
  );
  const rootStyle: HudRootStyle = {
    "--rehoboam-hud-size": `${hudDiameter}px`,
  };

  return (
    <aside
      aria-label="Developer HUD"
      className="rehoboam-scene__developer-hud"
      aria-live="off"
      style={rootStyle}
    >
      <div aria-hidden className="rehoboam-scene__developer-hud-core" />
      <div className="rehoboam-scene__developer-hud-handle">
        <div className="rehoboam-scene__developer-hud-handle-label">
          <p className="rehoboam-scene__developer-hud-title">Developer HUD</p>
          <p className="rehoboam-scene__developer-hud-subtitle">
            Telemetry Ring
          </p>
        </div>
      </div>
      <div className="rehoboam-scene__developer-hud-grid">
        {metrics.map((metric, index) => {
          const angle = index * angleStep - 90;
          const style: HudMetricStyle = {
            "--hud-angle": `${angle}deg`,
            "--hud-angle-inverse": `${angle * -1}deg`,
          };

          return (
            <div
              className="rehoboam-scene__developer-hud-row"
              key={metric.label}
              style={style}
            >
              <span className="rehoboam-scene__developer-hud-label">
                {metric.label}
              </span>
              <span className="rehoboam-scene__developer-hud-value">
                {metric.value}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
