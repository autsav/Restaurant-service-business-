import { Audio } from "@remotion/media";
import { fitTextOnNLines } from "@remotion/layout-utils";
import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
} from "remotion";
import { FONT_FAMILY, loadTeaserFonts } from "./fonts";
import type { TeaserProps } from "./schema";

// Layout (px, for a 1080x1920 frame). Margins keep text clear of Instagram's UI.
const SIDE_MARGIN = 80;
const TOP_MARGIN = 220;
const BOTTOM_MARGIN = 320;
const PUSH_IN_SCALE = 1.12;
const DISH_MAX_SIZE = 84;
const DISH_MIN_SIZE = 56;
const TEXT_SHADOW = "0 4px 24px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.8)";
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const resolveSrc = (src: string) => (/^(https?:|data:)/.test(src) ? src : staticFile(src));

const useFontsReady = () => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading Inter font"));

  useEffect(() => {
    loadTeaserFonts()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle, continueRender, cancelRender]);

  return ready;
};

/** Blurred, darkened copy of the photo that fills the frame behind it. */
const Backdrop: React.FC<{ src: string }> = ({ src }) => (
  <AbsoluteFill>
    <Img
      src={src}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        filter: "blur(40px) brightness(0.5)",
        scale: 1.2, // hides the soft edge the blur leaves at the frame border
      }}
    />
  </AbsoluteFill>
);

/**
 * The dish photo. The ONLY things that change are scale and position:
 * no filters, no colour changes, no cropping of the image itself.
 */
const DishPhoto: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  // The photo is fitted inside a box of frame-size / PUSH_IN_SCALE. At the end of
  // the push-in it exactly reaches the frame edge, so no part of the dish is ever
  // cropped — at any frame.
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Img
        src={src}
        style={{
          width: width / PUSH_IN_SCALE,
          height: height / PUSH_IN_SCALE,
          objectFit: "contain",
          scale: interpolate(frame, [0, durationInFrames - 1], [1, PUSH_IN_SCALE], {
            ...CLAMP,
            easing: Easing.inOut(Easing.ease),
          }),
        }}
      />
    </AbsoluteFill>
  );
};

/** Dark gradients at the top and bottom so white text stays readable. */
const Scrims: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.7) 100%)",
    }}
  />
);

const Titles: React.FC<Pick<TeaserProps, "restaurant" | "dish" | "price">> = ({ restaurant, dish, price }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const f = (frameAt30: number) => (frameAt30 * fps) / 30;
  const fadeLen = f(12);

  const fadeOut = interpolate(frame, [f(150), f(162)], [1, 0], CLAMP);
  const appear = (start: number) => interpolate(frame, [f(start), f(start) + fadeLen], [0, 1], CLAMP) * fadeOut;

  const maxBoxWidth = width - SIDE_MARGIN * 2;
  const fitted = fitTextOnNLines({
    text: dish,
    maxLines: 2,
    maxBoxWidth,
    fontFamily: FONT_FAMILY,
    fontWeight: 800,
    maxFontSize: DISH_MAX_SIZE,
  });
  const dishSize = Math.max(DISH_MIN_SIZE, Math.min(DISH_MAX_SIZE, fitted.fontSize));

  return (
    <AbsoluteFill style={{ fontFamily: FONT_FAMILY, color: "white", textShadow: TEXT_SHADOW }}>
      <div
        style={{
          position: "absolute",
          top: TOP_MARGIN,
          left: SIDE_MARGIN,
          right: SIDE_MARGIN,
          fontSize: 56,
          fontWeight: 600,
          lineHeight: 1.15,
          opacity: appear(15),
        }}
      >
        {restaurant}
      </div>

      <div style={{ position: "absolute", bottom: BOTTOM_MARGIN, left: SIDE_MARGIN, right: SIDE_MARGIN }}>
        <div
          style={{
            fontSize: dishSize,
            fontWeight: 800,
            lineHeight: 1.08,
            overflowWrap: "break-word",
            opacity: appear(30),
            translate: interpolate(frame, [f(30), f(30) + fadeLen], ["0px 20px", "0px 0px"], {
              ...CLAMP,
              easing: Easing.out(Easing.cubic),
            }),
          }}
        >
          {dish}
        </div>
        {price ? (
          <div style={{ marginTop: 20, fontSize: 56, fontWeight: 600, lineHeight: 1.15, opacity: appear(45) }}>
            {price}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ restaurant: string }> = ({ restaurant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = (165 * fps) / 30;

  return (
    <AbsoluteFill style={{ fontFamily: FONT_FAMILY, color: "white", textShadow: TEXT_SHADOW }}>
      <div
        style={{
          position: "absolute",
          bottom: BOTTOM_MARGIN + 40,
          left: SIDE_MARGIN,
          right: SIDE_MARGIN,
          textAlign: "center",
          fontSize: 40,
          fontWeight: 600,
          lineHeight: 1.25,
          opacity: interpolate(frame, [start, start + (12 * fps) / 30], [0, 1], CLAMP),
        }}
      >
        Made for {restaurant} by PYNK Studio
      </div>
    </AbsoluteFill>
  );
};

const Music: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const fadeStart = durationInFrames - 1 - (15 * fps) / 30;

  return <Audio src={src} volume={interpolate(frame, [fadeStart, durationInFrames - 1], [0.6, 0], CLAMP)} />;
};

export const Teaser: React.FC<TeaserProps> = ({ restaurant, dish, price, photo, audio }) => {
  const fontsReady = useFontsReady();
  const photoSrc = resolveSrc(photo);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Backdrop src={photoSrc} />
      <DishPhoto src={photoSrc} />
      <Scrims />
      {fontsReady ? (
        <>
          <Titles restaurant={restaurant} dish={dish} price={price} />
          <EndCard restaurant={restaurant} />
        </>
      ) : null}
      {audio ? <Music src={resolveSrc(audio)} /> : null}
    </AbsoluteFill>
  );
};
