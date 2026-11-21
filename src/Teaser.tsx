import { Audio, Video } from "@remotion/media";
import { fitTextOnNLines } from "@remotion/layout-utils";
import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
} from "remotion";
import { FONT_FAMILY, loadTeaserFonts } from "./fonts";
import type { TeaserProps } from "./schema";

/**
 * Teaser v2: three scenes, a new picture roughly every two seconds.
 *
 *   HOOK  (0.0s-2.0s)  macro of the dish snaps in, hook line pops word by word
 *   HERO  (2.0s-5.7s)  the moving clip (or a push-in on the photo), with a
 *                      mid-scene punch-in; dish name and price slide up
 *   PLATE (5.7s-8.0s)  the whole plate, uncropped, and the end card
 *
 * The photo and the clip are only ever scaled, positioned and cropped by the
 * frame. Nothing here filters, recolours or redraws the food.
 */
export const TEASER_FPS = 30;
export const TEASER_DURATION = 240;
const HOOK_END = 60;
const HERO_END = 170;
const PUNCH_AT = 55; // frames into the hero scene

const SIDE = 72;
const TOP_SAFE = 230;
const BOTTOM_SAFE = 330;
const ACCENT = "#FFC83D";
const SHADOW = "0 6px 30px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.75)";
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

type Focus = { x: number; y: number };

/** The photo filling the whole frame, zoomed around the focus point. */
const PhotoFill: React.FC<{ src: string; focus: Focus; from: number; to: number; snap?: boolean }> = ({
  src,
  focus,
  from,
  to,
  snap = false,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const origin = `${focus.x * 100}% ${focus.y * 100}%`;

  return (
    <AbsoluteFill>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: origin,
          transformOrigin: origin,
          scale: interpolate(frame, [0, durationInFrames - 1], [from, to], {
            ...CLAMP,
            // snap: most of the move happens in the first few frames, like a whip zoom landing
            easing: snap ? Easing.out(Easing.exp) : Easing.inOut(Easing.ease),
          }),
        }}
      />
    </AbsoluteFill>
  );
};

/** The moving clip filling the frame, with a jump-cut punch-in part way through. */
const ClipFill: React.FC<{ src: string; focus: Focus }> = ({ src, focus }) => {
  const frame = useCurrentFrame();
  const punched = frame >= PUNCH_AT;
  const drift = interpolate(frame, [PUNCH_AT, PUNCH_AT + 60], [1.3, 1.38], CLAMP);

  return (
    <AbsoluteFill
      style={{
        transformOrigin: `${focus.x * 100}% ${focus.y * 100}%`,
        scale: punched ? drift : 1,
      }}
    >
      <Video src={src} objectFit="cover" volume={0.5} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};

/** Whole plate, never cropped, over a blurred copy of itself. */
const FullPlate: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const settle = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Img
        src={src}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(36px) brightness(0.42)",
          scale: 1.25,
        }}
      />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            scale: interpolate(settle, [0, 1], [1.12, 1]),
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Three-frame white flash that sells a hard cut. */
const CutFlash: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{ backgroundColor: "white", opacity: interpolate(frame, [0, 4], [0.45, 0], CLAMP), pointerEvents: "none" }}
    />
  );
};

const Scrim: React.FC<{ top?: number; bottom?: number }> = ({ top = 0.5, bottom = 0.72 }) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(to bottom, rgba(0,0,0,${top}) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 50%, rgba(0,0,0,${bottom}) 100%)`,
    }}
  />
);

/** Big hook line. Each word pops up in turn; the last word takes the accent colour. */
const Hook: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const words = text.trim().split(/\s+/);
  const size = Math.min(
    150,
    fitTextOnNLines({
      text: text.toUpperCase(),
      maxLines: 3,
      maxBoxWidth: width - SIDE * 2,
      fontFamily: FONT_FAMILY,
      fontWeight: 800,
      maxFontSize: 150,
    }).fontSize,
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        padding: `0 ${SIDE}px`,
        fontFamily: FONT_FAMILY,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.0,
        letterSpacing: "-0.02em",
        color: "white",
        textShadow: SHADOW,
        textTransform: "uppercase",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", columnGap: "0.26em", rowGap: "0.08em" }}>
        {words.map((word, index) => {
          const pop = spring({ frame: frame - 4 - index * 5, fps, config: { damping: 14, stiffness: 220 } });
          return (
            <span
              key={`${word}-${index}`}
              style={{
                display: "inline-block",
                opacity: interpolate(pop, [0, 0.4], [0, 1], CLAMP),
                scale: interpolate(pop, [0, 1], [0.6, 1]),
                translate: `0px ${interpolate(pop, [0, 1], [40, 0])}px`,
                color: index === words.length - 1 ? ACCENT : "white",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const DishCard: React.FC<Pick<TeaserProps, "restaurant" | "dish" | "price">> = ({ restaurant, dish, price }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const rise = (delay: number) => spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 14 });
  const fitted = fitTextOnNLines({
    text: dish,
    maxLines: 2,
    maxBoxWidth: width - SIDE * 2,
    fontFamily: FONT_FAMILY,
    fontWeight: 800,
    maxFontSize: 96,
  });
  const dishSize = Math.max(58, Math.min(96, fitted.fontSize));
  const line = (delay: number): React.CSSProperties => ({
    opacity: rise(delay),
    translate: `0px ${interpolate(rise(delay), [0, 1], [36, 0])}px`,
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONT_FAMILY, color: "white", textShadow: SHADOW }}>
      <div style={{ position: "absolute", left: SIDE, right: SIDE, bottom: BOTTOM_SAFE }}>
        <div
          style={{
            ...line(6),
            fontSize: 38,
            fontWeight: 600,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: ACCENT,
            marginBottom: 14,
          }}
        >
          {restaurant}
        </div>
        <div style={{ ...line(10), fontSize: dishSize, fontWeight: 800, lineHeight: 1.04, letterSpacing: "-0.015em" }}>
          {dish}
        </div>
        {price ? (
          <div
            style={{
              ...line(16),
              display: "inline-block",
              marginTop: 24,
              padding: "10px 26px",
              borderRadius: 999,
              backgroundColor: ACCENT,
              color: "#141414",
              textShadow: "none",
              fontSize: 50,
              fontWeight: 800,
            }}
          >
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
  const inAt = (delay: number) => spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 14 });

  return (
    <AbsoluteFill style={{ fontFamily: FONT_FAMILY, color: "white", textShadow: SHADOW, textAlign: "center" }}>
      <div
        style={{
          position: "absolute",
          top: TOP_SAFE,
          left: SIDE,
          right: SIDE,
          fontSize: 76,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          opacity: inAt(8),
          translate: `0px ${interpolate(inAt(8), [0, 1], [-24, 0])}px`,
        }}
      >
        {restaurant}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: BOTTOM_SAFE,
          left: SIDE,
          right: SIDE,
          fontSize: 36,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          opacity: inAt(16),
        }}
      >
        Made for you by <span style={{ color: ACCENT }}>PYNK Studio</span>
      </div>
    </AbsoluteFill>
  );
};

const Music: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return <Audio src={src} volume={interpolate(frame, [durationInFrames - 16, durationInFrames - 1], [0.6, 0], CLAMP)} />;
};

export const Teaser: React.FC<TeaserProps> = ({ restaurant, dish, price, hook, photo, clip, audio, focusX, focusY }) => {
  const fontsReady = useFontsReady();
  const photoSrc = resolveSrc(photo);
  const focus: Focus = { x: focusX, y: focusY };

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Sequence durationInFrames={HOOK_END} name="Hook">
        <PhotoFill src={photoSrc} focus={focus} from={2.1} to={1.55} snap />
        <Scrim top={0.35} bottom={0.45} />
        <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.18)" }} />
        {fontsReady ? <Hook text={hook} /> : null}
      </Sequence>

      <Sequence from={HOOK_END} durationInFrames={HERO_END - HOOK_END} name="Hero">
        {clip ? (
          <ClipFill src={resolveSrc(clip)} focus={focus} />
        ) : (
          <PhotoFill src={photoSrc} focus={focus} from={1.0} to={1.3} />
        )}
        <Scrim top={0.25} bottom={0.8} />
        {fontsReady ? <DishCard restaurant={restaurant} dish={dish} price={price} /> : null}
        <CutFlash />
        <Sequence from={PUNCH_AT} layout="none" name="Punch flash">
          {clip ? <CutFlash /> : null}
        </Sequence>
      </Sequence>

      <Sequence from={HERO_END} name="Plate">
        <FullPlate src={photoSrc} />
        <Scrim top={0.55} bottom={0.6} />
        {fontsReady ? <EndCard restaurant={restaurant} /> : null}
        <CutFlash />
      </Sequence>

      {audio ? <Music src={resolveSrc(audio)} /> : null}
    </AbsoluteFill>
  );
};
