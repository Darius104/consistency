import { useState } from "react";
import { AVATAR_SECTIONS, type AvatarId } from "../../utils/avatars";
import { AvatarBadge } from "../stats/AvatarBadge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import "./AvatarPickerModal.css";

interface AvatarPickerModalProps {
  currentAvatarId: AvatarId;
  /** Only applies the pick to the caller's own draft state - it does not
   *  persist anything itself. The caller (ProfileSection) still needs its
   *  own page-level Save clicked for this to actually reach the server,
   *  which is why this button says "Done" rather than "Save". */
  onChoose: (avatarId: AvatarId) => void;
  onClose: () => void;
}

export function AvatarPickerModal({ currentAvatarId, onChoose, onClose }: AvatarPickerModalProps) {
  const [draftId, setDraftId] = useState(currentAvatarId);

  return (
    <Modal title="Choose an avatar" onClose={onClose}>
      <div className="avatar-picker">
        {AVATAR_SECTIONS.map((section) => (
          <div className="avatar-picker__section" key={section.label}>
            <span className="settings__label">{section.label}</span>
            <div className="avatar-picker__grid">
              {section.options.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`avatar-picker__option ${
                    option.id === draftId ? "avatar-picker__option--active" : ""
                  }`}
                  onClick={() => setDraftId(option.id)}
                  aria-label={`Choose ${option.id} avatar`}
                  aria-pressed={option.id === draftId}
                >
                  <AvatarBadge avatarId={option.id} size={44} />
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="avatar-picker__footer">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onChoose(draftId)}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
