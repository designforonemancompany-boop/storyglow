import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { StoryReader } from "@/components/story-reader";
import { firestore } from "@/lib/firebase/admin";
import { storyPages } from "@/lib/firestore-data";
import { signStoryPages } from "@/lib/media";

export const dynamic = "force-dynamic";

export default async function SharedStoryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length < 20) notFound();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const link = await firestore().collection("shareLinks").doc(tokenHash).get();
  const linkData = link.data();
  const expiresAt = linkData?.expires_at?.toDate?.() as Date | undefined;
  if (!link.exists || linkData?.revoked_at || (expiresAt && expiresAt < new Date())) notFound();
  const story = await firestore().collection("stories").doc(linkData?.story_id).get();
  if (!story.exists || story.data()?.status !== "ready") notFound();
  const pages = await signStoryPages(await storyPages(story.id));
  return <StoryReader storyId={story.id} title={story.data()?.title} pages={pages.map(page => ({
    page_number: page.page_number,
    title: page.title,
    body: page.body,
    illustration_url: page.illustration_url,
    narration_url: page.narration_url,
  }))} sample />;
}
