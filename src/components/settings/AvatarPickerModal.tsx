import { useState } from "react";
import { AVATAR_SECTIONS, type AvatarId } from "../../utils/avatars";
import { AvatarBadge } from "../stats/AvatarBadge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import "./AvatarPickerModal.css";

interface AvatarPickerModalProps {
  currentAvatarId: AvatarId;
  onSave: (avatarId: AvatarId) => void;
  onClose: () => void;
}

export function AvatarPickerModal({ currentAvatarId, onSave, onClose }: AvatarPickerModalProps) {
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
          <Button variant="primary" onClick={() => onSave(draftId)}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
