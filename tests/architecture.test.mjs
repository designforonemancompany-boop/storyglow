import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(path, "utf8");

test("production Firebase and Google AI architecture is present", async () => {
  const [pkg, firestoreRules, storageRules, generation, googleAi, env, reader, feedback, auth] = await Promise.all([
    read("package.json"),
    read("firestore.rules"),
    read("storage.rules"),
    read("app/api/stories/generate/route.ts"),
    read("lib/google-ai.ts"),
    read(".env.example"),
    read("components/story-reader.tsx"),
    read("app/api/feedback/route.ts"),
    read("app/api/auth/session/route.ts"),
  ]);

  assert.match(pkg, /"firebase"/);
  assert.match(pkg, /"firebase-admin"/);
  assert.doesNotMatch(pkg, /supabase|openai/i);
  assert.match(firestoreRules, /allow write: if false/);
  assert.match(firestoreRules, /resource\.data\.owner_id == request\.auth\.uid/);
  assert.match(storageRules, /allow read, write: if false/);
  assert.match(generation, /delete\(\{ ignoreNotFound: true \}\)/);
  assert.match(generation, /familyPhotoAudits/);
  assert.match(googleAi, /gemini-3\.1-flash-image-preview|GEMINI_IMAGE_MODEL/);
  assert.match(googleAi, /Warm, whimsical, premium custom children's-book illustration/);
  assert.match(googleAi, /character sheet as the strict identity reference/);
  assert.match(env, /GOOGLE_GENERATIVE_AI_API_KEY/);
  assert.doesNotMatch(env, /OPENAI|SUPABASE|GEMINI_API_KEY=/);
  assert.match(reader, /Sleep timer/);
  assert.match(reader, /\/api\/progress/);
  assert.match(feedback, /rewardCredits = 5/);
  assert.match(feedback, /rewardCredits = 1/);
  assert.match(auth, /createSessionCookie/);
  assert.match(auth, /email_verified/);
});

test("obsolete backend files are removed", async () => {
  for (const path of [
    "lib/openai.ts",
    "lib/supabase/admin.ts",
    "middleware.ts",
    "supabase/migrations/202606140001_storyglow.sql",
  ]) {
    await assert.rejects(access(path));
  }
});
