import { StoryReader } from "@/components/story-reader";
import { samplePages } from "@/lib/sample-story";

export default function SamplePage() {
  return <StoryReader storyId="sample" title="Maya and the Birthday Handbag" pages={samplePages} sample />;
}
