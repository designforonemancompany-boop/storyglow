import { notFound } from "next/navigation";
import { CoverChoice } from "@/components/cover-choice";
import { StoryReader } from "@/components/story-reader";
import { StoryGenerationStatus } from "@/components/story-generation-status";
import { requireUser } from "@/lib/auth";
import { firestore } from "@/lib/firebase/admin";
import { ownedStory, storyPages } from "@/lib/firestore-data";
import { signMediaPath, signStoryPages } from "@/lib/media";

export default async function StoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ read?: string }>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const forceReader = search?.read === "1" || search?.read === "true";
  const user = await requireUser();
  const [story, records, progress, coverOptionsSnapshot] = await Promise.all([
    ownedStory(user.uid, id),
    storyPages(id),
    firestore().collection("profiles").doc(user.uid).collection("progress").doc(id).get(),
    firestore().collection("stories").doc(id).collection("coverOptions").get(),
  ]);
  if (!story) notFound();
  if (story.status === "generating" || story.status === "failed") {
    return <StoryGenerationStatus storyId={story.id} status={story.status} title={story.title} errorStage={story.error_stage} />;
  }
  if (!["ready", "archived"].includes(story.status)) notFound();

  const coverChoiceStatus = story.cover_choice_status || (story.cover_path ? "selected" : null);
  if (!forceReader && coverChoiceStatus && coverChoiceStatus !== "selected") {
    const options = await Promise.all(coverOptionsSnapshot.docs.map(async doc => {
      const data = doc.data();
      return {
        id: doc.id,
        label: data.style_label || doc.id,
        promptSummary: data.prompt_summary || "A premium StoryGlow cover direction.",
        imageUrl: await signMediaPath(data.image_path || null),
        status: data.status || "ready",
      };
    }));
    return <CoverChoice storyId={story.id} title={story.title} dedication={story.dedication} status={coverChoiceStatus} options={options} />;
  }

  const [pages, coverUrl] = await Promise.all([
    signStoryPages(records),
    signMediaPath(story.cover_path),
  ]);
  const missingIllustrationCount = records.filter(page => !page.illustration_path).length;
  return <StoryReader storyId={story.id} title={story.title} pages={pages.map(page => ({
    page_number: page.page_number,
    title: page.title,
    body: page.body,
    illustration_url: page.illustration_url,
    narration_url: page.narration_url,
    audio_scene_plan: page.audio_scene_plan,
    ambience_key: page.ambience_key,
    effect_cues: page.effect_cues,
    character_voice_hints: page.character_voice_hints,
  }))} cover={{ image_url: coverUrl, dedication: story.dedication }} pageArtStatus={story.media_generation_status || null} missingIllustrationCount={missingIllustrationCount} initialPage={progress.data()?.page_number || 1} initialPosition={progress.data()?.audio_position_ms || 0} initialRate={Number(progress.data()?.playback_rate || 1)} />;
}
