import { useEffect, useState } from "react";
import { getMyProfile, updateDisplayName, updateMyProfile } from "../../db/friends";
import { DEFAULT_AVATAR_ID, MAX_BIO_LENGTH, type AvatarId } from "../../utils/avatars";
import { AvatarBadge } from "../stats/AvatarBadge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EditIcon } from "../ui/icons";
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
    return <span className="settings__hint">Loading…</span>;
  }

  return (
    <div className="profile-section">
      {error && <div className="profile-section__error">{error}</div>}

      <Card className="profile-card">
        <div className="profile-card__header">
          <button
            type="button"
            className="profile-card__avatar-trigger"
            onClick={() => setPickingAvatar(true)}
            aria-label="Change avatar"
          >
            <AvatarBadge avatarId={avatarId} size={72} />
            <span className="profile-card__avatar-edit">
              <EditIcon size={12} />
            </span>
          </button>
          <div className="profile-card__name-field">
            <span className="settings__label">Name (shown to friends)</span>
            <input
              className="profile-section__input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
        </div>

        <div className="profile-card__bio-field">
          <span className="settings__label">Bio</span>
          <textarea
            className="profile-section__bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
            placeholder="A short line about you…"
            rows={2}
          />
          <span className="settings__hint">
            {bio.length}/{MAX_BIO_LENGTH}
          </span>
        </div>

        <div className="profile-section__save-row">
          <Button variant="primary" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {saved && <span className="profile-section__saved">Saved.</span>}
        </div>
      </Card>

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
