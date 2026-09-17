# Consistency — Next Steps

## Status as of 2026-09-11

- **Phase 1 (Supabase backend):** done.
- **Phase 2 (offline support):** done. Local SQLite cache + outbox syncs automatically when back online. Verified on desktop and on the physical iPhone (toggled Airplane Mode with the app open, created/completed a task offline, confirmed it synced once back online) — **the one remaining Phase 3 item is now closed out.**
- **Phase 3 (iOS mobile app):** done on iOS. Native build via Tauri, touch-friendly drag-and-drop, responsive phone layout, real-device tested. Android not started (see below).
- **Mobile UX:** extensively polished this pass - stacked one-scroll calendar+day-panel layout, expand/collapse toggle (with matching auto-scroll and live drag-follow), scroll-fade edges with a proper divider line, fixed flame animation jank (was actually iOS Low Power Mode throttling, not the CSS), fixed a real checkbox double-tap bug (18px tap target was too small - enlarged it), fixed a genuine WebKit "priming tap" bug (hover-styled ancestors need a first tap before delivering clicks to nested elements on iOS - gated hover styles to real pointer devices only).
- **Drag-and-drop, app-wide:** every reorderable list (day-panel blocks/"right panel", categories in the day view, tasks within a category, categories in Settings) now has: real-time drag-follow (the dragged item visually tracks your finger/cursor instead of just showing a drop-line), auto-scroll when dragging near a scrollable edge, and scroll-compensated tracking (stays glued to the pointer even while auto-scroll is moving the list underneath it) - fixed several real bugs along the way (a dragged item's own displaced rect interfering with drop-position calculation; `setPointerCapture` throwing on some iOS versions and silently killing the whole drag).
- **Categories & Templates merged:** Settings → Categories is now the one place to create a category, rename/recolor/reorder/delete it, and optionally give it a "starter tasks" list (what used to be a separate, confusingly-named "Templates" section) - same underlying data, just reorganized. Category rows were since redesigned again for clarity: rename/starter-tasks/delete are now three explicit, tooltipped controls instead of one ambiguous "click the name" affordance.
- **Settings redesign:** unified inconsistent section-label styling, added a settle-in transition when switching tabs, more breathing room on desktop (720×640), fixed a premature-scrollbar bug in Streak Freezes (same class of bug fixed in Categories).
- **Friends (read-only calendar viewing):** done and verified end-to-end on **both desktop and iOS**, with a real second account/device (your friend Isabel) - mutual code redemption, read-only calendar view in the friend's own theme/colors, friends list auto-refreshes, remove-friend now requires confirmation, settings/phrase-of-the-day buttons are hidden (not just inert) while viewing a friend.
- **Isabel's iPhone is now a second registered device** — her phone was paired (`xcrun devicectl manage pair`), Developer Mode enabled, registered with the Apple Developer account by selecting it as a run destination in Xcode once, and she manually trusted the developer profile under Settings → General → VPN & Device Management. Every future build now gets installed+launched on **both** phones (yours and hers) as part of the normal deploy routine - confirmed working end-to-end. She's on the same WiFi as this Mac, so (like your own phone) she should stay reachable wirelessly without needing the USB cable again, unless the pairing ever drops.
- **Streak component decluttered:** the "N freezes left this month" line was removed from the streak card (still shown, functionally, on the Settings → Streak Freezes page - just no longer duplicated on the streak widget itself).
- **Drag interaction redesigned:** Categories (Settings), tag groups, and tasks within a group no longer have a dedicated grip-handle icon - press-and-hold anywhere on the row starts a reorder on mobile (matches iOS's own long-press-to-reorder convention), and on desktop you grab and drag from anywhere once the mouse moves a few pixels (a plain click still fires normally). The day-panel's "right panel" blocks keep their original explicit Arrange-mode + dedicated-handle mechanic unchanged, on both platforms, by design. New shared logic lives in `src/hooks/useReorderDrag.ts`.
- **App icon:** done for macOS + iOS; Android assets staged and ready whenever Android is set up.
- **Phase 4 (App Store publishing):** not started.

## Open items

1. **Android** (second platform) — install Android Studio + SDK, `tauri android init`, reuse the same touch/layout work already done for iOS. No new architecture needed.
2. **Phase 4 — App Store publishing** — needs the paid $99/year Apple Developer account, store listing assets, a distribution provisioning profile (different from the free local-testing one), App Store Connect setup, and is also what unlocks TestFlight (a cleaner way to push updates to Isabel's phone than manual devicectl installs, if that becomes worth it).
3. Minor/optional: 4 historical tasks recovered during the original Phase 2 incident (Work, Wash Dishes, Isa Reminder, Darius Makes Dinner) were left out since their category couldn't be confidently recovered — not re-adding unless you ask.

Note: a Face ID/Touch ID app-unlock feature was built and then deliberately reverted (decided it's not needed for an app this size) - not on the list above on purpose.

## How session persistence currently works (for context)

Supabase's client library (`src/lib/supabaseClient.ts`, default config) stores your session in the WebView's `localStorage`, which Tauri persists to disk across full app restarts - so you stay signed in without re-entering credentials, and the token auto-refreshes in the background while the app runs. You'd only see the sign-in screen again after an explicit sign-out or if that stored session data were cleared.

## How to resume local dev

- Desktop: `npm run tauri dev`
- iOS Simulator: `npm run tauri ios dev "iPhone 17"` (or whichever simulator name)
- iOS physical device: `TAURI_DEV_HOST=<your Mac's LAN IP> npm run tauri ios dev "iPhone"` — the device must already be signed/trusted from this session (see `phase3_ios_mobile` notes if picking this up in a new session with a fresh device or fresh Xcode signing state).
- Only run one of desktop/iOS at a time — they share the same Vite dev server port (1420).
- Deploying a rebuilt app: desktop is `npm run tauri build` then copy `src-tauri/target/release/bundle/macos/Consistency.app` to `/Applications` (verify the binary's embedded `dist/assets/index-*.js|css` hash matches the freshly-built `dist/assets/` files first). iOS physical device is `npx tauri ios build --export-method debugging`, then `xcrun devicectl device install app --device <id> src-tauri/gen/apple/build/arm64/Consistency.ipa` followed by `xcrun devicectl device process launch --device <id> com.darius.consistency` — **do this once per device** (there are two now): your iPhone is `E577CF1C-5188-597D-BF11-6D53C01FEF5C`, Isabel's iPhone is `8330E658-7450-58B0-B5B9-BF488F292A8D`. Bundle id is `com.darius.consistency` for both.
- Node/npm/npx aren't on PATH by default in a fresh shell in this environment — run `export NVM_DIR="$HOME/.nvm"; source "$NVM_DIR/nvm.sh"; nvm use 22` first.
- If `npm run tauri build`'s dmg bundling step fails with a bundle_dmg.sh error, a leftover mounted disk image from a previous build is usually the cause - `hdiutil info` to find it, `hdiutil detach /dev/diskN -force` to clear it, then rebuild.
