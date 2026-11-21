import { Composition } from "remotion";
import { teaserPropsSchema } from "./schema";
import { Teaser } from "./Teaser";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Teaser"
        component={Teaser}
        schema={teaserPropsSchema}
        durationInFrames={210}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          restaurant: "Sample Restaurant",
          dish: "Placeholder Dish Name",
          price: "£9.50",
          photo: "sample-dish.jpg",
          audio: null,
        }}
      />
    </>
  );
};
