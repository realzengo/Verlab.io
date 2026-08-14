"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { TubesCursorApp } from "threejs-components/build/cursors/tubes1.min.js";

interface TubesBackgroundProps {
  className?: string;
}

// Brand blue/violet/pink — kept in the same family as the other tool
// backgrounds instead of the library's default random-neon palette.
const TUBE_COLORS = ["#335cff", "#8b5cf6", "#3987e5"];
const LIGHT_COLORS = ["#8b5cf6", "#335cff", "#60aed5", "#c2447a"];

export function TubesBackground({ className }: TubesBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let app: TubesCursorApp | null = null;

    import("threejs-components/build/cursors/tubes1.min.js")
      .then(({ default: TubesCursor }) => {
        if (disposed || !canvasRef.current) return;
        app = TubesCursor(canvasRef.current, {
          tubes: {
            colors: TUBE_COLORS,
            lights: {
              intensity: 140,
              colors: LIGHT_COLORS,
            },
          },
          bloom: {
            threshold: 0,
            strength: 1.1,
            radius: 0.55,
          },
          // Scaled down from the library defaults (tuned for a full-viewport
          // hero) so the idle drift stays proportionate to this panel.
          sleepRadiusX: 130,
          sleepRadiusY: 80,
        });
      })
      .catch((error) => {
        console.error("Failed to load TubesCursor:", error);
      });

    return () => {
      disposed = true;
      app?.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn(className)}
      style={{ display: "block", width: "100%", height: "100%", touchAction: "none" }}
    />
  );
}

export default TubesBackground;
