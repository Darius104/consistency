//! Real, OS-scheduled local notifications on macOS via UNUserNotificationCenter -
//! bypassing tauri-plugin-notification entirely on this platform, since its
//! desktop backend (see its own src/desktop.rs) only ever shows a
//! notification immediately and silently ignores any `schedule` passed to
//! it. Every other Mac app (Reminders, Calendar, ...) gets "fires even if
//! the app is closed" from exactly this API - this gives Consistency the
//! same thing instead of the JS-side live-poll fallback, which only works
//! while the app is actually open.
//!
//! Every command here always exists on every platform (same convention as
//! haptic_impact in lib.rs), with a real macOS implementation below and a
//! harmless stub everywhere else - `native_notifications_available()` is
//! what JS actually checks before ever calling the rest, so mobile (which
//! already gets real scheduling through tauri-plugin-notification's own
//! Swift/Kotlin code) and other desktop platforms (which fall back to the
//! existing live-poll) never take this path at all.

#[tauri::command]
pub fn native_notifications_available() -> bool {
    cfg!(target_os = "macos")
}

#[cfg(target_os = "macos")]
pub use macos::*;

#[cfg(target_os = "macos")]
mod macos {
    use block2::RcBlock;
    use core::ptr::NonNull;
    use objc2::rc::Retained;
    use objc2::runtime::Bool;
    use objc2_foundation::{NSArray, NSError, NSString};
    use objc2_user_notifications::{
        UNAuthorizationOptions, UNMutableNotificationContent, UNNotificationRequest,
        UNNotificationSound, UNTimeIntervalNotificationTrigger, UNUserNotificationCenter,
    };
    use std::sync::mpsc;

    fn center() -> Retained<UNUserNotificationCenter> {
        UNUserNotificationCenter::currentNotificationCenter()
    }

    /// Blocking-waits on a channel from inside an async command without
    /// blocking the async runtime's own worker thread - the completion
    /// handlers below run on whatever queue Apple's notification runtime
    /// happens to invoke them on, never as something we can `.await`
    /// directly.
    async fn recv_blocking<T: Send + Default + 'static>(rx: mpsc::Receiver<T>) -> T {
        tokio::task::spawn_blocking(move || rx.recv().unwrap_or_default())
            .await
            .unwrap_or_default()
    }

    #[tauri::command]
    pub async fn native_request_permission() -> bool {
        let (tx, rx) = mpsc::sync_channel::<bool>(1);
        {
            // Scoped so this non-Send RcBlock is fully dropped before the
            // `.await` below - Apple's own completion-handler APIs are
            // required (by the Block ABI) to Block_copy any handler they
            // mean to invoke later, so the OS already holds its own
            // retained copy by the time this call returns; our Rust-side
            // handle doesn't need to (and can't, across an await point in
            // a future Tauri requires to be Send) outlive it.
            let block = RcBlock::new(move |granted: Bool, error: *mut NSError| {
                // This whole pipeline otherwise fails completely silently
                // (see useTaskReminders.ts's own comment on the same
                // problem) - a denial here is most often UNErrorDomain
                // error 1 (notificationsNotAllowed), which UNUserNotification
                // Center returns for an app that isn't properly code-signed
                // with a real Apple-issued identity (ad-hoc signing isn't
                // enough, but a free personal-team "Apple Development"
                // certificate is).
                if !error.is_null() {
                    let error = unsafe { &*error };
                    eprintln!(
                        "[native_notifications] permission request failed: {} (domain={}, code={})",
                        error.localizedDescription(),
                        error.domain(),
                        error.code(),
                    );
                }
                let _ = tx.send(granted.as_bool());
            });
            center().requestAuthorizationWithOptions_completionHandler(
                UNAuthorizationOptions::Alert
                    | UNAuthorizationOptions::Sound
                    | UNAuthorizationOptions::Badge,
                &block,
            );
        }
        recv_blocking(rx).await
    }

    /// Schedules one real, OS-level notification - identified by `id` (the
    /// same "<taskId>:<date>" key the reminders system already used for its
    /// old numeric-hash ids, just as a plain string now since
    /// UNNotificationRequest identifiers are strings natively) - to fire
    /// `seconds_from_now` seconds from now. A no-op if that's already in
    /// the past (nothing to schedule).
    #[tauri::command]
    pub fn native_schedule_notification(
        id: String,
        title: String,
        body: String,
        seconds_from_now: f64,
    ) {
        if seconds_from_now <= 0.0 {
            return;
        }

        let content = UNMutableNotificationContent::new();
        content.setTitle(&NSString::from_str(&title));
        content.setBody(&NSString::from_str(&body));
        content.setSound(Some(&UNNotificationSound::defaultSound()));

        let trigger =
            UNTimeIntervalNotificationTrigger::triggerWithTimeInterval_repeats(
                seconds_from_now,
                false,
            );

        let request = UNNotificationRequest::requestWithIdentifier_content_trigger(
            &NSString::from_str(&id),
            &content,
            Some(&trigger),
        );

        // Fire-and-forget - a per-call completion handler would need the
        // same channel-bridging as the two functions below just to observe
        // one NSError we can't act on differently anyway;
        // native_pending_notification_ids (called right after a whole
        // batch is scheduled) already gives the same "did this actually
        // register" signal the old plugin-based confirmedCount check did.
        center().addNotificationRequest_withCompletionHandler(&request, None);
    }

    #[tauri::command]
    pub fn native_cancel_notifications(ids: Vec<String>) {
        if ids.is_empty() {
            return;
        }
        let strings: Vec<Retained<NSString>> = ids.iter().map(|s| NSString::from_str(s)).collect();
        let refs: Vec<&NSString> = strings.iter().map(|s| s.as_ref()).collect();
        let array = NSArray::from_slice(&refs);
        center().removePendingNotificationRequestsWithIdentifiers(&array);
    }

    #[tauri::command]
    pub async fn native_pending_notification_ids() -> Vec<String> {
        let (tx, rx) = mpsc::sync_channel::<Vec<String>>(1);
        {
            // See native_request_permission's comment above - same reason
            // this non-Send block is dropped before the `.await` below.
            let block = RcBlock::new(move |requests: NonNull<NSArray<UNNotificationRequest>>| {
                // SAFETY: the notification center always hands back a
                // valid, non-null array pointer to this completion handler.
                let requests = unsafe { requests.as_ref() };
                let ids: Vec<String> = requests.iter().map(|r| r.identifier().to_string()).collect();
                let _ = tx.send(ids);
            });
            center().getPendingNotificationRequestsWithCompletionHandler(&block);
        }
        recv_blocking(rx).await
    }
}

#[cfg(not(target_os = "macos"))]
pub use stub::*;

#[cfg(not(target_os = "macos"))]
mod stub {
    #[tauri::command]
    pub async fn native_request_permission() -> bool {
        false
    }

    #[tauri::command]
    pub fn native_schedule_notification(
        _id: String,
        _title: String,
        _body: String,
        _seconds_from_now: f64,
    ) {
    }

    #[tauri::command]
    pub fn native_cancel_notifications(_ids: Vec<String>) {}

    #[tauri::command]
    pub async fn native_pending_notification_ids() -> Vec<String> {
        Vec::new()
    }
}
