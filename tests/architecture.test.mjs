import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(path, "utf8");

test("production Firebase, Google AI, and commerce architecture is present", async () => {
  const [pkg, firestoreRules, storageRules, generation, googleAi, env, reader, feedback, auth, signInForm, storyApi, checkout, stripeWebhook, firebaseConfig, feedbackReview, familyCharacters, characterPresets, createForm, settings, library, versionRoute, retryIllustrations, sharePage, adminFeedback, adminAlias, betaAdminAlias, adminFeedbackApi, adminReviewApi, adminUsersApi, adminCreditsApi, adminAccess, adminPage, adminDenied, adminDashboard, appHosting] = await Promise.all([
    read("package.json"),
    read("firestore.rules"),
    read("storage.rules"),
    read("app/api/stories/generate/route.ts"),
    read("lib/google-ai.ts"),
    read(".env.example"),
    read("components/story-reader.tsx"),
    read("app/api/feedback/route.ts"),
    read("app/api/auth/session/route.ts"),
    read("components/sign-in-form.tsx"),
    read("app/api/stories/[id]/route.ts"),
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
  assert.match(generation, /findReusableFamilyCharacter/);
  assert.match(generation, /character-media/);
  assert.match(generation, /generateCoverIllustration/);
  assert.match(generation, /generateStandaloneCoverIllustration/);
  assert.match(generation, /generateStandalonePageIllustration/);
  assert.match(generation, /storyCovers/);
  assert.match(generation, /storySnapshots/);
  assert.match(generation, /generationReviews/);
  assert.match(generation, /Promise\.allSettled/);
  assert.match(generation, /narration_warmup_retry_needed/);
  assert.match(generation, /character_reference_retry_needed/);
  assert.match(generation, /CharacterPresetIdSchema/);
  assert.match(generation, /preset_character_sheet/);
  assert.match(generation, /photo_derived_character_sheet/);
  assert.match(generation, /standalone_illustration_fallback_used/);
  assert.match(generation, /standalone_page_generation/);
  assert.match(generation, /firestore_text_commit/);
  assert.match(generation, /media_generation_status/);
  assert.doesNotMatch(generation, /generationStage = "moderation"/);
  assert.doesNotMatch(generation, /moderateStoryBrief/);
  assert.doesNotMatch(generation, /cover_path: pageRecords\[0\]\?\.illustration_path/);
  assert.match(googleAi, /gemini-3\.1-flash-image-preview|GEMINI_IMAGE_MODEL/);
  assert.match(googleAi, /Warm, whimsical, premium custom children's-book illustration/);
  assert.match(googleAi, /front, side, and back full-body views/);
  assert.match(googleAi, /face closeups, hair\/back-of-head detail/);
  assert.match(googleAi, /not a final story scene/);
  assert.match(googleAi, /presetPromptSummary/);
  assert.match(googleAi, /character sheet as the strict identity reference/);
  assert.match(googleAi, /dedicated premium personalized storybook cover/);
  assert.match(googleAi, /attempt <= 3/);
  assert.match(googleAi, /Story brief moderation unavailable/);
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
  assert.match(createForm, /selectedCharacterPresetIds/);
  assert.match(createForm, /Or choose illustrated family characters/);
  assert.match(createForm, /CHARACTER_PRESETS/);
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
  assert.match(library, /Temporary illustration fallback/);
  assert.match(firebaseConfig, /publicEnv/);
  assert.match(versionRoute, /K_REVISION/);
  assert.match(versionRoute, /feedbackExport/);
  assert.match(versionRoute, /userFeedback/);
  assert.match(versionRoute, /Admin access required/);
  assert.match(storyApi, /retry_illustrations/);
  assert.match(storyApi, /z\.union/);
  assert.match(storyApi, /generateStandalonePageIllustration/);
  assert.match(storyApi, /media_generation_status: "generating"/);
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
