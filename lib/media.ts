import { storageBucket } from "@/lib/firebase/admin";

export async function signMediaPath(path: string | null, expiresIn = 3600) {
  if (!path) return null;
  const [url] = await storageBucket().file(path).getSignedUrl({
    action: "read",
    expires: Date.now() + expiresIn * 1000,
  });
  return url;
}

export async function signStoryPages<T extends { illustration_path: string | null; narration_path: string | null }>(pages: T[]) {
  return Promise.all(pages.map(async page => ({
    ...page,
    illustration_url: await signMediaPath(page.illustration_path),
    narration_url: await signMediaPath(page.narration_path),
  })));
}
