# StoryGlow

StoryGlow is a production-ready personalized children’s story platform built
with Next.js App Router, Firebase, and Google AI Studio.

## Product capabilities

- Stable-height five-slide homepage journey
- Fully playable sample: “Maya and the Birthday Handbag”
- Google authorization and passwordless Firebase email-link authentication
- Persistent secure server sessions across desktop and mobile
- Private Firestore story library protected by ownership rules
- Google AI Studio structured story generation with Gemini
- Nano Banana illustration generation for 10–12 cohesive watercolor pages
- Optional family-photo reference with mandatory manual person labels
- Immediate deletion of the raw family photo after character-reference creation
- Private mobile reader with narration, progress, playback speed, and sleep timer
- Revocable private story-sharing links
- One complete free story per verified account, followed by server-enforced
  premium-credit usage with automatic refunds when generation fails
- Stripe-hosted physical-book checkout with shipping details, signed webhook
  confirmation, and private fulfillment status
- Global bug/idea feedback and bedtime-audio cadence survey
- Transactional alpha rewards: 5 credits for the first feedback from the first
  20 testers, then 1 credit after feedback on a second distinct story
- Founder/admin dashboard for feedback review and manual beta credit grants
- Marketing consent history kept separate from required service communication

## Architecture

```text
Firebase App Hosting / Next.js
  ├─ Firebase Authentication: Google + email links
  ├─ Firebase Admin session cookies: HTTP-only, 14-day sessions
  ├─ Cloud Firestore: profiles, stories, pages, progress, feedback, consent
  ├─ Cloud Storage: temporary private photos and generated private media
  └─ Google AI Studio
      ├─ gemini-2.5-flash structured story writing and safety screening
      ├─ gemini-3.1-flash-image-preview character and page illustration
      └─ gemini-2.5-flash-preview-tts bedtime narration
```

All Firestore and Storage browser writes are denied. Trusted Next.js server
routes verify the Firebase session cookie, validate resource ownership, and use
the Admin SDK. Generated media is delivered through short-lived signed URLs.

## Environment variables

Copy `.env.example` to `.env.local`:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=
GOOGLE_GENERATIVE_AI_API_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview
GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts
FEEDBACK_WEBHOOK_URL=
FEEDBACK_WEBHOOK_SECRET=
STORYGLOW_ADMIN_EMAILS=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PHYSICAL_BOOK_PRICE_CENTS=4900
PHYSICAL_BOOK_SHIPPING_CENTS=800
```

`FIREBASE_PRIVATE_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, and
`FEEDBACK_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` are
server-only secrets. Never prefix them with `NEXT_PUBLIC_`.

`STORYGLOW_ADMIN_EMAILS` is a comma-separated list of verified Firebase Auth
emails allowed to open the admin dashboard at `/admin`. Admins use the same
magic-link or Google sign-in flow as parents; there is no separate password.

## Physical-book checkout

1. Create a Stripe account and copy its restricted server secret into
   `STRIPE_SECRET_KEY`.
2. Create a webhook endpoint for
   `https://YOUR_DOMAIN/api/stripe/webhook`.
3. Subscribe it to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
4. Store the endpoint signing secret in `STRIPE_WEBHOOK_SECRET`.
5. Set the book and shipping amounts in cents. Defaults are USD 49.00 plus USD
   8.00 tracked shipping.

Checkout uses Stripe-hosted payment pages. A `printOrders` record is created
only after a signed webhook confirms payment, and browser clients cannot write
order or credit records.

## Firebase setup

1. Create or select a Firebase project in the
   [Firebase console](https://console.firebase.google.com/).
2. Upgrade the project to Blaze because App Hosting, server rendering, Google
   AI calls, and image generation require billing-enabled Google Cloud services.
3. Add a Web App and copy its public configuration into the five
   `NEXT_PUBLIC_FIREBASE_*` variables.
4. In Authentication, enable:
   - Google
   - Email/Password, with Email link sign-in enabled
5. Add `localhost` and the final App Hosting domain to Authorized domains.
6. Create Firestore in production mode and enable Cloud Storage.
7. Deploy the included security configuration:

   ```powershell
   npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
   ```

8. Firebase App Hosting uses its built-in runtime service identity. A service
   account JSON key is optional and should only be used for local development.

## Google AI Studio setup

1. Open [Google AI Studio](https://aistudio.google.com/apikey).
2. Create an API key in the same Google Cloud project where practical.
3. Restrict the key to the Generative Language API and add a project budget.
4. Store it as `GOOGLE_GENERATIVE_AI_API_KEY`.

The image prompt always enforces a warm, whimsical, premium custom-illustration
style. A generated character sheet is reused as the strict identity reference
for every page.

## Photo privacy

The generation route:

1. Accepts a private upload only after the parent labels the child and at least
   one parent or guardian.
2. Normalizes the image in server memory.
3. Creates a non-photorealistic illustrated character reference.
4. Deletes the original Cloud Storage object immediately.
5. Records the deletion result in `familyPhotoAudits`.
6. Repeats deletion in the failure path.

The original photograph is never stored in a story page, sharing link, or
public URL.

## Local development

```powershell
npm install
npm run dev
```

Open <http://localhost:3000>.

Quality gates:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

## Firebase App Hosting deployment

1. Push the repository to GitHub.
2. In Firebase Console, open App Hosting and connect the repository.
3. Select the production branch and repository root.
4. Add the public variables and Secret Manager values from `.env.example`.
5. Deploy `firestore.rules`, `firestore.indexes.json`, and `storage.rules`.
6. Set `NEXT_PUBLIC_SITE_URL` to the generated App Hosting domain.
7. Add that domain to Firebase Authentication’s authorized domains.

`apphosting.yaml` allocates 2 CPU, 2 GB memory, and bounded concurrency for the
image-heavy generation route. Before a high-volume launch, move the 10–12 image
job to Cloud Tasks if observed generation time approaches the hosting request
limit.

## Feedback webhook

When `FEEDBACK_WEBHOOK_URL` is set, every accepted feedback entry is posted
server-to-server with a Bearer token from `FEEDBACK_WEBHOOK_SECRET`. Credits are
assigned atomically inside a Firestore transaction and cannot be changed by
browser clients.

## Admin beta operations

Open `/admin` while signed in with an email listed in `STORYGLOW_ADMIN_EMAILS`
to run beta operations before payment checkout is ready:

- Review latest full feedback comments, timestamps, story IDs, cadence survey
  answers, proposed fixes, internal notes, and review status.
- Search parents by email or UID and grant or subtract premium story credits.
- Require an admin reason for every manual credit adjustment.
- Store every manual adjustment in the server-only `creditLedger` collection
  with admin email, delta, previous balance, new balance, reason, and source
  `manual_beta_admin`.

Firestore browser reads and writes for `feedbackReviews` and `creditLedger`
remain denied. Admin actions run through protected Next.js server routes using
the Firebase Admin SDK.

Open `/feedback-admin` for the legacy read-only feedback inbox.

For JSON export, call `/api/version?feedback=1&limit=20` while signed in as an
allowlisted admin, or with `Authorization: Bearer FEEDBACK_WEBHOOK_SECRET`.
