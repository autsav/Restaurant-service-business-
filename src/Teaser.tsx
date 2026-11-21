import inter600 from "@fontsource/inter/files/inter-latin-600-normal.woff2";
import inter800 from "@fontsource/inter/files/inter-latin-800-normal.woff2";
import { loadFont } from "@remotion/fonts";
import { fitTextOnNLines } from "@remotion/layout-utils";
import { Audio } from "@remotion/media";
import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
} from "remotion";
import type { TeaserProps } from "./schema";

// Inter is bundled from local files (not Google Fonts), so a render makes
// no network calls at all.
const fontFamily = "Inter";
const fontsLoaded = Promise.all([
  loadFont({ family: fontFamily, url: inter600, weight: "600" }),
  loadFont({ family: fontFamily, url: inter800, weight: "800" }),
]);

// Safe margins that keep text clear of the Instagram UI.
const SAFE_X = 80;
const SAFE_TOP = 220;
const SAFE_BOTTOM = 320;
const TEXT_WIDTH = 1080 - 2 * SAFE_X;

// The photo is scaled 1.00 -> 1.12. Its box is the frame divided by the peak
// scale, so at 1.12 it exactly reaches the frame edge and the dish is never cut.
const PEAK_SCALE = 1.12;

const DISH_MAX_FONT = 84;
const DISH_MIN_FONT = 56;

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// Text blocks span the safe width; each one sets `top` or `bottom`.
// (Plain divs: AbsoluteFill's 100% width/height would break the anchoring.)
const textStyle: React.CSSProperties = {
  position: "absolute",
  left: SAFE_X,
  right: SAFE_X,
  fontFamily,
  color: "white",
  textAlign: "center",
  textShadow: "0 2px 6px rgba(0,0,0,0.45), 0 6px 28px rgba(0,0,0,0.55)",
};

export const Teaser: React.FC<TeaserProps> = ({
  restaurant,
  dish,
  price,
  photo,
  audio,
}) => {
  const src = staticFile(photo);
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Background src={src} />
      <Photo src={src} />
      <RestaurantName text={restaurant} />
      <DishAndPrice dish={dish} price={price} />
      <EndCard restaurant={restaurant} />
      {audio ? <Music src={staticFile(audio)} /> : null}
    </AbsoluteFill>
  );
};

// Layer 1: the same photo, cover-fit, blurred and darkened. Background only.
// A small static overscale hides the soft edge that blur leaves at the border.
const Background: React.FC<{ src: string }> = ({ src }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      <CanvasImage
        src={src}
        fit="cover"
        width={width}
        height={height}
        style={{
          width,
          height,
          scale: 1.1,
          filter: "blur(40px) brightness(0.5)",
        }}
      />
    </AbsoluteFill>
  );
};

// Layer 2: the dish photo, contain-fit. Only its scale changes: no filter,
// colour change or rotation. The canvas buffer is full-frame size, so at the
// peak scale it is drawn 1:1 instead of being upscaled.
const Photo: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <CanvasImage
        src={src}
        fit="contain"
        width={width}
        height={height}
        style={{
          width: width / PEAK_SCALE,
          height: height / PEAK_SCALE,
          scale: interpolate(
            frame,
            [0, durationInFrames - 1],
            [1, PEAK_SCALE],
            {
              ...clamp,
              easing: Easing.inOut(Easing.cubic),
              output: "perceptual-scale",
            },
          ),
        }}
      />
    </AbsoluteFill>
  );
};

// Frames 15-150 in (12-frame fade), out over 150-162.
const RestaurantName: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...textStyle,
        top: SAFE_TOP,
        fontSize: 56,
        fontWeight: 600,
        lineHeight: 1.15,
        opacity: interpolate(frame, [15, 27, 150, 162], [0, 1, 1, 0], clamp),
      }}
    >
      {text}
    </div>
  );
};

// Largest font size (84 down to 56) that fits the dish name on 2 lines.
// Measured once, after Inter has loaded.
const useDishFontSize = (dish: string): number | null => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() =>
    delayRender("Loading Inter to fit dish name"),
  );
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    fontsLoaded
      .then(() => {
        setFontReady(true);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle, continueRender, cancelRender]);

  if (!fontReady) {
    return null;
  }
  const { fontSize } = fitTextOnNLines({
    text: dish,
    maxLines: 2,
    maxBoxWidth: TEXT_WIDTH,
    fontFamily,
    fontWeight: 800,
    maxFontSize: DISH_MAX_FONT,
    validateFontIsLoaded: true,
  });
  return Math.max(DISH_MIN_FONT, Math.floor(fontSize));
};

// Lower third, anchored to the bottom safe margin. Dish: frames 30-150, slide
// up 20px + fade in over 12 frames. Price: frames 45-150, fade in over 12.
// Both fade out over 150-162.
const DishAndPrice: React.FC<{ dish: string; price: string }> = ({
  dish,
  price,
}) => {
  const frame = useCurrentFrame();
  const fontSize = useDishFontSize(dish);
  if (fontSize === null) {
    return null;
  }
  return (
    <div
      style={{
        ...textStyle,
        bottom: SAFE_BOTTOM,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: TEXT_WIDTH,
          fontSize,
          fontWeight: 800,
          lineHeight: 1.1,
          overflowWrap: "anywhere",
          // At the 56px floor a name may still need 3 lines: cut it at 2.
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          overflow: "hidden",
          opacity: interpolate(frame, [30, 42, 150, 162], [0, 1, 1, 0], clamp),
          translate: interpolate(frame, [30, 42], ["0px 20px", "0px 0px"], {
            ...clamp,
            easing: Easing.out(Easing.cubic),
          }),
        }}
      >
        {dish}
      </div>
      {price ? (
        <div
          style={{
            marginTop: 16,
            fontSize: 56,
            fontWeight: 600,
            lineHeight: 1.15,
            opacity: interpolate(
              frame,
              [45, 57, 150, 162],
              [0, 1, 1, 0],
              clamp,
            ),
          }}
        >
          {price}
        </div>
      ) : null}
    </div>
  );
};

// Frames 165-209: fades in over 12 frames over the still-visible photo.
const EndCard: React.FC<{ restaurant: string }> = ({ restaurant }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...textStyle,
        bottom: SAFE_BOTTOM,
        fontSize: 40,
        fontWeight: 600,
        lineHeight: 1.25,
        opacity: interpolate(frame, [165, 177], [0, 1], clamp),
      }}
    >
      Made for {restaurant} by PYNK Studio
    </div>
  );
};

// Volume 0.6, fading to 0 over the last 15 frames.
const Music: React.FC<{ src: string }> = ({ src }) => {
  const { durationInFrames } = useVideoConfig();
  return (
    <Audio
      src={src}
      volume={(f) =>
        interpolate(
          f,
          [durationInFrames - 15, durationInFrames - 1],
          [0.6, 0],
          clamp,
        )
      }
    />
  );
};
