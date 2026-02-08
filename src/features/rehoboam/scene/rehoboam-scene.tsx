import { useEffect, useRef } from "react";

import { DEFAULT_DPR_CAP } from "../engine/defaults";
import { createRehoboamEngine } from "../engine/rehoboam-engine";

import "./rehoboam-scene.css";

const readDevicePixelRatio = (): number => {
  const value = window.devicePixelRatio;

  return Number.isFinite(value) && value > 0 ? value : 1;
};

export const RehoboamScene = () => {
  const instrumentRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const instrument = instrumentRef.current;
    const canvas = canvasRef.current;

    if (instrument === null || canvas === null) {
      return;
    }

    const engine = createRehoboamEngine({
      canvas,
      dprCap: DEFAULT_DPR_CAP,
    });

    const resizeToBounds = (width: number, height: number) => {
      engine.resize({
        width,
        height,
        dpr: readDevicePixelRatio(),
      });
    };

    const initialBounds = instrument.getBoundingClientRect();
    resizeToBounds(initialBounds.width, initialBounds.height);

    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;

      resizeToBounds(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(instrument);
    engine.start();

    return () => {
      observer.disconnect();
      engine.destroy();
    };
  }, []);

  return (
    <main className="rehoboam-scene">
      <section
        aria-label="Rehoboam V2 scene container"
        className="rehoboam-scene__instrument"
        ref={instrumentRef}
      >
        <canvas
          aria-hidden
          className="rehoboam-scene__canvas"
          ref={canvasRef}
        />
        <p className="rehoboam-scene__label">REHOBOAM V2</p>
      </section>
    </main>
  );
};
