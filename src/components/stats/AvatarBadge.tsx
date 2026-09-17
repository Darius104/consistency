import type { CSSProperties } from "react";
import { avatarBg, avatarEmoji, type AvatarId } from "../../utils/avatars";
import "./AvatarBadge.css";

interface AvatarBadgeProps {
  avatarId: AvatarId;
  size?: number;
}

export function AvatarBadge({ avatarId, size = 48 }: AvatarBadgeProps) {
  return (
    <span
      className="avatar-badge"
      style={
        {
          "--avatar-size": `${size}px`,
          "--avatar-bg": avatarBg(avatarId),
          fontSize: `${Math.round(size * 0.52)}px`,
        } as CSSProperties
      }
    >
      {avatarEmoji(avatarId)}
    </span>
  );
}
