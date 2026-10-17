use tauri_plugin_sql::{Migration, MigrationKind};

mod native_notifications;

// iOS/WebKit has no web Vibration API (navigator.vibrate is unimplemented
// there, unlike Android Chrome) - the pull-to-refresh gesture's "you can let
// go now" cue instead goes through this native command, straight to
// UIKit's own haptics. No-op on desktop (mouse never triggers pull-to-
// refresh at all - see CalendarView.tsx's pointerType check - so this is
// never even called there, but the command still needs to exist for the
// build).
#[tauri::command]
fn haptic_impact() {
    #[cfg(target_os = "ios")]
    unsafe {
        use objc::runtime::Object;
        use objc::{class, msg_send, sel, sel_impl};

        // UIImpactFeedbackStyleMedium = 1 (UIImpactFeedbackStyle enum).
        // No `prepare` call here - it exists to let the Taptic Engine warm
        // up *ahead of* the triggering event, which only helps when there's
        // a real gap before `impactOccurred`. This command fires both back
        // to back on a freshly allocated generator every time it's invoked
        // (once per pull-to-refresh threshold crossing - see
        // CalendarView.tsx), so `prepare` would give zero latency benefit
        // here; keeping the generator alive across two separate IPC calls
        // just to use it properly isn't worth the added complexity for a
        // single haptic tick.
        let generator: *mut Object = msg_send![class!(UIImpactFeedbackGenerator), alloc];
        let generator: *mut Object = msg_send![generator, initWithStyle: 1i64];
        let _: () = msg_send![generator, impactOccurred];
        let _: () = msg_send![generator, release];
    }
}

// The lighter "tick" iOS plays while something being dragged passes over
// a new slot (UISelectionFeedbackGenerator) - softer than haptic_impact,
// which is for the bigger moments (picking an item up, pull-to-refresh).
// No-op on desktop, same as haptic_impact.
// The clock/battery at the top follow the app's own light/dark mode (the
// app runs under them - see edge_to_edge below), not the phone's: a dark
// app on a phone set to light mode would otherwise get dark icons on a dark
// background. Sets the window's interface style, which the status bar
// follows. Runs on the main thread (with_webview). No-op on desktop.
#[tauri::command]
fn set_native_appearance(webview: tauri::Webview, dark: bool) {
    #[cfg(target_os = "ios")]
    let _ = webview.with_webview(move |wv| unsafe {
        use objc::runtime::Object;
        use objc::{msg_send, sel, sel_impl};

        // UIUserInterfaceStyleLight = 1, UIUserInterfaceStyleDark = 2
        let style: i64 = if dark { 2 } else { 1 };
        let view = wv.inner() as *mut Object;
        let window: *mut Object = msg_send![view, window];
        if !window.is_null() {
            let _: () = msg_send![window, setOverrideUserInterfaceStyle: style];
        }
    });
    #[cfg(not(target_os = "ios"))]
    let _ = (webview, dark);
}

// iPhone: let the page fill the whole screen, under the status bar and the
// home bar. By default the web view keeps the page out of those edges, and
// what shows there instead is the system background (white in light mode).
// With this, plus viewport-fit=cover in index.html, the page reaches the
// edges and steps its own content clear of them with env(safe-area-inset-*).
#[cfg(target_os = "ios")]
fn edge_to_edge(window: &tauri::WebviewWindow) {
    let _ = window.with_webview(|wv| unsafe {
        use objc::runtime::Object;
        use objc::{msg_send, sel, sel_impl};

        let view = wv.inner() as *mut Object;
        let scroll_view: *mut Object = msg_send![view, scrollView];
        // UIScrollViewContentInsetAdjustmentNever = 2
        let _: () = msg_send![scroll_view, setContentInsetAdjustmentBehavior: 2i64];
    });
}

#[tauri::command]
fn haptic_selection() {
    #[cfg(target_os = "ios")]
    unsafe {
        use objc::runtime::Object;
        use objc::{class, msg_send, sel, sel_impl};

        let generator: *mut Object = msg_send![class!(UISelectionFeedbackGenerator), alloc];
        let generator: *mut Object = msg_send![generator, init];
        let _: () = msg_send![generator, selectionChanged];
        let _: () = msg_send![generator, release];
    }
}

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_schema",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_settings_table",
            sql: include_str!("../migrations/0002_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_streak_freezes_table",
            sql: include_str!("../migrations/0003_streak_freezes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add_task_sort_order",
            sql: include_str!("../migrations/0004_task_sort_order.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_tag_sort_order",
            sql: include_str!("../migrations/0005_tag_sort_order.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "add_templates",
            sql: include_str!("../migrations/0006_templates.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "offline_cache",
            sql: include_str!("../migrations/0007_offline_cache.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "add_notes",
            sql: include_str!("../migrations/0008_notes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "add_note_sort_order",
            sql: include_str!("../migrations/0009_note_sort_order.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "add_note_anchor",
            sql: include_str!("../migrations/0010_note_anchor.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "add_scheduled_reminders",
            sql: include_str!("../migrations/0011_scheduled_reminders.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "add_trading_results",
            sql: include_str!("../migrations/0012_trading_results.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "add_trading_result_unit",
            sql: include_str!("../migrations/0013_trading_result_unit.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:app.db", migrations())
                .build(),
        )
        // Desktop-only self-update check, published against this project's
        // GitHub Releases (see RELEASING.md) - iOS can't self-update outside
        // the App Store/TestFlight, and these two plugins aren't even
        // compiled in for that target (see Cargo.toml's target cfg), so
        // registering them has to happen in a .setup() closure rather than
        // the plain .plugin() chain above, which runs unconditionally on
        // every platform this same shared entry point builds for.
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            // iPhone only: push registration for server-sent reminders
            // (only compiled in for iOS - see Cargo.toml).
            #[cfg(target_os = "ios")]
            {
                use tauri::Manager;
                app.handle().plugin(tauri_plugin_mobile_push::init())?;
                for window in app.webview_windows().values() {
                    edge_to_edge(window);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            haptic_selection,
            haptic_impact,
            set_native_appearance,
            native_notifications::native_notifications_available,
            native_notifications::native_request_permission,
            native_notifications::native_schedule_notification,
            native_notifications::native_schedule_notification_at,
            native_notifications::native_cancel_notifications,
            native_notifications::native_pending_notification_ids,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
