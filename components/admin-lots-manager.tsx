"use client";

import Link from "next/link";
import { Archive, Eye, Plus, Save, Tags, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LotQrDownload } from "@/components/lot-qr-download";
import type { Lot, TraceabilityEvent } from "@/types";

type LotDraft = Required<Omit<Lot, "humidityPercent" | "averageLengthMm">> & {
  humidityPercent: number | null;
  averageLengthMm: number | null;
};

const emptyLot: LotDraft = {
  id: "",
  code: "",
  country: "Madagascar",
  region: "SAVA",
  species: "Vanilla planifolia",
  grade: "",
  harvestYear: "",
  quantityKg: 0,
  availableKg: 0,
  status: "Contrôle",
  publicTraceabilityEnabled: false,
  dataStatus: "Réel",
  events: [],
  supplierName: "",
  importDate: "",
  receptionDate: "",
  humidityPercent: null,
  averageLengthMm: null,
  publicSummary: "",
  publicDocuments: [],
  notes: "",
};

function normalizeLot(lot: Lot): LotDraft {
  return {
    ...emptyLot,
    ...lot,
    supplierName: lot.supplierName || "",
    importDate: lot.importDate || "",
    receptionDate: lot.receptionDate || "",
    humidityPercent: lot.humidityPercent ?? null,
    averageLengthMm: lot.averageLengthMm ?? null,
    publicSummary: lot.publicSummary || "",
    publicDocuments: lot.publicDocuments || [],
    notes: lot.notes || "",
  };
}

const newEvent = (): TraceabilityEvent => ({
  label: "",
  location: "",
  date: "À venir",
  status: "upcoming",
  description: "",
});

export function AdminLotsManager({ lots }: { lots: Lot[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, LotDraft>>(() =>
    Object.fromEntries(lots.map((lot) => [lot.id, normalizeLot(lot)])),
  );
  const [create, setCreate] = useState<LotDraft>(emptyLot);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const request = async (key: string, url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => {
    setPending(key);
    setMessage("");
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Action impossible.");
      setMessage("Traçabilité mise à jour.");
      router.refresh();
      return true;
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Action impossible.");
      return false;
    } finally {
      setPending(null);
    }
  };

  const setDraft = <Key extends keyof LotDraft>(id: string, field: Key, value: LotDraft[Key]) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  };

  const updateEvent = (id: string, index: number, field: keyof TraceabilityEvent, value: string) => {
    const events = drafts[id].events.map((event, eventIndex) =>
      eventIndex === index ? { ...event, [field]: value } : event,
    );
    setDraft(id, "events", events);
  };

  const payload = (draft: LotDraft) => ({
    country: draft.country,
    region: draft.region,
    species: draft.species,
    grade: draft.grade,
    harvestYear: draft.harvestYear,
    quantityKg: Number(draft.quantityKg),
    availableKg: Number(draft.availableKg),
    status: draft.status,
    publicTraceabilityEnabled: draft.publicTraceabilityEnabled,
    dataStatus: draft.dataStatus,
    supplierName: draft.supplierName,
    importDate: draft.importDate,
    receptionDate: draft.receptionDate,
    humidityPercent: draft.humidityPercent === null ? null : Number(draft.humidityPercent),
    averageLengthMm: draft.averageLengthMm === null ? null : Number(draft.averageLengthMm),
    publicSummary: draft.publicSummary,
    publicDocuments: draft.publicDocuments,
    notes: draft.notes,
    events: draft.events,
  });

  const createLot = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await request("create", "/api/admin/lots", "POST", {
      code: create.code,
      ...payload(create),
    });
    if (created) setCreate(emptyLot);
  };

  const uploadDocument = async (lotId: string, index: number, file: File | undefined) => {
    if (!file) return;
    setPending(`${lotId}-document-${index}`);
    setMessage("");
    try {
      const body = new FormData();
      body.set("folder", "public-documents");
      body.set("file", file);
      const response = await fetch("/api/admin/uploads", { method: "POST", body });
      const result = (await response.json()) as { error?: string; url?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Téléversement impossible.");
      setDrafts((current) => {
        const draft = current[lotId];
        if (!draft) return current;
        const documents = draft.publicDocuments.map((document, documentIndex) =>
          documentIndex === index
            ? {
                ...document,
                label: document.label || file.name.replace(/\.[^.]+$/, ""),
                url: result.url || "",
              }
            : document,
        );
        return { ...current, [lotId]: { ...draft, publicDocuments: documents } };
      });
      setMessage("Document téléversé. Enregistrez le lot pour le publier.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Téléversement impossible.");
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <div className="admin-catalog-summary">
        <span>
          <strong>{lots.length}</strong> lots
        </span>
        <span>
          <strong>{lots.filter((lot) => lot.status === "Disponible").length}</strong> disponibles
        </span>
        <span>
          <strong>{lots.filter((lot) => lot.publicTraceabilityEnabled).length}</strong> fiches publiques
        </span>
        <Link className="button button-outline button-sm" href="/api/admin/lots/export" prefetch={false}>
          Exporter CSV
        </Link>
      </div>
      {message && (
        <p className="form-feedback admin-global-feedback" role="status">
          {message}
        </p>
      )}

      <details className="admin-create-panel">
        <summary>
          <Plus size={17} /> Créer un lot
        </summary>
        <form className="admin-product-form" onSubmit={createLot}>
          <label>
            Code
            <input
              required
              pattern="[A-Z0-9]+(?:-[A-Z0-9]+)*"
              value={create.code}
              onChange={(event) =>
                setCreate((current) => ({ ...current, code: event.target.value.toUpperCase() }))
              }
              placeholder="MG-SAVA-2027-001"
            />
          </label>
          <label>
            Pays
            <input
              required
              value={create.country}
              onChange={(event) => setCreate((current) => ({ ...current, country: event.target.value }))}
            />
          </label>
          <label>
            Région
            <input
              required
              value={create.region}
              onChange={(event) => setCreate((current) => ({ ...current, region: event.target.value }))}
            />
          </label>
          <label>
            Espèce
            <input
              required
              value={create.species}
              onChange={(event) => setCreate((current) => ({ ...current, species: event.target.value }))}
            />
          </label>
          <label>
            Grade
            <input
              required
              value={create.grade}
              onChange={(event) => setCreate((current) => ({ ...current, grade: event.target.value }))}
            />
          </label>
          <label>
            Récolte
            <input
              required
              value={create.harvestYear}
              onChange={(event) => setCreate((current) => ({ ...current, harvestYear: event.target.value }))}
              placeholder="2027"
            />
          </label>
          <label>
            Quantité initiale (kg)
            <input
              required
              type="number"
              min="0"
              step="0.001"
              value={create.quantityKg}
              onChange={(event) =>
                setCreate((current) => ({ ...current, quantityKg: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            Disponible (kg)
            <input
              required
              type="number"
              min="0"
              step="0.001"
              value={create.availableKg}
              onChange={(event) =>
                setCreate((current) => ({ ...current, availableKg: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            Statut
            <select
              value={create.status}
              onChange={(event) =>
                setCreate((current) => ({ ...current, status: event.target.value as Lot["status"] }))
              }
            >
              <option>Contrôle</option>
              <option>Disponible</option>
              <option>Archivé</option>
            </select>
          </label>
          <label>
            Nature des données
            <select
              value={create.dataStatus}
              onChange={(event) =>
                setCreate((current) => ({ ...current, dataStatus: event.target.value as Lot["dataStatus"] }))
              }
            >
              <option>Réel</option>
              <option>Hypothèse</option>
              <option>Démo</option>
            </select>
          </label>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={create.publicTraceabilityEnabled}
              onChange={(event) =>
                setCreate((current) => ({ ...current, publicTraceabilityEnabled: event.target.checked }))
              }
            />
            <span>Publier la fiche de traçabilité</span>
          </label>
          <button className="button button-dark" disabled={pending !== null} type="submit">
            <Tags size={16} /> Créer le lot
          </button>
        </form>
      </details>

      <div className="admin-products-stack">
        {lots.map((lot) => {
          const draft = drafts[lot.id] || normalizeLot(lot);
          return (
            <article className="admin-product-card admin-lot-card" id={`lot-${lot.code}`} key={lot.id}>
              <header>
                <div className="feature-list-icon">
                  <Tags size={20} />
                </div>
                <div>
                  <span className="small muted">
                    {lot.country} · {lot.region}
                  </span>
                  <h2>{lot.code}</h2>
                  <p>{lot.species}</p>
                </div>
                {lot.publicTraceabilityEnabled && (
                  <Link
                    className="icon-small-button"
                    href={`/tracabilite/${encodeURIComponent(lot.code)}`}
                    aria-label={`Voir ${lot.code}`}
                  >
                    <Eye size={16} />
                  </Link>
                )}
              </header>

              <div className="admin-lot-layout">
                <div className="admin-product-form admin-lot-form">
                  <label>
                    Pays
                    <input
                      value={draft.country}
                      onChange={(event) => setDraft(lot.id, "country", event.target.value)}
                    />
                  </label>
                  <label>
                    Région
                    <input
                      value={draft.region}
                      onChange={(event) => setDraft(lot.id, "region", event.target.value)}
                    />
                  </label>
                  <label>
                    Espèce
                    <input
                      value={draft.species}
                      onChange={(event) => setDraft(lot.id, "species", event.target.value)}
                    />
                  </label>
                  <label>
                    Grade
                    <input
                      value={draft.grade}
                      onChange={(event) => setDraft(lot.id, "grade", event.target.value)}
                    />
                  </label>
                  <label>
                    Récolte
                    <input
                      value={draft.harvestYear}
                      onChange={(event) => setDraft(lot.id, "harvestYear", event.target.value)}
                    />
                  </label>
                  <label>
                    Fournisseur interne
                    <input
                      value={draft.supplierName}
                      onChange={(event) => setDraft(lot.id, "supplierName", event.target.value)}
                    />
                  </label>
                  <label>
                    Importation
                    <input
                      type="date"
                      value={draft.importDate}
                      onChange={(event) => setDraft(lot.id, "importDate", event.target.value)}
                    />
                  </label>
                  <label>
                    Réception
                    <input
                      type="date"
                      value={draft.receptionDate}
                      onChange={(event) => setDraft(lot.id, "receptionDate", event.target.value)}
                    />
                  </label>
                  <label>
                    Quantité initiale (kg)
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={draft.quantityKg}
                      onChange={(event) => setDraft(lot.id, "quantityKg", Number(event.target.value))}
                    />
                  </label>
                  <label>
                    Disponible (kg)
                    <input
                      type="number"
                      min="0"
                      max={draft.quantityKg}
                      step="0.001"
                      value={draft.availableKg}
                      onChange={(event) => setDraft(lot.id, "availableKg", Number(event.target.value))}
                    />
                  </label>
                  <label>
                    Humidité (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={draft.humidityPercent ?? ""}
                      onChange={(event) =>
                        setDraft(
                          lot.id,
                          "humidityPercent",
                          event.target.value ? Number(event.target.value) : null,
                        )
                      }
                    />
                  </label>
                  <label>
                    Longueur moyenne (mm)
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={draft.averageLengthMm ?? ""}
                      onChange={(event) =>
                        setDraft(
                          lot.id,
                          "averageLengthMm",
                          event.target.value ? Number(event.target.value) : null,
                        )
                      }
                    />
                  </label>
                  <label>
                    Statut
                    <select
                      value={draft.status}
                      onChange={(event) => setDraft(lot.id, "status", event.target.value as Lot["status"])}
                    >
                      <option>Contrôle</option>
                      <option>Disponible</option>
                      <option>Archivé</option>
                    </select>
                  </label>
                  <label>
                    Nature
                    <select
                      value={draft.dataStatus}
                      onChange={(event) =>
                        setDraft(lot.id, "dataStatus", event.target.value as Lot["dataStatus"])
                      }
                    >
                      <option>Réel</option>
                      <option>Hypothèse</option>
                      <option>Démo</option>
                    </select>
                  </label>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={draft.publicTraceabilityEnabled}
                      onChange={(event) =>
                        setDraft(lot.id, "publicTraceabilityEnabled", event.target.checked)
                      }
                    />
                    <span>Fiche publique active</span>
                  </label>
                  <label className="full">
                    Résumé public
                    <textarea
                      rows={3}
                      value={draft.publicSummary}
                      onChange={(event) => setDraft(lot.id, "publicSummary", event.target.value)}
                    />
                  </label>
                  <label className="full">
                    Notes internes
                    <textarea
                      rows={3}
                      value={draft.notes}
                      onChange={(event) => setDraft(lot.id, "notes", event.target.value)}
                    />
                  </label>
                </div>
                <LotQrDownload code={lot.code} />
              </div>

              <details className="admin-action-details admin-trace-events" open>
                <summary>Étapes publiques ({draft.events.length})</summary>
                <div className="admin-event-stack">
                  {draft.events.map((traceEvent, index) => (
                    <div className="admin-event-row" key={`${lot.id}-${index}`}>
                      <input
                        aria-label="Étape"
                        placeholder="Étape"
                        value={traceEvent.label}
                        onChange={(event) => updateEvent(lot.id, index, "label", event.target.value)}
                      />
                      <input
                        aria-label="Lieu"
                        placeholder="Lieu"
                        value={traceEvent.location}
                        onChange={(event) => updateEvent(lot.id, index, "location", event.target.value)}
                      />
                      <input
                        aria-label="Date"
                        placeholder="AAAA-MM-JJ ou À venir"
                        value={traceEvent.date}
                        onChange={(event) => updateEvent(lot.id, index, "date", event.target.value)}
                      />
                      <select
                        aria-label="Statut"
                        value={traceEvent.status}
                        onChange={(event) => updateEvent(lot.id, index, "status", event.target.value)}
                      >
                        <option value="complete">Terminée</option>
                        <option value="current">En cours</option>
                        <option value="upcoming">À venir</option>
                      </select>
                      <textarea
                        aria-label="Description"
                        placeholder="Description publique"
                        value={traceEvent.description}
                        onChange={(event) => updateEvent(lot.id, index, "description", event.target.value)}
                      />
                      <button
                        className="icon-small-button"
                        type="button"
                        aria-label="Retirer l’étape"
                        onClick={() =>
                          setDraft(
                            lot.id,
                            "events",
                            draft.events.filter((_, eventIndex) => eventIndex !== index),
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="button button-outline button-sm"
                    type="button"
                    onClick={() => setDraft(lot.id, "events", [...draft.events, newEvent()])}
                  >
                    <Plus size={15} /> Ajouter une étape
                  </button>
                </div>
              </details>

              <details className="admin-action-details admin-trace-events">
                <summary>Documents publics ({draft.publicDocuments.length})</summary>
                <div className="admin-event-stack">
                  {draft.publicDocuments.map((document, index) => (
                    <div className="admin-document-row" key={`${lot.id}-document-${index}`}>
                      <input
                        aria-label="Nom du document"
                        placeholder="Fiche technique"
                        value={document.label}
                        onChange={(event) =>
                          setDraft(
                            lot.id,
                            "publicDocuments",
                            draft.publicDocuments.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, label: event.target.value } : item,
                            ),
                          )
                        }
                      />
                      <input
                        aria-label="Lien du document"
                        placeholder="/documents/fiche.pdf"
                        value={document.url}
                        onChange={(event) =>
                          setDraft(
                            lot.id,
                            "publicDocuments",
                            draft.publicDocuments.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, url: event.target.value } : item,
                            ),
                          )
                        }
                      />
                      <input
                        aria-label="Date du document"
                        type="date"
                        value={document.date || ""}
                        onChange={(event) =>
                          setDraft(
                            lot.id,
                            "publicDocuments",
                            draft.publicDocuments.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, date: event.target.value } : item,
                            ),
                          )
                        }
                      />
                      <label className="icon-small-button" aria-label="Téléverser le document">
                        <Upload size={15} />
                        <input
                          className="sr-only"
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,image/webp,image/avif"
                          disabled={pending !== null}
                          onChange={(event) => void uploadDocument(lot.id, index, event.target.files?.[0])}
                        />
                      </label>
                      <button
                        className="icon-small-button"
                        type="button"
                        aria-label="Retirer le document"
                        onClick={() =>
                          setDraft(
                            lot.id,
                            "publicDocuments",
                            draft.publicDocuments.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="button button-outline button-sm"
                    type="button"
                    onClick={() =>
                      setDraft(lot.id, "publicDocuments", [
                        ...draft.publicDocuments,
                        { label: "", url: "", date: "" },
                      ])
                    }
                  >
                    <Plus size={15} /> Ajouter un document
                  </button>
                </div>
              </details>

              <div className="admin-order-actions">
                <button
                  className="button button-dark button-sm"
                  disabled={pending !== null}
                  type="button"
                  onClick={() =>
                    void request(
                      lot.id,
                      `/api/admin/lots/${encodeURIComponent(lot.id)}`,
                      "PATCH",
                      payload(draft),
                    )
                  }
                >
                  <Save size={15} /> Enregistrer
                </button>
                {lot.status !== "Archivé" && (
                  <button
                    className="button button-danger button-sm"
                    disabled={pending !== null}
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Archiver le lot ${lot.code} ?`))
                        void request(
                          `${lot.id}-archive`,
                          `/api/admin/lots/${encodeURIComponent(lot.id)}`,
                          "DELETE",
                        );
                    }}
                  >
                    <Archive size={15} /> Archiver
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
