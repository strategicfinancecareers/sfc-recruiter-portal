# SFC Talent — Email Audit

Read-only catalog of every email this app sends. Generated from a sweep of `api/*` for `resend.emails.send`, raw `https://api.resend.com/emails` POSTs, `emailRedirectTo`, and `resetPasswordForEmail`.

**15 distinct app-sent emails** + **4 Supabase Auth templates** (managed in dashboard, not code).

All app-sent emails use `from: SFC Talent <noreply@strategicfinancecareers.com>`. Admin notifications go to `zu@strategicfinancecareers.com`.

---

## Summary table

| # | Email | Trigger | Recipient | Source file |
|---|---|---|---|---|
| 1  | Candidate — application received (under review) | Candidate completes `/apply` wizard | Candidate | `api/submit-candidate.ts` |
| 2  | Admin — new candidate application | Same submit | Admin | `api/submit-candidate.ts` |
| 3  | Admin — new recruiter signup pending review | Recruiter completes `/signup` form | Admin | `api/recruiter-signup.js` |
| 4  | Recruiter — submission received | Same submit | Recruiter | `api/recruiter-signup.js` |
| 5  | Recruiter — application approved | Admin clicks Approve in admin panel | Recruiter | `api/review-recruiter.js` |
| 6  | Recruiter — application rejected | Admin clicks Reject + reason | Recruiter | `api/review-recruiter.js` |
| 7  | Candidate — profile approved/live | Admin Approve | Candidate | `api/review-candidate.js` |
| 8  | Candidate — application not accepted (rejected) | Admin Reject | Candidate | `api/review-candidate.js` |
| 9  | Candidate — welcome back (reactivated) | Admin Reactivate | Candidate | `api/review-candidate.js` |
| 10 | Candidate — profile paused (deactivated) | Admin Deactivate | Candidate | `api/review-candidate.js` |
| 11 | Candidate — new opportunity (intro) | Recruiter submits intro via `/api/submit-intro` | Candidate | `api/send-intro-email.ts` |
| 12 | Candidate — new opportunity (intro RESEND) | Admin nudges a pending intro | Candidate | `api/resend-intro-email.js` |
| 13 | Recruiter — candidate accepted | Candidate clicks ✅ in intro email | Recruiter (+ TEST_CC) | `api/respond-to-intro.ts` |
| 14 | Recruiter — candidate passed | Candidate clicks ❌ in intro email | Recruiter (+ TEST_CC) | `api/respond-to-intro.ts` |
| 15 | Candidate — welcome to dashboard | Not currently triggered (orphaned endpoint) | Candidate | `api/send-candidate-welcome.ts` |

---

# Candidate-facing

## 1. Application received — under review

- **Trigger:** Candidate completes the `/apply` wizard and `submit-candidate.ts` inserts the row.
- **Recipient:** the candidate (`to: [email]`)
- **Sender:** `SFC Talent <noreply@strategicfinancecareers.com>`
- **Source:** `api/submit-candidate.ts` lines ~246–280 (inline HTML, raw `fetch('https://api.resend.com/emails', ...)`)
- **CTA link:** `Open My Dashboard →` → `https://sfc-recruiter-portal.vercel.app/candidate-dashboard`
- **No-reply behavior:** does not invite replies.

**Subject**
```
Welcome to SFC Talent — Your application is under review
```

**Body**
```
Application received ✓

Hi {firstName},

Thanks for applying to SFC Talent. Your profile is now under review by our team — we manually vet every candidate before introducing them to top finance teams.

What happens next:
- Our team reviews your profile (usually within 1–2 business days)
- We'll email you the moment your profile is approved
- Once approved, recruiters can browse your anonymous profile and request introductions
- You'll have 48 hours to respond to each intro request — just reply YES or NO

┌─ Manage your profile ─────────────────────────────────┐
│ Update your bio, skills, and availability anytime     │
│ from your candidate dashboard.                        │
│                                                       │
│ [ Open My Dashboard → ]                               │
│                                                       │
│ Sign in with the email and password you created       │
│ during signup.                                        │
└───────────────────────────────────────────────────────┘

Your identity is always protected. We never share your name, contact details, or employer without your explicit consent.

— SFC Talent · strategicfinancecareers.com
```

---

## 7. Candidate — profile approved / live

- **Trigger:** Admin clicks Approve on a pending candidate. `review-candidate.js` flips `status='active'`.
- **Recipient:** the candidate
- **Sender:** `SFC Talent <noreply@strategicfinancecareers.com>`
- **Source:** `api/review-candidate.js` → `buildEmail('approve', candidate)` lines ~38–50
- **CTA link:** `Open My Dashboard →` → `https://sfc-recruiter-portal.vercel.app/candidate-dashboard`

**Subject**
```
Your SFC Talent profile is now live
```

**Body**
```
You're in 🎉

Hi {firstName},

Great news — your profile has been approved and is now visible to recruiters on our platform. They can browse you anonymously and request introductions.

You'll get an email any time a recruiter requests an intro. You have 48 hours to accept or decline each one.

[ Open My Dashboard → ]

Your identity stays protected. We never share your contact details without your explicit consent.

— SFC Talent · strategicfinancecareers.com
```

---

## 8. Candidate — application not accepted (rejected)

- **Trigger:** Admin clicks Reject on a pending candidate. Internal `rejection_reason` column is stored but **deliberately not included** in this email per inline spec comment.
- **Recipient:** the candidate
- **Sender:** `SFC Talent <noreply@strategicfinancecareers.com>`
- **Source:** `api/review-candidate.js` → `buildEmail('reject', candidate)` lines ~53–66
- **Reply-to behavior:** explicitly invites reply ("just reply to this email").

**Subject**
```
About your SFC Talent application
```

**Body**
```
Thanks for applying to SFC Talent

Hi {firstName},

Thank you for taking the time to apply. After review, we're not able to add your profile to our platform at this time.

If you have any questions, just reply to this email — we read every response.

We wish you the very best in your career.

— SFC Talent · strategicfinancecareers.com
```

---

## 9. Candidate — welcome back (reactivated)

- **Trigger:** Admin reactivates a previously inactive/rejected candidate. `review-candidate.js` flips `status='active'` via reactivate branch.
- **Recipient:** the candidate
- **Sender:** `SFC Talent <noreply@strategicfinancecareers.com>`
- **Source:** `api/review-candidate.js` → `buildEmail('reactivate', candidate)` lines ~69–78
- **CTA link:** `Open My Dashboard →` → `https://sfc-recruiter-portal.vercel.app/candidate-dashboard`

**Subject**
```
Welcome back to SFC Talent
```

**Body**
```
Welcome back 👋

Hi {firstName},

Your profile is live again on our platform and visible to recruiters. You'll start receiving intro requests as they come in.

[ Open My Dashboard → ]

— SFC Talent · strategicfinancecareers.com
```

---

## 10. Candidate — profile paused (deactivated)

- **Trigger:** Admin deactivates an active candidate. `status` flips to `'inactive'`.
- **Recipient:** the candidate
- **Sender:** `SFC Talent <noreply@strategicfinancecareers.com>`
- **Source:** `api/review-candidate.js` → `buildEmail('deactivate', candidate)` lines ~81–91
- **Reply-to behavior:** invites reply.

**Subject**
```
Your SFC Talent profile is paused
```

**Body**
```
Your profile is now paused

Hi {firstName},

Your profile has been paused and is no longer visible to recruiters on our platform. You won't receive any new introduction requests.

If this was a mistake or you'd like to reactivate, just reply to this email and we'll sort it out.

— SFC Talent · strategicfinancecareers.com
```

---

## 11. Candidate — new opportunity (intro request)

- **Trigger:** Recruiter clicks Request Introduction on a candidate; `/api/submit-intro` writes the row and POSTs to `/api/send-intro-email` (see `api/submit-intro.ts:34`).
- **Recipient:** the candidate
- **Sender:** `SFC Talent <noreply@strategicfinancecareers.com>`
- **Source:** `api/send-intro-email.ts` lines ~77–101
- **CTA links:**
  - `✅ Yes, I'm interested` → `https://sfc-recruiter-portal.vercel.app/api/respond-to-intro?introId=…&response=yes`
  - `❌ No thanks` → `…&response=no`
  - `View Job Posting →` → `job.job_description_url` (when present)
  - `Open Dashboard →` → `https://sfc-recruiter-portal.vercel.app/candidate-dashboard`
- Header image: `https://sfc-recruiter-portal.vercel.app/logo.png`

**Subject**
```
New opportunity: {job.title} at {job.company}
```

**Body**
```
[logo]

You have a new opportunity

Hi there,

A company is interested in connecting with you about a {job.title} role at {job.company}.

{intro.message — italicized, if present}

— if job_description_url present —
[ View Job Posting → ]
— else —
┌──────────────────────────────────────────┐
│ Job Title  {job.title}                   │
│ Company    {job.company}                 │
│ Location   {job.location}                │
│ Salary     {job.salary_range, if any}    │
└──────────────────────────────────────────┘

Are you open to connecting?

[ ✅ Yes, I'm interested ]   [ ❌ No thanks ]

This introduction was facilitated by SFC Talent. Your contact details will only be shared if you click Yes.

┌─ View this in your dashboard ─────────────────────────┐
│ Sign in with Google to track all your introduction    │
│ requests in one place.                                │
│ [ Open Dashboard → ]                                  │
└───────────────────────────────────────────────────────┘

— SFC Talent · strategicfinancecareers.com
```

---

## 12. Candidate — new opportunity (RESEND, near-duplicate of #11)

- **Trigger:** Admin "Resend" / nudge on a still-pending intro. Validates `intro.status === 'pending'`, sends, then stamps `last_nudged_at`.
- **Recipient:** the candidate
- **Sender:** `SFC Talent <noreply@strategicfinancecareers.com>`
- **Source:** `api/resend-intro-email.js` lines ~107–127
- **CTA links:** identical to #11.
- **Differences from #11** — the only meaningful drift:
  - Renders cleanly with no company: `“a {job.title or 'role'}{ at {company} if present}.”` (raw send hardcodes `at undefined` when company is null).
  - "View this in your dashboard" sub-copy reads **"All your introduction requests are tracked in one place."** instead of **"Sign in with Google to track all your introduction requests in one place."** (Google-sign-in line in #11 is stale — Google auth is not the current flow.)
  - Subject falls back to `'role'` when title missing.

**Subject**
```
New opportunity: {job.title or 'role'}{ at {company}, if any}
```

**Body** — same structure as #11 except the two strings noted above. Not repeated verbatim.

---

## 15. Candidate — welcome to dashboard (ORPHANED — currently not triggered)

- **Trigger:** No live caller in the codebase (`grep -rn send-candidate-welcome src/ api/` returns only self-references). Endpoint exists, gated by an idempotent `dashboard_welcome_sent` flag on `candidates`.
- **Recipient:** the candidate
- **Sender:** `SFC Talent <noreply@strategicfinancecareers.com>`
- **Source:** `api/send-candidate-welcome.ts` lines ~40–73
- **CTA link:** `Open My Dashboard →` → `https://sfc-recruiter-portal.vercel.app/candidate-dashboard`

**Subject**
```
Welcome to your SFC Talent dashboard
```

**Body**
```
[logo]

Welcome to your dashboard 🎉

Hi {firstName},

You're now signed in to your SFC Talent candidate dashboard. Here's what you can do:
- See exactly how recruiters view your profile
- Update your availability, bio, and preferences
- Track introduction requests and respond directly

[ Open My Dashboard → ]

Your identity stays fully protected — recruiters only see your anonymous profile until you choose to connect.

— SFC Talent · strategicfinancecareers.com
```

---

# Recruiter-facing

## 4. Recruiter — submission received

- **Trigger:** Recruiter completes `/signup`; `recruiter-signup.js` provisions the auth user and `users` row with `recruiter_status='pending'`.
- **Recipient:** the recruiter
- **Sender:** `SFC Talent <noreply@strategicfinancecareers.com>`
- **Source:** `api/recruiter-signup.js` lines ~115–146
- **No CTA.** No reply-to behavior — sign-off is `— The SFC Talent team`.

**Subject**
```
We received your SFC Talent recruiter submission
```

**Body**
```
We received your submission

Hi {first_name},

Thanks for submitting your details to SFC Talent. We personally vet every recruiter on the platform to keep quality high on both sides.

We typically approve submissions within a few hours during US business hours (PDT). You'll get an email at this address as soon as your account is live.

┌─ A reminder of what you submitted: ───────────────────┐
│ • Company:  {company}                                 │
│ • LinkedIn: {linkedin_url}                            │
└───────────────────────────────────────────────────────┘

— The SFC Talent team
— SFC Talent · strategicfinancecareers.com
```

---

## 5. Recruiter — approved

- **Trigger:** Admin clicks Approve on a pending recruiter; `review-recruiter.js` flips `recruiter_status='approved'`.
- **Recipient:** the recruiter
- **Sender:** `SFC Talent <noreply@strategicfinancecareers.com>`
- **Source:** `api/review-recruiter.js` lines ~100–113
- **CTA link:** `Sign in →` → `https://sfc-recruiter-portal.vercel.app/signup?mode=signin`
- **Reply-to behavior:** invites reply ("Reply to this email if you have any questions").

**Subject**
```
You're approved — welcome to SFC Talent
```

**Body**
```
Welcome to SFC Talent 🎉

Hi {firstName},

Great news — your recruiter application has been approved. You can now sign in and start browsing our network of vetted finance candidates.

[ Sign in → ]

A few notes:
- Candidates are pre-vetted by our team and stay anonymous until they accept an intro
- You can request as many intros as you'd like; candidates have 48 hours to respond
- Reply to this email if you have any questions

— SFC Talent · strategicfinancecareers.com
```

---

## 6. Recruiter — rejected

- **Trigger:** Admin clicks Reject with a reason; `review-recruiter.js` flips `recruiter_status='rejected'` and stores `rejection_reason`.
- **Recipient:** the recruiter
- **Sender:** `SFC Talent <noreply@strategicfinancecareers.com>`
- **Source:** `api/review-recruiter.js` lines ~116–125
- **Includes rejection reason** in a quoted block (unlike the candidate-reject email, which deliberately omits it).
- **Reply-to behavior:** invites reply.

**Subject**
```
About your SFC Talent recruiter application
```

**Body**
```
Thanks for applying to SFC Talent

Hi {firstName},

Thank you for your interest in joining SFC Talent as a recruiter. After review, we're not able to approve your application at this time.

▎ {rejectionReason}

If you'd like to discuss this further or reapply later, just reply to this email — we read every response.

— SFC Talent · strategicfinancecareers.com
```

---

## 13. Recruiter — candidate accepted

- **Trigger:** Candidate clicks ✅ in their intro email; `respond-to-intro.ts` updates the intro row to `approved`, identity reveal happens here.
- **Recipient:** the recruiter (`to: [recruiterEmail, TEST_CC]`; `TEST_CC` is also a `to:`, not a bcc — see issues)
- **Sender:** `SFC Talent <noreply@strategicfinancecareers.com>`
- **Source:** `api/respond-to-intro.ts` lines ~99–122
- **CTA / links:** `mailto:{candidate.email}`, `tel:{candidate.phone}`, signed Resume download (7-day signed URL) when available.
- Header image: `https://sfc-recruiter-portal.vercel.app/logo.png`

**Subject**
```
✅ {candidate.name} is interested in your {jobTitle} role
```

**Body**
```
[logo]

Great news — they're interested!

{candidateName} has accepted your introduction request for the {jobTitle} role at {company}.

┌─ Candidate Details: ──────────────────────────────────┐
│ 👤 {candidateName}                                    │
│ 📧 {candidate.email}                                  │
│ 📱 {candidate.phone}  (if present)                    │
└───────────────────────────────────────────────────────┘

— if resume signed URL available —
[ 📎 Download Resume ]
Link valid for 7 days.

— else if path-only, no signed URL —
Resume download will be available in the SFC portal.

We recommend reaching out within 24 hours while their interest is fresh.

— SFC Talent · strategicfinancecareers.com
```

---

## 14. Recruiter — candidate passed

- **Trigger:** Candidate clicks ❌ in their intro email; `respond-to-intro.ts` updates to `rejected`. Uses `display_name` (anon name) — identity is **not** revealed on a no.
- **Recipient:** the recruiter (+ `TEST_CC`)
- **Sender:** `SFC Talent <noreply@strategicfinancecareers.com>`
- **Source:** `api/respond-to-intro.ts` lines ~125–140
- **CTA link:** `Browse candidates` → `https://sfc-recruiter-portal.vercel.app/browse`

**Subject**
```
{anonName} passed on the {jobTitle} role
```

**Body**
```
[logo]

Update on your introduction request

{anonName} has passed on the {jobTitle} opportunity at this time.

Don't worry — there are more great candidates available. [Browse candidates] to find your next match.

— SFC Talent · strategicfinancecareers.com
```

---

# Admin-facing

## 2. Admin — new candidate application

- **Trigger:** Same as #1 — `submit-candidate.ts` after the candidate row is inserted.
- **Recipient:** `zu@strategicfinancecareers.com` (`NOTIFY_EMAIL` constant)
- **Sender:** `SFC Talent <noreply@strategicfinancecareers.com>`
- **Source:** `api/submit-candidate.ts` lines ~301–373 (raw `fetch` to Resend)
- **CTA link:** `📎 Download Resume` → 7-day signed URL from Supabase Storage (when resume present); path-only note otherwise.

**Subject**
```
New Candidate Application: {firstName} {lastName} — {safeRole}
```

**Body** (rendered table)
```
New Candidate Application
A new candidate has submitted their profile for review.

Name                  {firstName} {lastName}
Email                 {email}
Phone                 {phone or —}
LinkedIn              {linkedin or —}
Role                  {currentRole or —}
Location              {location or —}
Experience            {expNum} years
Education             {education or —}
Primary Background    {primaryBackground or —}
Secondary             {secondaryBackgrounds joined or —}
Specialisms           {detailedExperience joined or 'Not specified'}
Job Status            {jobSearchStatus or —}
Target Comp           {targetComp or —}
Work Preference       {workPrefsArr joined or —}
Preferred Cities      {preferredCities joined (+Other if any) or —}
Industries            {industriesArr joined (+Other if any) or 'Not specified'}
Company Stage         {companyStagesArr joined or —}
New Areas             {newAreasArr joined or —}
Target Roles          {targetRoles joined or 'Not specified'}
US Work Authorized    {Yes/No/—}
Requires Sponsorship  {Yes/No/—}

— if bio —
┌─ Bio ─────────────────────────────────────────────────┐
│ {bio}                                                  │
└────────────────────────────────────────────────────────┘

— if resume signed URL available —
[ 📎 Download Resume ]   Link valid for 7 days.
— else if path only —
Resume uploaded — view in SFC Admin portal.
— else —
No resume uploaded.

Review this application in the SFC Admin portal.
```

---

## 3. Admin — new recruiter signup pending review

- **Trigger:** Recruiter completes `/signup`; same handler as #4.
- **Recipient:** `zu@strategicfinancecareers.com` (`ADMIN_NOTIFY_EMAIL` constant)
- **Sender:** `SFC Talent <noreply@strategicfinancecareers.com>`
- **Source:** `api/recruiter-signup.js` lines ~86–113
- **CTA link:** `Review in admin panel →` → `https://sfc-recruiter-portal.vercel.app/admin`

**Subject**
```
New recruiter signup pending review: {fullName}
```

**Body**
```
New recruiter signup pending review

Name      {fullName}
Email     {emailNorm}
Company   {company}
LinkedIn  {linkedin_url}

[ Review in admin panel → ]

— SFC Talent · strategicfinancecareers.com
```

---

# Supabase Auth templates (edit in dashboard)

Four templates managed in the Supabase project dashboard, not in this codebase. Redirect targets pulled from `emailRedirectTo` / `resetPasswordForEmail` call sites so you know where each link lands.

| Template | Triggered by | Redirect target | Source call site |
|---|---|---|---|
| **Candidate — verify email** | `supabase.auth.signUp` during `/apply` wizard | `https://sfc-recruiter-portal.vercel.app/apply?mode=signin` | `src/pages/CandidateApply.tsx:1199` |
| **Recruiter — verify email** | `supabase.auth.signUp` during `/signup` | `https://sfc-recruiter-portal.vercel.app/signup?mode=signin` | `src/pages/SignUp.tsx:85` |
| **Professional — password reset** | `resetPasswordForEmail` with `audience=professional` | `${window.location.origin}/reset-password` | `src/pages/ForgotPassword.tsx:43–47` |
| **Recruiter — password reset** | `resetPasswordForEmail` with `audience=recruiter` (or default) | `${window.location.origin}/recruiter/reset-password` | `src/pages/ForgotPassword.tsx:43–47` |

---

# Issues noticed

**Tone — candidate rejection (#8).** Currently opens with "Thanks for applying to SFC Talent" then says "we're not able to add your profile to our platform at this time" and closes "We wish you the very best in your career." Reads slightly final/dismissive; tone you flagged you'll soften.

**Duplicated templates that can drift.**
- **#11 `send-intro-email.ts` and #12 `resend-intro-email.js` are NOT identical anymore.** Three real drifts: (a) #11 hardcodes `at {job.company}` and renders literal "at undefined" if company is null; #12 conditionally drops it. (b) #11's dashboard CTA sub-copy still mentions **"Sign in with Google"** — a stale reference, Google auth is not in the current flow. #12 dropped that string. (c) #11 subject template assumes both `title` and `company` exist; #12 falls back to `'role'`. Recommend: extract a shared `buildIntroEmail(job, intro, mode: 'first' | 'resend')` helper and delete one of the templates, OR delete one of the two endpoints entirely and call the survivor from both contexts.
- The `wrap()` helper in `review-candidate.js` is good (single footer); recommend the same pattern for the other multi-template files.

**Reply-to vs no-reply mismatch.** All app emails are sent `from: SFC Talent <noreply@strategicfinancecareers.com>`, but several explicitly invite replies:
- #5 Recruiter approved — "Reply to this email if you have any questions"
- #6 Recruiter rejected — "just reply to this email"
- #8 Candidate rejected — "just reply to this email — we read every response"
- #10 Candidate deactivated — "just reply to this email and we'll sort it out"
- #15 (orphaned) — N/A

If you want those replies to actually reach a human, either set a `Reply-To: talent@strategicfinancecareers.com` (Resend supports this) or change the inviting copy to direct them to a mailto link. As written, a reply goes to `noreply@…` and is silently dropped.

**Recipient list — `TEST_CC` in #13 and #14.** `respond-to-intro.ts` adds `TEST_CC_EMAIL` to the `to:` array (not `bcc:`), so every recruiter who gets a candidate's accept/decline can see the test address in their To: header. Worth cleaning up before this reads as unprofessional or accidentally outs the CC pattern. Also — when the recruiter's email lookup fails, the email goes ONLY to `TEST_CC` (the recruiter learns nothing).

**Stale "Sign in with Google" reference** in #11 — Google auth isn't the current sign-in flow for candidates. Pure copy fix.

**Orphaned endpoint #15.** `api/send-candidate-welcome.ts` exists with an idempotent `dashboard_welcome_sent` flag but nothing calls it. Either wire it up (likely after first sign-in to the new dashboard) or delete it — dead endpoints rot quietly and someone will eventually wire it up half-correctly.

**Dead `AuthContext.signup` with stale redirect.** `src/contexts/AuthContext.tsx:215` calls `supabase.auth.signUp({ options: { emailRedirectTo: ${origin}/dashboard } })` but the exported `signup` function isn't called anywhere (grep confirms). `/dashboard` isn't a route. Safe to delete the function whenever you next touch AuthContext — has no effect today but would mis-route if anyone re-wired it.

**Inconsistent template style.** Three different authoring styles for the same product:
- Raw string concatenation (`submit-candidate.ts`, `send-intro-email.ts`, `respond-to-intro.ts`)
- Template literals with backticks (`recruiter-signup.js`, `review-recruiter.js`, `send-candidate-welcome.ts`)
- A typed `buildEmail()` switch with shared `wrap()` (`review-candidate.js`)
The third is the cleanest; if you want consistency, that's the pattern to standardize on.

**Brand color inconsistency.** Templates all use `#0F6E56` (a dark teal) as the accent color. The `/apply` and dashboard UI use `#008037` (brighter green) as the brand color. If the email accent should match the in-app brand, every template's `#0F6E56` needs to flip to `#008037`. Cosmetic but visible.

**No "intro request created" confirmation to the recruiter.** When a recruiter submits an intro via `/api/submit-intro`, the candidate gets #11 but the recruiter gets no email confirmation that the request went out. They only hear back via #13 or #14. Worth flagging as a gap, not necessarily a bug.
