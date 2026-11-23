import React from "react";
import { Composition } from "remotion";
import { DemoVideo, EdlDoc, DemoProps } from "./DemoVideo";

const EMPTY: EdlDoc = {
  fps: 30,
  width: 1280,
  height: 800,
  durationInFrames: 90,
  sourceWidth: 1280,
  sourceHeight: 800,
  brand: { accent: "#6366F1", watermark: true },
  segments: [],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="DemoVideo"
    component={DemoVideo as React.FC<Record<string, unknown>>}
    durationInFrames={90}
    fps={30}
    width={1280}
    height={800}
    defaultProps={{ edl: EMPTY, assetBase: "" }}
    calculateMetadata={({ props }) => {
      const p = props as unknown as DemoProps;
      return {
        durationInFrames: Math.max(1, p.edl.durationInFrames),
        fps: p.edl.fps,
        width: p.edl.width,
        height: p.edl.height,
        props,
      };
    }}
  />
);
