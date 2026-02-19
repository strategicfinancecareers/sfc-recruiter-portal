
## Fix the Auth Session Race Condition (For Real This Time)

### What's Actually Wrong

The `AuthContext.tsx` still has the `initializing` flag that was supposed to be removed. This creates a deadlock:

1. `onAuthStateChange` fires but sees `initializing = true`, so it skips `setIsLoading(false)` (line 125-127)
2. `getSession` is supposed to set `initializing = false` and then call `setIsLoading(false)`
3. But if `onAuthStateChange` fires and completes *before* `getSession` resolves, loading gets stuck

Additionally, the `login()` function calls `setIsLoading(true)` on line 172 and `setIsLoading(false)` on line 201 in a `finally` block — this races against `onAuthStateChange` and can reset loading prematurely.

### Also: Delete `useSupabaseSession`

`useSupabaseSession` in `src/integrations/supabase/hooks.ts` creates a second, independent Supabase auth listener. It's a duplicate of `AuthContext` and shouldn't exist. It's no longer used anywhere now that `Home.tsx` was updated to `useAuth`.

### The Fix

**`src/contexts/AuthContext.tsx`** — Implement the plan that was approved but not fully applied:

1. Remove the `initializing` flag entirely
2. Let `onAuthStateChange` *always* call `setIsLoading(false)` after it finishes (no condition)
3. Use `getSession` only as a fallback for when there's *no* session (so the page doesn't hang waiting for `onAuthStateChange` to fire)
4. Remove `setIsLoading(true/false)` from `login()`, `signInWithGoogle()`, and `signInWithMicrosoft()` — `onAuthStateChange` handles this now
5. Remove all the debug `console.log` statements

**`src/integrations/supabase/hooks.ts`** — Delete `useSupabaseSession` entirely (or clear the file) since it's no longer used and creates a duplicate listener

**`src/pages/Login.tsx`** — Remove the debug `console.log` statements. Button should remain using only `localLoading` (not `isLoading`) so a stuck global loading state can never disable the login button.

### Result

- Single source of truth for auth state
- No race condition between two competing state machines
- Login button never gets stuck
- Home page never goes blank
