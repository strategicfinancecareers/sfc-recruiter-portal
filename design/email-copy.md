# SFC Talent — Email Copy

All transactional email copy in one place, for review + markup. Edit the wording here, then a developer applies it to the source files listed under each email.

- **Provider:** Resend (API key env var `RESEND_API_KEY`). Auth/verification email is sent by Supabase Auth (dashboard-managed, see the Auth section).
- **From (all app emails):** `SFC Talent <noreply@strategicfinancecareers.com>` — except #16 below, which still uses a stray test sender (`Lovable <notifications@resend.dev>`).
- **Footer (most emails):** `SFC Talent · strategicfinancecareers.com`
- **Dynamic values** are shown in `{curly braces}` — e.g. `{firstName}`, `{jobTitle}`.
- Copy is **inline HTML in the code** (no template files, no provider dashboard) unless noted.

---

## Candidate emails

### 1. Application received (under review)
- **Trigger:** candidate submits their profile (`POST /api/submit-candidate`)
- **Source:** `api/submit-candidate.ts:335`
- **Subject:** `Welcome to SFC Talent — Your application is under review`
- **Body:**

> ## Application received ✓
>
> Hi {firstName},
>
> Thanks for applying to SFC Talent. Your profile is now **under review** by our team — we manually vet every candidate before introducing them to top finance teams.
>
> What happens next:
> - Our team reviews your profile (usually within 1–2 business days)
> - We'll email you the moment your profile is approved
> - Once approved, recruiters can browse your anonymous profile and request introductions
> - You'll have **48 hours to respond** to each intro request — just reply YES or NO
>
> **Manage your profile**
> Update your bio, skills, and availability anytime from your candidate dashboard.
> **[ Open My Dashboard → ]**
> Sign in with the email and password you created during signup.
>
> Your identity is always protected. We never share your name, contact details, or employer without your explicit consent.
>
> _SFC Talent · strategicfinancecareers.com_

---

### 2. Dashboard welcome
- **Trigger:** `POST /api/send-candidate-welcome` — ⚠️ **no in-repo caller found** (possibly orphaned or invoked externally; verify before relying on it)
- **Source:** `api/send-candidate-welcome.ts:41`
- **Subject:** `Welcome to your SFC Talent dashboard`
- **Body:**

> _(SFC Talent logo)_
>
> ## Welcome to your dashboard 🎉
>
> Hi {firstName},
>
> You're now signed in to your SFC Talent candidate dashboard. Here's what you can do:
> - See exactly how recruiters view your profile
> - Update your availability, bio, and preferences
> - Track introduction requests and respond directly
>
> **[ Open My Dashboard → ]**
>
> Your identity stays fully protected — recruiters only see your anonymous profile until you choose to connect.
>
> _SFC Talent · strategicfinancecareers.com_

---

### 3. Profile approved → live
- **Trigger:** admin approves the candidate (`POST /api/review-candidate`, action `approve`)
- **Source:** `api/review-candidate.js:37`
- **Subject:** `Your SFC Talent profile is now live`
- **Body:**

> ## You're in 🎉
>
> Hi {firstName},
>
> Great news — your profile has been approved and is now visible to recruiters on our platform. They can browse you anonymously and request introductions.
>
> You'll get an email any time a recruiter requests an intro. You have 48 hours to accept or decline each one.
>
> **[ Open My Dashboard → ]**
>
> Your identity stays protected. We never share your contact details without your explicit consent.
>
> _SFC Talent · strategicfinancecareers.com_

---

### 4. Application not accepted (rejected)
- **Trigger:** admin rejects the candidate (`POST /api/review-candidate`, action `reject`)
- **Source:** `api/review-candidate.js:51`
- **Subject:** `About your SFC Talent application`
- **Note:** the internal rejection reason is intentionally **not** included.
- **Body:**

> ## Thanks for applying to SFC Talent
>
> Hi {firstName},
>
> Thank you for taking the time to apply. After review, we're not able to add your profile to our platform at this time.
>
> If you have any questions, just reply to this email — we read every response.
>
> We wish you the very best in your career.
>
> _SFC Talent · strategicfinancecareers.com_

---

### 5. Profile reactivated
- **Trigger:** admin reactivates a previously inactive/rejected candidate (`POST /api/review-candidate`, action `reactivate`)
- **Source:** `api/review-candidate.js:64`
- **Subject:** `Welcome back to SFC Talent`
- **Body:**

> ## Welcome back 👋
>
> Hi {firstName},
>
> Your profile is live again on our platform and visible to recruiters. You'll start receiving intro requests as they come in.
>
> **[ Open My Dashboard → ]**
>
> _SFC Talent · strategicfinancecareers.com_

---

### 6. Profile paused (deactivated)
- **Trigger:** admin deactivates the candidate (`POST /api/review-candidate`, action `deactivate`)
- **Source:** `api/review-candidate.js:75`
- **Subject:** `Your SFC Talent profile is paused`
- **Body:**

> ## Your profile is now paused
>
> Hi {firstName},
>
> Your profile has been paused and is no longer visible to recruiters on our platform. You won't receive any new introduction requests.
>
> If this was a mistake or you'd like to reactivate, just reply to this email and we'll sort it out.
>
> _SFC Talent · strategicfinancecareers.com_

---

## Recruiter emails

### 7. Recruiter submission received
- **Trigger:** recruiter signs up (`POST /api/recruiter-signup`)
- **Source:** `api/recruiter-signup.js:116`
- **Subject:** `We received your SFC Talent recruiter submission`
- **Body:**

> ## We received your submission
>
> Hi {first_name},
>
> Thanks for submitting your details to SFC Talent. We personally vet every recruiter on the platform to keep quality high on both sides.
>
> We typically approve submissions within a few hours during US business hours (PDT). You'll get an email at this address as soon as your account is live.
>
> **A reminder of what you submitted:**
> - Company: **{company}**
> - LinkedIn: {linkedin_url}
>
> — The SFC Talent team
>
> _SFC Talent · strategicfinancecareers.com_

---

### 8. Recruiter approved
- **Trigger:** admin approves the recruiter (`POST /api/review-recruiter`, action `approve`)
- **Source:** `api/review-recruiter.js:99`
- **Subject:** `You're approved — welcome to SFC Talent`
- **Body:**

> ## Welcome to SFC Talent 🎉
>
> Hi {firstName},
>
> Great news — your recruiter application has been approved. You can now sign in and start browsing our network of vetted finance candidates.
>
> **[ Sign in → ]**
>
> A few notes:
> - Candidates are pre-vetted by our team and stay anonymous until they accept an intro
> - You can request as many intros as you'd like; candidates have 48 hours to respond
> - Reply to this email if you have any questions
>
> _SFC Talent · strategicfinancecareers.com_

---

### 9. Recruiter application not accepted
- **Trigger:** admin rejects the recruiter (`POST /api/review-recruiter`, reject branch)
- **Source:** `api/review-recruiter.js:115`
- **Subject:** `About your SFC Talent recruiter application`
- **Note:** unlike the candidate rejection, this one **does** include the rejection reason text the admin typed.
- **Body:**

> ## Thanks for applying to SFC Talent
>
> Hi {firstName},
>
> Thank you for your interest in joining SFC Talent as a recruiter. After review, we're not able to approve your application at this time.
>
> > {rejectionReason}
>
> If you'd like to discuss this further or reapply later, just reply to this email — we read every response.
>
> _SFC Talent · strategicfinancecareers.com_

---

## Intro emails

### 10. New opportunity → candidate (intro request)
- **Trigger:** recruiter requests an introduction (`POST /api/submit-intro` → `/api/send-intro-email`); also re-sendable by admin (`POST /api/resend-intro-email`)
- **Source:** shared builder `api/_shared/introEmail.js:83` (used by both `send-intro-email.ts` and `resend-intro-email.js`)
- **Subject:** `New opportunity: {jobTitle} at {company}`
- **Body:**

> _(SFC Talent logo)_
>
> ## You have a new opportunity
>
> Hi there,
>
> A company is interested in connecting with you about the **{jobTitle}** role at **{company}**.
>
> _"{recruiter's optional message}"_  ← only shown if the recruiter included one
>
> _Job detail block — either a **[ View Job Posting → ]** button (if a job URL exists), or a small table:_
> - Job Title: {title}
> - Company: {company}
> - Location: {location}
> - Salary: {salary_range} ← only if present
>
> Are you open to connecting?
>
> **[ ✅ Yes, I'm interested ]   [ ❌ No thanks ]**
>
> This introduction was facilitated by SFC Talent. Your contact details will only be shared if you click Yes.
>
> **View this in your dashboard**
> All your introduction requests are tracked in one place.
> **[ Open Dashboard → ]**
>
> _SFC Talent · strategicfinancecareers.com_

---

### 11. Intro accepted → recruiter
- **Trigger:** candidate clicks "Yes" (`GET /api/respond-to-intro?response=yes`) — from the email or the dashboard
- **Source:** `api/respond-to-intro.ts:220`
- **Subject:** `✅ {candidateName} is interested in your {jobTitle} role`
- **Body:**

> _(SFC Talent logo)_
>
> ## Great news — they're interested!
>
> **{candidateName}** has accepted your introduction request for the **{jobTitle}** role at **{company}**.
>
> **Candidate Details:**
> 👤 **{candidateName}**
> 📧 {candidate email}
> 📱 {candidate phone} ← only if on file
>
> **[ 📎 Download Resume ]** ← signed link, valid for 7 days (or a fallback line if no resume)
>
> We recommend reaching out within 24 hours while their interest is fresh.
>
> _SFC Talent · strategicfinancecareers.com_

---

### 12. Intro declined → recruiter
- **Trigger:** candidate clicks "No" (`GET /api/respond-to-intro?response=no`)
- **Source:** `api/respond-to-intro.ts:259`
- **Subject:** `{anonName} passed on the {jobTitle} role`
- **Note:** uses the candidate's anonymous name (identity is only revealed on acceptance).
- **Body:**

> _(SFC Talent logo)_
>
> ## Update on your introduction request
>
> **{anonName}** has passed on the **{jobTitle}** opportunity at this time.
>
> Don't worry — there are more great candidates available. [Browse candidates](https://sfc-recruiter-portal.vercel.app/browse) to find your next match.
>
> _SFC Talent · strategicfinancecareers.com_

---

## Admin-notify emails (internal → the SFC team)

These go to `zu@strategicfinancecareers.com`.

### 13. New candidate application → admin
- **Trigger:** candidate submits (`POST /api/submit-candidate`, second send)
- **Source:** `api/submit-candidate.ts:422`
- **Subject:** `New Candidate Application: {firstName} {lastName} — {role}`
- **Body:**

> ## New Candidate Application
>
> A new candidate has submitted their profile for review.
>
> _Detail table:_ Name · Email · Phone · LinkedIn · Role · Location · Experience · Education · Primary Background · Secondary · Areas of Expertise · Job Status · Target Comp · Work Preference · Preferred Cities · Industries · Company Stage · New Areas · Target Roles · US Work Authorized · Requires Sponsorship
>
> _Bio block_ (if present)
>
> **[ 📎 Download Resume ]** ← signed link valid 7 days (or "Resume uploaded — view in SFC Admin portal." / "No resume uploaded.")
>
> Review this application in the SFC Admin portal.

---

### 14. Candidate profile updated → admin
- **Trigger:** candidate saves profile edits (`PATCH /api/candidate-profile`)
- **Source:** `api/candidate-profile.js:393`
- **Subject:** `Candidate profile updated: {displayName}`
- **Body:**

> ## Candidate profile updated
>
> **{displayName}** updated their profile.
>
> **[ Review in admin panel → ]**
>
> _SFC Talent · strategicfinancecareers.com_

---

### 15. New recruiter signup → admin
- **Trigger:** recruiter signs up (`POST /api/recruiter-signup`, first send)
- **Source:** `api/recruiter-signup.js:88`
- **Subject:** `New recruiter signup pending review: {fullName}`
- **Body:**

> ## New recruiter signup pending review
>
> _Detail table:_ Name · Email · Company · LinkedIn
>
> **[ Review in admin panel → ]**
>
> _SFC Talent · strategicfinancecareers.com_

---

### 16. New introduction request → admin  ⚠️ STRAY SENDER
- **Trigger:** Supabase edge function `notify-intro-created` (intended to fire on intro creation; see Task 1 findings — no in-repo trigger, likely a dashboard DB webhook)
- **Source:** `supabase/functions/notify-intro-created/index.ts:118`
- **From:** ⚠️ **`Lovable <notifications@resend.dev>`** — wrong brand name + unverified test domain. The only email NOT on the SFC Talent sender.
- **Subject:** `New introduction request from {requesterName}`
- **Recipients:** admins with `notify_intro_requests = true`
- **Body:**

> ## New Introduction Request
>
> **Requester:** {requesterName} ({email})
> **Candidate:** {candidate display_name}
> **Job:** {title} at {company}
> **Requested:** {timestamp}
>
> View in Admin: /introductions

---

## Auth email (Supabase-managed — NOT in this repo)

### 17. Signup / email verification
- **Trigger:** account signup; resent via `supabase/functions/resend-verification` → `supabase.auth.admin.resend(...)`
- **Source:** **Supabase dashboard** → Authentication → Email Templates. The subject, body, sender, and branding all live in the Supabase project settings, **not in the codebase** — so the copy can't be extracted here.
- To edit: change it in the Supabase dashboard (and confirm the configured SMTP/sender there matches the SFC Talent brand).

---

## Notes for editing

- **One stray sender to fix (#16):** `Lovable <notifications@resend.dev>` should become `SFC Talent <noreply@strategicfinancecareers.com>` (pending the Task 1 decision on whether to keep, port, or remove this function).
- **No shared layout:** every email re-declares its own HTML wrapper + footer (only the intro email #10/#13 share a builder). A global header/footer change means editing each file.
- **From-address is hardcoded** in ~10 places (all identical except #16) — there's no single env var for it.
- **Brand color in emails** is the older teal `#0F6E56` (and `#0A0A0A` for one dashboard button in the intro email), not the app's current `#008037` green — worth aligning if you want email branding to match the site.
