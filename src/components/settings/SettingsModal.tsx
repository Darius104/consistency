import type { Tag, Template, ThemeId } from "../../types";
import type { FreezeCandidate } from "../../utils/stats";
import { THEMES } from "../../utils/themes";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Modal } from "../ui/Modal";
import { BackupSection } from "./BackupSection";
import { StreakFreezeManager } from "./StreakFreezeManager";
import { TagManager } from "./TagManager";
import { TemplateManager } from "./TemplateManager";
import { ThemeCarousel } from "./ThemeCarousel";
import "./SettingsModal.css";

interface SettingsModalProps {
  theme: ThemeId;
  onChangeTheme: (theme: ThemeId) => void;
  remindersEnabled: boolean;
  onChangeRemindersEnabled: (enabled: boolean) => void;
  tags: Tag[];
  onUpdateTag: (id: number, name: string, color: string) => void;
  onDeleteTag: (id: number) => void;
  templates: Template[];
  onDeleteTemplate: (id: number) => void;
  frozenDays: string[];
  freezeCandidates: FreezeCandidate[];
  freezesRemaining: number;
  onFreezeDay: (date: string) => void;
  onUnfreezeDay: (date: string) => void;
  onStartArranging: () => void;
  onClose: () => void;
}

export function SettingsModal({
  theme,
  onChangeTheme,
  remindersEnabled,
  onChangeRemindersEnabled,
  tags,
  onUpdateTag,
  onDeleteTag,
  templates,
  onDeleteTemplate,
  frozenDays,
  freezeCandidates,
  freezesRemaining,
  onFreezeDay,
  onUnfreezeDay,
  onStartArranging,
  onClose,
}: SettingsModalProps) {
  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="settings">
        <div className="settings__section">
          <span className="settings__label">Theme</span>
          <ThemeCarousel themes={THEMES} selected={theme} onSelect={onChangeTheme} />
        </div>

        <div className="settings__section">
          <span className="settings__label">Layout</span>
          <div className="settings__row">
            <span className="settings__row-text">
              Reorder the streak, weekly %, and task list on the right panel
            </span>
            <Button onClick={onStartArranging}>Arrange right panel</Button>
          </div>
        </div>

        <div className="settings__section">
          <span className="settings__label">Categories</span>
          <TagManager tags={tags} onUpdateTag={onUpdateTag} onDeleteTag={onDeleteTag} />
        </div>

        <div className="settings__section">
          <span className="settings__label">Templates</span>
          <TemplateManager
            templates={templates}
            tags={tags}
            onDeleteTemplate={onDeleteTemplate}
          />
        </div>

        <div className="settings__section">
          <span className="settings__label">Streak freezes</span>
          <StreakFreezeManager
            frozenDays={frozenDays}
            candidates={freezeCandidates}
            freezesRemaining={freezesRemaining}
            onFreeze={onFreezeDay}
            onUnfreeze={onUnfreezeDay}
          />
        </div>

        <div className="settings__section">
          <span className="settings__label">Reminders</span>
          <Checkbox
            checked={remindersEnabled}
            onChange={onChangeRemindersEnabled}
            label="Notify me when a scheduled task's time arrives"
          />
          <span className="settings__hint">
            Needs notification permission from macOS, and the app has to stay
            running (it can be in the background) to send them.
          </span>
        </div>

        <div className="settings__section">
          <span className="settings__label">Backup</span>
          <BackupSection />
        </div>
      </div>
    </Modal>
  );
}
