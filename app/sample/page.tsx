import { StoryReader } from "@/components/story-reader";
import { sampleCover, samplePages } from "@/lib/sample-story";

export default function SamplePage() {
  return <StoryReader storyId="sample" title="Maya and the Birthday Handbag" pages={samplePages} cover={sampleCover} sample />;
}
