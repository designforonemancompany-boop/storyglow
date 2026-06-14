import { notFound } from "next/navigation";
import { StoryReader } from "@/components/story-reader";
import { requireUser } from "@/lib/auth";
import { firestore } from "@/lib/firebase/admin";
import { ownedStory, storyPages } from "@/lib/firestore-data";
import { signStoryPages } from "@/lib/media";

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [story, records, progress] = await Promise.all([
    ownedStory(user.uid, id),
    storyPages(id),
    firestore().collection("profiles").doc(user.uid).collection("progress").doc(id).get(),
  ]);
  if (!story || story.status !== "ready") notFound();
  const pages = await signStoryPages(records);
  return <StoryReader storyId={story.id} title={story.title} pages={pages.map(page => ({
    page_number: page.page_number,
    title: page.title,
    body: page.body,
    illustration_url: page.illustration_url,
    narration_url: page.narration_url,
  }))} initialPage={progress.data()?.page_number || 1} initialPosition={progress.data()?.audio_position_ms || 0} initialRate={Number(progress.data()?.playback_rate || 1)} />;
}
