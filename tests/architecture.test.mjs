import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(path, "utf8");

test("production Firebase, Google AI, and commerce architecture is present", async () => {
  const [pkg, firestoreRules, storageRules, generation, googleAi, env, reader, coverChoice, feedback, auth, signInForm, storyApi, coverOptionsApi, checkout, stripeWebhook, firebaseConfig, feedbackReview, familyCharacters, characterPresets, createForm, settings, library, versionRoute, retryIllustrations, storyPage, sharePage, adminFeedback, adminAlias, betaAdminAlias, adminFeedbackApi, adminReviewApi, adminUsersApi, adminCreditsApi, adminAccess, adminPage, adminDenied, adminDashboard, appHosting] = await Promise.all([
    read("package.json"),
    read("firestore.rules"),
    read("storage.rules"),
    read("app/api/stories/generate/route.ts"),
    read("lib/google-ai.ts"),
    read(".env.example"),
    read("components/story-reader.tsx"),
    read("components/cover-choice.tsx"),
    read("app/api/feedback/route.ts"),
    read("app/api/auth/session/route.ts"),
    read("components/sign-in-form.tsx"),
    read("app/api/stories/[id]/route.ts"),
    read("app/api/stories/[id]/cover-options/route.ts"),
    read("app/api/stories/[id]/checkout/route.ts"),
    read("app/api/stripe/webhook/route.ts"),
    read("app/api/firebase-config/route.ts"),
    read("lib/feedback.ts"),
    read("lib/family-characters.ts"),
    read("lib/character-presets.ts"),
    read("components/create-story-form.tsx"),
    read("app/settings/page.tsx"),
    read("app/library/page.tsx"),
    read("app/api/version/route.ts"),
    read("app/api/stories/[id]/illustrations/retry/route.ts"),
    read("app/stories/[id]/page.tsx"),
    read("app/share/[token]/page.tsx"),
    read("app/admin/feedback/page.tsx"),
    read("app/feedback-admin/page.tsx"),
    read("app/beta-admin/page.tsx"),
    read("app/api/admin/feedback/route.ts"),
    read("app/api/admin/feedback/review/route.ts"),
    read("app/api/admin/users/route.ts"),
    read("app/api/admin/credits/route.ts"),
    read("lib/admin-access.ts"),
    read("app/admin/page.tsx"),
    read("app/admin/access-denied/page.tsx"),
    read("components/admin-dashboard.tsx"),
    read("apphosting.yaml"),
  ]);

  assert.match(pkg, /"firebase"/);
  assert.match(pkg, /"firebase-admin"/);
  assert.match(pkg, /"stripe"/);
  assert.doesNotMatch(pkg, /supabase|openai/i);
  assert.match(firestoreRules, /allow write: if false/);
  assert.match(firestoreRules, /resource\.data\.owner_id == request\.auth\.uid/);
  assert.match(storageRules, /allow read, write: if false/);
  assert.match(generation, /delete\(\{ ignoreNotFound: true \}\)/);
  assert.match(generation, /familyPhotoAudits/);
  assert.match(generation, /Promise\.allSettled/);
  assert.match(generation, /firestore_text_commit/);
  assert.match(generation, /media_generation_status/);
  assert.match(generation, /generateCoverChoices/);
  assert.match(generation, /COVER_STYLE_OPTIONS/);
  assert.match(generation, /coverOptions/);
  assert.match(generation, /awaiting_cover_choice/);
  assert.match(generation, /cover_choice_status/);
  assert.doesNotMatch(generation, /createCharacterReference/);
  assert.doesNotMatch(generation, /saveFamilyCharacter/);
  assert.doesNotMatch(generation, /generationStage = "moderation"/);
  assert.doesNotMatch(generation, /moderateStoryBrief/);
  assert.doesNotMatch(generation, /cover_path: pageRecords\[0\]\?\.illustration_path/);
  assert.match(env, /GEMINI_IMAGE_MODEL=gemini-2\.5-flash-image/);
  assert.match(appHosting, /gemini-2\.5-flash-image/);
  assert.match(googleAi, /GEMINI_IMAGE_MODEL/);
  assert.match(googleAi, /Warm, whimsical, premium custom children's-book illustration/);
  assert.match(googleAi, /Non-negotiable anatomy quality/);
  assert.match(googleAi, /natural age-appropriate proportions/);
  assert.match(googleAi, /animated family-film storybook look/);
  assert.match(googleAi, /front, side, and back full-body views/);
  assert.match(googleAi, /face closeups, hair\/back-of-head detail/);
  assert.match(googleAi, /not a final story scene/);
  assert.match(googleAi, /character sheet as the strict identity reference/);
  assert.match(googleAi, /dedicated premium personalized storybook cover/);
  assert.match(googleAi, /front cover illustration/);
  assert.match(googleAi, /Full-bleed cover art only/);
  assert.match(googleAi, /Show exactly one instance of the main child/);
  assert.match(googleAi, /No text, letters, title, captions, labels/);
  assert.match(googleAi, /fallbackStoryText/);
  assert.match(googleAi, /GEMINI_TEXT_EMPTY_/);
  assert.match(googleAi, /attempt <= 3/);
  assert.match(googleAi, /Story brief moderation unavailable/);
  assert.match(googleAi, /5-minute bedtime adventure/);
  assert.match(googleAi, /audioScenePlan/);
  assert.match(googleAi, /ambienceKey/);
  assert.match(googleAi, /COVER_STYLE_OPTIONS/);
  assert.match(googleAi, /buildVisualStyleLock/);
  assert.match(googleAi, /generateCoverOptionIllustration/);
  assert.match(googleAi, /Selected cover\/style lock/);
  assert.match(familyCharacters, /raw photo/);
  assert.match(familyCharacters, /reference_assets/);
  assert.match(familyCharacters, /selected_preset_ids/);
  assert.match(familyCharacters, /presetSummary/);
  assert.doesNotMatch(familyCharacters, /orderBy\("last_used_at"/);
  assert.doesNotMatch(familyCharacters, /where\("child_key"/);
  assert.doesNotMatch(familyCharacters, /where\("status"/);
  assert.match(env, /GOOGLE_GENERATIVE_AI_API_KEY/);
  assert.match(env, /STORYGLOW_ADMIN_EMAILS/);
  assert.doesNotMatch(env, /OPENAI|SUPABASE|GEMINI_API_KEY=/);
  assert.match(characterPresets, /asian-daughter-preschool-birthday/);
  assert.match(characterPresets, /asian-mom-warm-cardigan/);
  assert.match(characterPresets, /asian-dad-cozy-sweater/);
  assert.match(characterPresets, /CHARACTER_STYLE_VARIANTS/);
  assert.match(characterPresets, /iconClass/);
  assert.match(reader, /Sleep timer/);
  assert.match(reader, /Story cover/);
  assert.match(reader, /Open the book/);
  assert.match(reader, /FallbackIllustration/);
  assert.match(reader, /buildInitialNarrationCache/);
  assert.match(reader, /rememberNarration/);
  assert.match(reader, /sample \?/);
  assert.match(reader, /readOnly \?/);
  assert.match(reader, /Illustration needs retry/);
  assert.match(reader, /Illustration is being painted/);
  assert.match(reader, /Retry page illustrations/);
  assert.match(reader, /coverUrl/);
  assert.match(reader, /\/api\/progress/);
  assert.match(reader, /Audio drama direction/);
  assert.match(reader, /Play bedtime audio drama/);
  assert.match(coverChoice, /Choose the book cover/);
  assert.match(coverChoice, /\/api\/stories\/\$\{storyId\}\/cover-options/);
  assert.match(coverChoice, /Painting three cover ideas/);
  assert.match(coverChoice, /Read story text now/);
  assert.match(storyPage, /forceReader/);
  assert.match(coverOptionsApi, /generateStandalonePageIllustration/);
  assert.match(coverOptionsApi, /visualStyleLock/);
  assert.match(coverOptionsApi, /selected_cover_option_id/);
  assert.match(coverOptionsApi, /renderNarrationAsset/);
  assert.match(feedback, /rewardCredits = 5/);
  assert.match(feedback, /rewardCredits = 1/);
  assert.match(feedback, /export async function GET/);
  assert.match(feedback, /Admin access required/);
  assert.match(feedback, /FEEDBACK_WEBHOOK_SECRET/);
  assert.match(feedbackReview, /feedbackReviews/);
  assert.match(feedbackReview, /proposed_solution/);
  assert.match(feedbackReview, /needs_review/);
  assert.match(firestoreRules, /match \/feedbackReviews/);
  assert.match(firestoreRules, /match \/creditLedger/);
  assert.match(firestoreRules, /allow read, write: if false/);
  assert.match(adminAccess, /STORYGLOW_ADMIN_EMAILS/);
  assert.match(adminAccess, /email_verified/);
  assert.match(adminAccess, /requireAdminApiUser/);
  assert.match(adminAccess, /\/admin\/access-denied/);
  assert.match(adminDenied, /Admin access not enabled/);
  assert.match(adminPage, /StoryGlow Beta Control Room/);
  assert.match(adminDashboard, /Apply credit change/);
  assert.match(adminDashboard, /Save review/);
  assert.match(adminDashboard, /storybookCredits/);
  assert.match(adminFeedback, /app\/admin\/page/);
  assert.match(adminAlias, /app\/admin\/feedback\/page/);
  assert.match(betaAdminAlias, /app\/admin\/page/);
  assert.match(adminFeedbackApi, /FEEDBACK_WEBHOOK_SECRET/);
  assert.match(adminFeedbackApi, /userFeedback/);
  assert.match(adminFeedbackApi, /feedbackReviews/);
  assert.match(adminFeedbackApi, /Admin access required/);
  assert.match(adminReviewApi, /feedbackReviews/);
  assert.match(adminReviewApi, /planned/);
  assert.match(adminReviewApi, /proposed_solution/);
  assert.match(adminUsersApi, /getUserByEmail/);
  assert.match(adminCreditsApi, /creditLedger/);
  assert.match(adminCreditsApi, /manual_beta_admin/);
  assert.match(adminCreditsApi, /storybookCredits/);
  assert.match(appHosting, /STORYGLOW_ADMIN_EMAILS/);
  assert.match(auth, /createSessionCookie/);
  assert.match(auth, /email_verified/);
  assert.match(auth, /password_signin/);
  assert.match(signInForm, /createUserWithEmailAndPassword/);
  assert.match(signInForm, /signInWithEmailAndPassword/);
  assert.match(signInForm, /sendPasswordResetEmail/);
  assert.match(signInForm, /sendSignInLinkToEmail/);
  assert.match(signInForm, /At least 8 characters/);
  assert.match(signInForm, /One uppercase letter/);
  assert.match(signInForm, /One symbol/);
  assert.match(generation, /selectStoryEntitlement/);
  assert.match(generation, /storybookCredits: FieldValue\.increment\(-1\)/);
  assert.match(generation, /entitlement_refunded/);
  assert.match(checkout, /checkout\.sessions\.create/);
  assert.match(checkout, /shipping_address_collection/);
  assert.match(stripeWebhook, /constructEvent/);
  assert.match(stripeWebhook, /printOrders/);
  assert.match(firestoreRules, /match \/printOrders/);
  assert.match(firestoreRules, /match \/checkoutSessions/);
  assert.match(firestoreRules, /match \/familyCharacters/);
  assert.match(firestoreRules, /match \/storyCovers/);
  assert.match(firestoreRules, /match \/storySnapshots/);
  assert.match(firestoreRules, /match \/generationReviews/);
  assert.match(settings, /CharacterRefinementForm/);
  assert.match(library, /Story snapshot/);
  assert.match(library, /library-cover-fallback/);
  assert.match(library, /Choose your cover/);
  assert.doesNotMatch(library, /birthday-story-scenes/);
  assert.doesNotMatch(createForm, /CHARACTER_PRESETS|preset-avatar|selectedCharacterPresetIds|Or choose illustrated family characters/);
  assert.match(firebaseConfig, /publicEnv/);
  assert.match(versionRoute, /K_REVISION/);
  assert.match(versionRoute, /feedbackExport/);
  assert.match(versionRoute, /userFeedback/);
  assert.match(versionRoute, /Admin access required/);
  assert.match(storyApi, /retry_illustrations/);
  assert.match(storyApi, /recover_story_text/);
  assert.match(storyApi, /recovered_from_stage: "story_text_result"/);
  assert.match(storyApi, /z\.union/);
  assert.match(storyApi, /generateStandalonePageIllustration/);
  assert.match(storyApi, /media_generation_status: "generating"/);
  assert.match(generation, /story_structure_version/);
  assert.match(generation, /audio_drama_status/);
  assert.match(retryIllustrations, /generateStandalonePageIllustration/);
  assert.match(retryIllustrations, /media_generation_status: "generating"/);
  assert.match(retryIllustrations, /missingPages/);
  assert.match(sharePage, /readOnly/);
  assert.doesNotMatch(sharePage, / sample \/>/);
  assert.doesNotMatch(firebaseConfig, /GOOGLE_GENERATIVE_AI_API_KEY|STRIPE_SECRET_KEY/);
});

test("story entitlement policy grants one free story and then consumes credits", async () => {
  const { selectStoryEntitlement } = await import("../lib/story-entitlements.ts");
  assert.equal(selectStoryEntitlement({
    freeStoriesUsed: 0,
    storybookCredits: 0,
    hasExistingStory: false,
  }), "free");
  assert.equal(selectStoryEntitlement({
    freeStoriesUsed: 1,
    storybookCredits: 2,
    hasExistingStory: true,
  }), "credit");
  assert.equal(selectStoryEntitlement({
    storybookCredits: 0,
    hasExistingStory: true,
  }), null);
});

test("fallback story text survives long parent inputs", async () => {
  const { fallbackStoryText } = await import("../lib/story-fallback.ts");
  const book = fallbackStoryText({
    childName: "Maya",
    age: 2,
    gender: "girl",
    grownUps: "Mum and Dad ".repeat(20),
    event: "Her birthday party had a very detailed family memory. ".repeat(30),
    memory: "She borrowed Mum's favorite handbag and walked around proudly. ".repeat(30),
    characterTraits: "Joyful, playful, curious, expressive, and full of tiny confident moments. ".repeat(20),
  });
  assert.equal(book.pages.length, 10);
  assert.ok(book.dedication.length <= 220);
  for (const page of book.pages) {
    assert.ok(page.text.length >= 40);
    assert.ok(page.text.length <= 520);
    assert.ok(page.sceneDescription.length <= 500);
    assert.ok(page.audioScenePlan);
    assert.ok(page.ambienceKey);
    assert.ok(Array.isArray(page.effectCues));
  }
});

test("story text normalization capitalizes openings", async () => {
  const { normalizeStoryBook } = await import("../lib/story-text-normalization.ts");
  const normalized = normalizeStoryBook({
    title: "maya's tiny moon",
    dedication: "for mum and dad",
    pages: [{
      title: "little handbag",
      text: "maya walked slowly with the bag.",
      sceneDescription: "cozy living room with one child.",
    }],
  });
  assert.equal(normalized.title, "Maya's tiny moon");
  assert.equal(normalized.dedication, "For mum and dad");
  assert.equal(normalized.pages[0].title, "Little handbag");
  assert.equal(normalized.pages[0].text, "Maya walked slowly with the bag.");
  assert.equal(normalized.pages[0].sceneDescription, "Cozy living room with one child.");
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
