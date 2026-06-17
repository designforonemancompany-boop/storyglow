# StoryGlow Feedback Review Log

This log captures beta feedback that was reviewed directly in Codex when live
Firestore admin access was unavailable. Production feedback records remain in
`userFeedback` and `feedbackReviews`.

## 2026-06-17

### Create Story Failed To Fetch
- Status: enhanced
- Action: Hardened story generation so text can be committed before media work
  finishes, with entitlement refund protection on unrecoverable failures.
- Follow-up: keep monitoring create-story route errors in production logs.

### Generation Stopped During Moderation
- Status: enhanced
- Action: Removed the fragile hard-stop moderation stage from the generation
  flow and kept guarded story generation active.
- Follow-up: replace with an OpenAI policy-aware moderation layer when the
  OpenAI migration begins.

### Generated Story Used Sample Artwork
- Status: partially enhanced
- Action: Added a visible temporary illustration fallback so the reader and
  library no longer show blank art while media generation is repaired.
- Follow-up: remove the fallback label once generated images are reliably saved.

### Illustration Blank Or Missing
- Status: enhanced in progress
- Action: Added standalone story-specific cover and page illustration generation
  when the reusable character reference cannot be created.
- Follow-up: verify a fresh live story creates and saves personalized media
  paths, then remove the temporary sample-art fallback.

### Audio Stuck On Next Page
- Status: enhanced
- Action: Added reader-side narration URL caching and next-page prefetching.
- Follow-up: verify continuous bedtime playback on mobile after a fresh story.
