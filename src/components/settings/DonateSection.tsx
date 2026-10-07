import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "../ui/Button";
import { HeartIcon } from "../ui/icons";
import "./DonateSection.css";

const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/coman";

export function DonateSection() {
  return (
    <div className="settings-pages">
      <div className="donate-page__hero">
        <span className="donate-page__icon" aria-hidden="true">
          <HeartIcon size={26} />
        </span>
        <span className="donate-page__title">Support Consistency</span>
        <p className="donate-page__text">
          It's free to use. If it's helped you build a habit, a coffee helps keep it running and
          improving.
        </p>
      </div>
      <Button
        variant="primary"
        className="settings-primary-action"
        onClick={() => void openUrl(BUY_ME_A_COFFEE_URL)}
      >
        <HeartIcon size={15} /> Buy me a coffee
      </Button>
    </div>
  );
}
