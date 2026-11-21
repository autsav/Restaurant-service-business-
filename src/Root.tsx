import { Composition } from "remotion";
import { teaserPropsSchema } from "./schema";
import { TEASER_DURATION, TEASER_FPS, Teaser } from "./Teaser";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Teaser"
        component={Teaser}
        schema={teaserPropsSchema}
        durationInFrames={TEASER_DURATION}
        fps={TEASER_FPS}
        width={1080}
        height={1920}
        defaultProps={{
          restaurant: "Sample Restaurant",
          dish: "Placeholder Dish Name",
          price: "£9.50",
          hook: "Hungry yet?",
          photo: "sample-dish.jpg",
          clip: null,
          audio: null,
          focusX: 0.5,
          focusY: 0.5,
        }}
      />
    </>
  );
};
