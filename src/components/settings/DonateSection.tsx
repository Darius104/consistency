import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { HeartIcon } from "../ui/icons";
import "./DonateSection.css";

const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/coman";

export function DonateSection() {
  return (
    <Card>
      <span className="settings__label">Support Consistency</span>
      <div className="donate-section">
        <span className="donate-section__icon" aria-hidden="true">
          <HeartIcon size={20} />
        </span>
        <p className="donate-section__text">
          Consistency is free to use. If it's helped you build a habit or two, buying me a coffee
          goes a long way toward keeping it running and improving.
        </p>
        <Button
          variant="primary"
          className="donate-section__button"
          onClick={() => void openUrl(BUY_ME_A_COFFEE_URL)}
        >
          <HeartIcon size={14} /> Buy me a coffee
        </Button>
      </div>
    </Card>
  );
}
