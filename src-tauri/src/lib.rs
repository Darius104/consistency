use tauri_plugin_sql::{Migration, MigrationKind};

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
        let generator: *mut Object = msg_send![class!(UIImpactFeedbackGenerator), alloc];
        let generator: *mut Object = msg_send![generator, initWithStyle: 1i64];
        let _: () = msg_send![generator, prepare];
        let _: () = msg_send![generator, impactOccurred];
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
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:app.db", migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![haptic_impact])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
