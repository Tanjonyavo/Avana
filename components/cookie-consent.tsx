"use client";

import { useEffect, useState } from "react";
import { readConsent, writeConsent } from "@/lib/analytics-client";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const consent = readConsent();
      if (consent) {
        setAnalytics(consent.analytics);
        setMarketing(consent.marketing);
      } else {
        setVisible(true);
      }
    });
    const reopen = () => {
      const consent = readConsent();
      setAnalytics(Boolean(consent?.analytics));
      setMarketing(Boolean(consent?.marketing));
      setCustomizing(true);
      setVisible(true);
    };
    window.addEventListener("avana:privacy", reopen);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("avana:privacy", reopen);
    };
  }, []);

  const choose = (choices: { analytics: boolean; marketing: boolean }) => {
    writeConsent(choices);
    if (!choices.analytics) localStorage.removeItem("avana-anonymous-id");
    setVisible(false);
    setCustomizing(false);
    window.dispatchEvent(new Event("avana:consent-changed"));
  };

  if (!visible) return null;
  return (
    <aside className="cookie-banner" aria-label="Préférences de confidentialité">
      <h3>Votre vie privée, simplement.</h3>
      <p>
        Le panier et la sécurité utilisent un stockage nécessaire. L’analytique AVANA, hébergée avec le site,
        reste facultative.
      </p>
      {customizing && (
        <div className="cookie-preferences">
          <label className="consent-check">
            <input type="checkbox" checked disabled />
            <span>
              <strong>Nécessaires</strong>
              <small>Panier, session et sécurité.</small>
            </span>
          </label>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={analytics}
              onChange={(event) => setAnalytics(event.target.checked)}
            />
            <span>
              <strong>Analytique</strong>
              <small>Mesure anonyme des pages et conversions.</small>
            </span>
          </label>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={marketing}
              onChange={(event) => setMarketing(event.target.checked)}
            />
            <span>
              <strong>Marketing</strong>
              <small>Réservé aux futures campagnes autorisées.</small>
            </span>
          </label>
        </div>
      )}
      <div className="cookie-actions">
        {customizing ? (
          <button className="button button-dark button-sm" onClick={() => choose({ analytics, marketing })}>
            Enregistrer
          </button>
        ) : (
          <button
            className="button button-dark button-sm"
            onClick={() => choose({ analytics: true, marketing: true })}
          >
            Tout accepter
          </button>
        )}
        <button
          className="button button-outline button-sm"
          onClick={() => choose({ analytics: false, marketing: false })}
        >
          Nécessaires seulement
        </button>
        {!customizing && (
          <button className="button button-ghost button-sm" onClick={() => setCustomizing(true)}>
            Personnaliser
          </button>
        )}
      </div>
    </aside>
  );
}
