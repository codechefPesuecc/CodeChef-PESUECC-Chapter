# CodeChef PESUECC Platform TODOs

## [Medium Priority] Leaderboard Pagination & Materialized Views
**Issue:** The `/api/leaderboard` endpoint currently fetches all `AC` submissions, computes the entire scoreboard (including speed-bounties per challenge), sorts it in memory, and returns the full array to the client.
**Impact:** As the userbase grows, this will cause heavy DB load, high memory usage on the Cloudflare Worker, and browser lag rendering a massive DOM table.

**Implementation Plan:**
1. **Materialized Scoreboard (Database):** Because a user's total points require calculating speed-bounties across *all* challenges, we cannot simply use a SQL `LIMIT` / `OFFSET` on the `submissions` table. We need to create a materialized view or a `user_scores` table that updates dynamically (or via a cron job) so we can query total points directly.
2. **API Pagination:** Update `src/app/api/leaderboard/route.ts` to accept `?page=1&limit=50`.
3. **UI Updates:** Modify `LeaderboardView.tsx` to handle `page` state and add a `<Pagination />` component beneath the table.
4. **Current User Pinning:** Ensure the currently logged-in user is always fetched and pinned to the bottom of the table if they aren't on the active page.
