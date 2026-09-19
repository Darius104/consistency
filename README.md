# Consistency

A native habit/task-tracking app for macOS and iOS - a calendar-first view of
your day, streaks with a limited number of monthly "freeze" days to protect
them, categories, quick notes, task reminders, and optional read-only
calendar sharing with friends.

Built with [Tauri](https://tauri.app/) (Rust) + React/TypeScript, backed by
[Supabase](https://supabase.com/) with a local SQLite cache so it stays fully
usable offline and syncs automatically once you're back online.

## Download (macOS)

Grab the latest `.dmg` from the [Releases page](../../releases/latest).

This build isn't notarized by Apple (that requires a paid developer
account), so macOS's Gatekeeper will warn that it's from an "unidentified
developer" the first time you open it. To run it anyway:

1. Try to open the app - you'll see a warning dialog.
2. Open **System Settings → Privacy & Security**, scroll down, and click
   **Open Anyway** next to the mention of Consistency.
3. Confirm in the dialog that appears. You only need to do this once.

iOS isn't distributed this way (Apple doesn't allow installing iOS apps
outside the App Store or TestFlight) - this repo is desktop-only for now.

## Features

- Calendar + day panel layout with drag-to-reorder tasks, categories, and notes
- Streaks with monthly "freeze" days so a missed day doesn't have to break one
- Customizable day-panel widgets (streak, weekly progress, freezes, category
  breakdown, quote of the day)
- Local task reminders via OS notifications
- A small profile (name, bio, an emoji avatar) visible to friends
- Friends: mutual invite codes, read-only calendar viewing
- Fully offline-capable - a local SQLite cache is the source of truth for
  reads/writes, with a background sync/outbox to Supabase

## Development

```sh
npm install
npm run tauri dev      # desktop
npm run tauri ios dev  # iOS (needs Xcode + a configured signing team)
```

Requires a Supabase project - copy `.env.example` to `.env` and fill in your
project's URL and anon key. The Postgres schema/RLS policies live in
`supabase/*.sql` and need to be run once in your Supabase project's SQL
editor (see the comment at the top of each file).
