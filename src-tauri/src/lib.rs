use tauri_plugin_sql::{Migration, MigrationKind};

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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
