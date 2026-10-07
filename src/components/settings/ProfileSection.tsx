import { useEffect, useState } from "react";
import { getMyProfile, updateDisplayName, updateMyProfile } from "../../db/friends";
import { DEFAULT_AVATAR_ID, MAX_BIO_LENGTH, type AvatarId } from "../../utils/avatars";
import { AvatarBadge } from "../stats/AvatarBadge";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { AvatarPickerModal } from "./AvatarPickerModal";
import "./ProfileSection.css";

export function ProfileSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pickingAvatar, setPickingAvatar] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [avatarId, setAvatarId] = useState<AvatarId>(DEFAULT_AVATAR_ID);
  const [bio, setBio] = useState("");

  // The last-saved (or last-loaded) values, so Save can stay disabled until
  // something actually differs from what's already persisted.
  const [lastPersisted, setLastPersisted] = useState<{
    displayName: string;
    avatarId: AvatarId;
    bio: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((profile) => {
        if (cancelled) return;
        const bioValue = profile.bio ?? "";
        setDisplayName(profile.displayName);
        setAvatarId(profile.avatarId);
        setBio(bioValue);
        setLastPersisted({ displayName: profile.displayName, avatarId: profile.avatarId, bio: bioValue });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load your profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty =
    lastPersisted !== null &&
    (displayName !== lastPersisted.displayName ||
      avatarId !== lastPersisted.avatarId ||
      bio !== lastPersisted.bio);

  async function handleSave() {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError("Your name can't be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const trimmedBio = bio.trim();
      await Promise.all([
        updateDisplayName(trimmedName),
        updateMyProfile({ avatarId, bio: trimmedBio ? trimmedBio : null }),
      ]);
      setDisplayName(trimmedName);
      setBio(trimmedBio);
      setLastPersisted({ displayName: trimmedName, avatarId, bio: trimmedBio });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="settings-pages profile-page">
        <div className="profile-page__hero">
          <Skeleton width={88} height={88} radius="50%" />
          <Skeleton width={90} height="0.8em" />
        </div>
        <Skeleton height={96} radius="14px" />
      </div>
    );
  }

  return (
    <div className="settings-pages profile-page">
      <div className="profile-page__hero">
        <button
          type="button"
          className="profile-page__avatar"
          onClick={() => setPickingAvatar(true)}
          aria-label="Change avatar"
        >
          <AvatarBadge avatarId={avatarId} size={88} />
        </button>
        <button type="button" className="profile-page__change" onClick={() => setPickingAvatar(true)}>
          Change avatar
        </button>
      </div>

      <div className="settings-group-wrap">
        <div className="settings-group">
          <label className="settings-group__row">
            <span className="settings-group__label profile-page__field-label">Name</span>
            <input
              className="settings-group__input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </label>
          <label className="settings-group__row settings-group__row--top">
            <span className="settings-group__label profile-page__field-label">Bio</span>
            <textarea
              className="settings-group__input profile-page__bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
              placeholder="A short line about you"
              rows={2}
            />
          </label>
        </div>
        <span className="settings-footnote">
          Friends see this on your card · {bio.length}/{MAX_BIO_LENGTH}
        </span>
        {error && <span className="settings-footnote settings-footnote--warning">{error}</span>}
      </div>

      <Button
        variant="primary"
        className="settings-primary-action"
        onClick={handleSave}
        disabled={saving || !dirty}
      >
        {saving ? "Saving…" : saved ? "Saved" : "Save"}
      </Button>

      {pickingAvatar && (
        <AvatarPickerModal
          currentAvatarId={avatarId}
          onChoose={(id) => {
            setAvatarId(id);
            setPickingAvatar(false);
          }}
          onClose={() => setPickingAvatar(false)}
        />
      )}
    </div>
  );
}
