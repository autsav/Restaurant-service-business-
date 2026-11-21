import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { teaserSchema } from "./schema";
import { Teaser } from "./Teaser";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <Composition
        id="Teaser"
        component={Teaser}
        schema={teaserSchema}
        durationInFrames={210}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          restaurant: "Fatt Pundit",
          dish: "Crackling Spinach",
          price: "£9.50",
          photo: "chilli-paneer.webp",
          audio: "",
        }}
      />
    </>
  );
};
