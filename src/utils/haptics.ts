import { invoke } from "@tauri-apps/api/core";

/** A firm tap - for the bigger moments of a drag (picking something up).
 *  No-op on desktop (see haptic_impact in src-tauri/src/lib.rs). */
export function hapticImpact() {
  invoke("haptic_impact").catch(() => {});
}

/** iOS's light "tick" - for something being dragged passing over a new
 *  slot. No-op on desktop (see haptic_selection in src-tauri/src/lib.rs). */
export function hapticSelection() {
  invoke("haptic_selection").catch(() => {});
}
