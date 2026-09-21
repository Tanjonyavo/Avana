"use client";

export function PrivacySettingsButton() {
  return (
    <button className="footer-button" onClick={() => window.dispatchEvent(new Event("avana:privacy"))}>
      Préférences de confidentialité
    </button>
  );
}
