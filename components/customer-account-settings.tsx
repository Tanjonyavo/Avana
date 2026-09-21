"use client";

import Link from "next/link";
import { Download, MapPin, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CustomerAddress, CustomerProfile } from "@/types/commerce";

const provinces = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

const emptyAddress: Omit<CustomerAddress, "id"> = {
  label: "Maison",
  firstName: "",
  lastName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  province: "QC",
  postalCode: "",
  country: "CA",
  isDefault: false,
};

export function CustomerAccountSettings({
  initialProfile,
  addresses,
}: {
  initialProfile: CustomerProfile;
  addresses: CustomerAddress[];
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [create, setCreate] = useState(emptyAddress);
  const [drafts, setDrafts] = useState<Record<string, CustomerAddress>>(() =>
    Object.fromEntries(addresses.map((address) => [address.id, address])),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const run = async (key: string, url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => {
    setPending(key);
    setMessage("");
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Enregistrement impossible.");
      setMessage("Vos informations sont à jour.");
      router.refresh();
      return true;
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Enregistrement impossible.");
      return false;
    } finally {
      setPending(null);
    }
  };

  const saveProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run("profile", "/api/account/profile", "PATCH", profile);
  };

  const addAddress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await run("new-address", "/api/account/addresses", "POST", create);
    if (created) setCreate(emptyAddress);
  };

  const saveAddress = (address: CustomerAddress) => {
    const { id, ...body } = drafts[address.id] || address;
    void run(id, `/api/account/addresses/${id}`, "PATCH", body);
  };

  const updateAddress = <Key extends keyof CustomerAddress>(
    address: CustomerAddress,
    key: Key,
    value: CustomerAddress[Key],
  ) => {
    const draft = drafts[address.id] || address;
    setDrafts((current) => ({ ...current, [address.id]: { ...draft, [key]: value } }));
  };

  return (
    <div className="account-settings-stack">
      {message && (
        <p className="form-feedback" role="status">
          {message}
        </p>
      )}
      <form className="form-card account-settings-form" onSubmit={saveProfile}>
        <div className="form-card-icon">
          <ShieldCheck size={19} />
        </div>
        <h3>Profil et communications</h3>
        <div className="form-grid">
          <label className="form-field full">
            Nom affiché
            <input
              value={profile.displayName}
              onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))}
              autoComplete="name"
            />
          </label>
          <label className="form-field full">
            Téléphone
            <input
              type="tel"
              value={profile.phone}
              onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
              autoComplete="tel"
            />
          </label>
        </div>
        <label className="consent-check">
          <input
            type="checkbox"
            checked={profile.marketingConsent}
            onChange={(event) =>
              setProfile((current) => ({ ...current, marketingConsent: event.target.checked }))
            }
          />
          <span>Recevoir occasionnellement les nouvelles AVANA. Désabonnement en tout temps.</span>
        </label>
        <button className="button button-dark button-sm" disabled={pending !== null} type="submit">
          <Save size={15} /> Enregistrer le profil
        </button>
      </form>

      <div className="account-addresses">
        <div className="admin-section-header">
          <div>
            <h3>Adresses enregistrées</h3>
            <p>Utilisez-les comme aide-mémoire; Stripe confirme toujours l’adresse finale au paiement.</p>
          </div>
        </div>
        {addresses.map((address) => {
          const draft = drafts[address.id] || address;
          return (
            <details className="account-address-card" key={address.id}>
              <summary>
                <MapPin size={17} />
                <span>
                  <strong>{draft.label}</strong>
                  <small>
                    {draft.addressLine1}, {draft.city}
                  </small>
                </span>
                {draft.isDefault && <span className="status-badge">Par défaut</span>}
              </summary>
              <div className="admin-product-form account-address-form">
                <label>
                  Nom de l’adresse
                  <input
                    required
                    value={draft.label}
                    onChange={(event) => updateAddress(address, "label", event.target.value)}
                  />
                </label>
                <label>
                  Prénom
                  <input
                    required
                    value={draft.firstName}
                    onChange={(event) => updateAddress(address, "firstName", event.target.value)}
                    autoComplete="given-name"
                  />
                </label>
                <label>
                  Nom
                  <input
                    required
                    value={draft.lastName}
                    onChange={(event) => updateAddress(address, "lastName", event.target.value)}
                    autoComplete="family-name"
                  />
                </label>
                <label className="full">
                  Adresse
                  <input
                    required
                    value={draft.addressLine1}
                    onChange={(event) => updateAddress(address, "addressLine1", event.target.value)}
                    autoComplete="address-line1"
                  />
                </label>
                <label className="full">
                  Appartement, unité
                  <input
                    value={draft.addressLine2}
                    onChange={(event) => updateAddress(address, "addressLine2", event.target.value)}
                    autoComplete="address-line2"
                  />
                </label>
                <label>
                  Ville
                  <input
                    required
                    value={draft.city}
                    onChange={(event) => updateAddress(address, "city", event.target.value)}
                    autoComplete="address-level2"
                  />
                </label>
                <label>
                  Province
                  <select
                    value={draft.province}
                    onChange={(event) => updateAddress(address, "province", event.target.value)}
                    autoComplete="address-level1"
                  >
                    {provinces.map((province) => (
                      <option key={province}>{province}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Code postal
                  <input
                    required
                    value={draft.postalCode}
                    onChange={(event) =>
                      updateAddress(address, "postalCode", event.target.value.toUpperCase())
                    }
                    autoComplete="postal-code"
                  />
                </label>
                <label className="consent-check">
                  <input
                    type="checkbox"
                    checked={draft.isDefault}
                    onChange={(event) => updateAddress(address, "isDefault", event.target.checked)}
                  />
                  <span>Adresse par défaut</span>
                </label>
              </div>
              <div className="admin-order-actions account-address-actions">
                <button
                  className="button button-dark button-sm"
                  disabled={pending !== null}
                  onClick={() => saveAddress(address)}
                >
                  <Save size={15} /> Enregistrer
                </button>
                <button
                  className="button button-danger button-sm"
                  disabled={pending !== null}
                  onClick={() => {
                    if (window.confirm(`Supprimer l’adresse « ${address.label} » ?`))
                      void run(`${address.id}-delete`, `/api/account/addresses/${address.id}`, "DELETE");
                  }}
                >
                  <Trash2 size={15} /> Supprimer
                </button>
              </div>
            </details>
          );
        })}

        <details className="account-address-card account-address-new">
          <summary>
            <Plus size={17} />
            <span>
              <strong>Ajouter une adresse</strong>
              <small>Canada uniquement pour le lancement</small>
            </span>
          </summary>
          <form className="admin-product-form account-address-form" onSubmit={addAddress}>
            <label>
              Nom de l’adresse
              <input
                required
                value={create.label}
                onChange={(event) => setCreate((current) => ({ ...current, label: event.target.value }))}
              />
            </label>
            <label>
              Prénom
              <input
                required
                value={create.firstName}
                onChange={(event) => setCreate((current) => ({ ...current, firstName: event.target.value }))}
                autoComplete="given-name"
              />
            </label>
            <label>
              Nom
              <input
                required
                value={create.lastName}
                onChange={(event) => setCreate((current) => ({ ...current, lastName: event.target.value }))}
                autoComplete="family-name"
              />
            </label>
            <label className="full">
              Adresse
              <input
                required
                value={create.addressLine1}
                onChange={(event) =>
                  setCreate((current) => ({ ...current, addressLine1: event.target.value }))
                }
                autoComplete="address-line1"
              />
            </label>
            <label className="full">
              Appartement, unité
              <input
                value={create.addressLine2}
                onChange={(event) =>
                  setCreate((current) => ({ ...current, addressLine2: event.target.value }))
                }
                autoComplete="address-line2"
              />
            </label>
            <label>
              Ville
              <input
                required
                value={create.city}
                onChange={(event) => setCreate((current) => ({ ...current, city: event.target.value }))}
                autoComplete="address-level2"
              />
            </label>
            <label>
              Province
              <select
                value={create.province}
                onChange={(event) => setCreate((current) => ({ ...current, province: event.target.value }))}
                autoComplete="address-level1"
              >
                {provinces.map((province) => (
                  <option key={province}>{province}</option>
                ))}
              </select>
            </label>
            <label>
              Code postal
              <input
                required
                value={create.postalCode}
                onChange={(event) =>
                  setCreate((current) => ({ ...current, postalCode: event.target.value.toUpperCase() }))
                }
                autoComplete="postal-code"
              />
            </label>
            <label className="consent-check">
              <input
                type="checkbox"
                checked={create.isDefault}
                onChange={(event) =>
                  setCreate((current) => ({ ...current, isDefault: event.target.checked }))
                }
              />
              <span>Adresse par défaut</span>
            </label>
            <button className="button button-outline button-sm" disabled={pending !== null} type="submit">
              <Plus size={15} /> Ajouter
            </button>
          </form>
        </details>
      </div>

      <div className="form-card account-privacy-card">
        <h3>Confidentialité</h3>
        <p className="muted">
          Gérez les témoins et téléchargez une copie des données reliées à votre compte.
        </p>
        <div className="button-row">
          <button
            className="button button-outline"
            onClick={() => window.dispatchEvent(new Event("avana:privacy"))}
          >
            Ouvrir les préférences
          </button>
          <Link className="button button-outline" href="/api/account/export" prefetch={false}>
            <Download size={15} /> Exporter mes données
          </Link>
        </div>
      </div>
    </div>
  );
}
