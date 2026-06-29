// Shared LinkedIn profile URL helpers used by the candidate intake wizard
// (CandidateApply.tsx) and the Profile tab editor (ProfileForm.tsx).
//
// Goal: forgiving NORMALIZE first (so a trivial mistake like a missing
// scheme or a stray trailing slash isn't rejected), then a STRICT validate
// (so junk like "test", "ffff", a bare "linkedin.com", or a /company/ page
// is blocked). We store the normalized value in candidates.linkedin_url.

// Strict match: linkedin.com (optionally www. or a 2-3 char country
// subdomain like uk./in.), an /in/ PROFILE path, and a non-empty handle.
// Trailing slash allowed. Case-insensitive (host is lowercased by normalize
// anyway; slug case is preserved).
const LINKEDIN_PROFILE_RE =
  /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?$/i;

// User-facing copy. No em/en dashes.
export const LINKEDIN_ERROR =
  'Please enter a valid LinkedIn profile URL (e.g. linkedin.com/in/your-name)';

/**
 * Forgiving normalization. Returns '' for empty input. Never throws.
 *   "linkedin.com/in/zu-daya"        -> "https://www.linkedin.com/in/zu-daya"
 *   "www.linkedin.com/in/zu-daya"    -> "https://www.linkedin.com/in/zu-daya"
 *   "LinkedIn.com/in/zu-daya/"       -> "https://www.linkedin.com/in/zu-daya"
 *   "https://linkedin.com/in/zu-daya"-> "https://www.linkedin.com/in/zu-daya"
 *   "uk.linkedin.com/in/zu-daya"     -> "https://uk.linkedin.com/in/zu-daya"
 * Unparseable junk is returned roughly as-is so validate() can reject it.
 */
export function normalizeLinkedInUrl(raw: string): string {
  let s = (raw || '').trim();
  if (!s) return '';

  // Prepend a scheme if the input doesn't have a real "://" one. This also
  // rescues inputs like "Https:/foo" (single slash) by treating them as
  // scheme-less, so they normalize into something validate() can judge.
  if (!/^https?:\/\//i.test(s)) {
    s = 'https://' + s.replace(/^\/+/, '');
  }

  try {
    const u = new URL(s);
    u.protocol = 'https:';
    let host = u.hostname.toLowerCase();
    // Force www. on a bare linkedin.com; leave country subdomains alone.
    if (host === 'linkedin.com') host = 'www.linkedin.com';
    // Strip trailing slash(es) from the path; drop query/hash for a clean
    // canonical profile URL. Slug case is preserved.
    const path = u.pathname.replace(/\/+$/, '');
    return `https://${host}${path}`;
  } catch {
    // Couldn't parse — hand back the scheme-prefixed string; validate() fails it.
    return s;
  }
}

/** Strict: is this (already-normalized or raw) string a LinkedIn profile URL? */
export function isValidLinkedInUrl(url: string): boolean {
  return LINKEDIN_PROFILE_RE.test(normalizeLinkedInUrl(url));
}
