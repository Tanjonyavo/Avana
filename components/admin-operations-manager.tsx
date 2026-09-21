"use client";

import Link from "next/link";
import { AlertTriangle, Archive, Download, FileText, Plus, Save, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  operationModules,
  type OperationalRecord,
  type OperationField,
  type OperationModule,
  type OperationValue,
  type RecallImpact,
} from "@/lib/operations";
import { formatCurrency, formatDate } from "@/lib/utils";

interface OperationDraft {
  title: string;
  status: string;
  data: Record<string, OperationValue>;
}

function emptyDraft(module: OperationModule): OperationDraft {
  const config = operationModules[module];
  return {
    title: "",
    status: config.statuses[0],
    data: Object.fromEntries(
      config.fields.map((field) => [
        field.key,
        field.type === "boolean" ? false : field.type === "number" ? null : "",
      ]),
    ),
  };
}

function fromRecord(record: OperationalRecord): OperationDraft {
  return { title: record.title, status: record.status, data: record.data };
}

function numberValue(data: Record<string, OperationValue>, key: string) {
  const value = Number(data[key]);
  return Number.isFinite(value) ? value : 0;
}

function ImportCostSummary({ data }: { data: Record<string, OperationValue> }) {
  const total = [
    "goodsCostCad",
    "transportCostCad",
    "insuranceCostCad",
    "dutiesCostCad",
    "taxCostCad",
    "otherCostCad",
  ].reduce((sum, key) => sum + numberValue(data, key), 0);
  const kilograms = numberValue(data, "quantityKg");
  const units = numberValue(data, "sellableUnits");
  return (
    <div className="operation-metrics">
      <span>
        <small>Coût rendu</small>
        <strong>{formatCurrency(total)}</strong>
      </span>
      <span>
        <small>Par kg</small>
        <strong>{kilograms > 0 ? formatCurrency(total / kilograms) : "—"}</strong>
      </span>
      <span>
        <small>Par unité vendable</small>
        <strong>{units > 0 ? formatCurrency(total / units) : "—"}</strong>
      </span>
    </div>
  );
}

function RecallImpactSummary({ impact, lotCode }: { impact?: RecallImpact; lotCode: string }) {
  if (!lotCode) return <p className="form-notice">Ajoutez un code de lot pour calculer l’impact.</p>;
  if (!impact)
    return <p className="form-notice">Impact indisponible. Vérifiez la migration et les commandes.</p>;
  return (
    <div className="recall-impact">
      <div className="operation-metrics">
        <span>
          <small>Unités concernées</small>
          <strong>{impact.affectedUnits}</strong>
        </span>
        <span>
          <small>Commandes concernées</small>
          <strong>{impact.affectedOrders}</strong>
        </span>
        <span>
          <small>Clients concernés</small>
          <strong>{impact.affectedCustomers}</strong>
        </span>
      </div>
      {impact.customers.length > 0 && (
        <details>
          <summary>Afficher les clients et commandes concernés</summary>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Courriel</th>
                  <th>Commandes</th>
                  <th>Unités</th>
                </tr>
              </thead>
              <tbody>
                {impact.customers.map((customer) => (
                  <tr key={customer.email}>
                    <td>{customer.name}</td>
                    <td>{customer.email}</td>
                    <td>{customer.orderNumbers.join(", ")}</td>
                    <td>{customer.units}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <p className="small muted">Calculé depuis l’historique des commandes payées associées à ce lot.</p>
    </div>
  );
}

export function AdminOperationsManager({
  module,
  records,
  recallImpacts = {},
}: {
  module: OperationModule;
  records: OperationalRecord[];
  recallImpacts?: Record<string, RecallImpact>;
}) {
  const router = useRouter();
  const config = operationModules[module];
  const [create, setCreate] = useState<OperationDraft>(() => emptyDraft(module));
  const [drafts, setDrafts] = useState<Record<string, OperationDraft>>(() =>
    Object.fromEntries(records.map((record) => [record.id, fromRecord(record)])),
  );
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
      setMessage("Dossier enregistré.");
      router.refresh();
      return true;
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Action impossible.");
      return false;
    } finally {
      setPending(null);
    }
  };

  const updateCreateData = (key: string, value: OperationValue) => {
    setCreate((current) => ({ ...current, data: { ...current.data, [key]: value } }));
  };

  const updateRecord = (
    record: OperationalRecord,
    field: keyof Omit<OperationDraft, "data">,
    value: string,
  ) => {
    const current = drafts[record.id] || fromRecord(record);
    setDrafts((items) => ({ ...items, [record.id]: { ...current, [field]: value } }));
  };

  const updateRecordData = (record: OperationalRecord, key: string, value: OperationValue) => {
    const current = drafts[record.id] || fromRecord(record);
    setDrafts((items) => ({
      ...items,
      [record.id]: { ...current, data: { ...current.data, [key]: value } },
    }));
  };

  const uploadDocument = async (
    target: "create" | OperationalRecord,
    field: OperationField,
    file: File | undefined,
  ) => {
    if (!file) return;
    const key = target === "create" ? `create-${field.key}` : `${target.id}-${field.key}`;
    setPending(key);
    setMessage("");
    try {
      const body = new FormData();
      body.set("folder", "internal-documents");
      body.set("file", file);
      const response = await fetch("/api/admin/uploads", { method: "POST", body });
      const result = (await response.json()) as { error?: string; url?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Téléversement impossible.");
      if (target === "create") updateCreateData(field.key, result.url);
      else updateRecordData(target, field.key, result.url);
      setMessage("Fichier privé téléversé. Enregistrez le dossier.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Téléversement impossible.");
    } finally {
      setPending(null);
    }
  };

  const createRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await request("create", `/api/admin/operations/${module}`, "POST", create);
    if (created) setCreate(emptyDraft(module));
  };

  const renderField = (
    field: OperationField,
    value: OperationValue | undefined,
    onChange: (value: OperationValue) => void,
    uploadTarget: "create" | OperationalRecord,
  ) => {
    if (field.type === "boolean") {
      return (
        <label className="consent-check" key={field.key}>
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      );
    }
    if (field.type === "textarea") {
      return (
        <label className="full" key={field.key}>
          {field.label}
          <textarea
            required={field.required}
            rows={3}
            value={String(value ?? "")}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
          />
        </label>
      );
    }
    if (field.type === "file") {
      return (
        <div className="full operation-file-field" key={field.key}>
          <label>
            {field.label}
            <input
              type="text"
              value={String(value ?? "")}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Téléversez un fichier privé"
            />
          </label>
          <label className="button button-outline button-sm">
            <Upload size={15} /> Téléverser
            <input
              className="sr-only"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/avif"
              disabled={pending !== null}
              onChange={(event) => void uploadDocument(uploadTarget, field, event.target.files?.[0])}
            />
          </label>
          {typeof value === "string" && value.startsWith("/api/admin/files/") && (
            <Link className="text-link small" href={value} target="_blank">
              Ouvrir le fichier
            </Link>
          )}
        </div>
      );
    }
    const type = field.type === "number" ? "number" : field.type;
    return (
      <label key={field.key}>
        {field.label}
        {field.suffix ? ` (${field.suffix})` : ""}
        <input
          type={type}
          required={field.required}
          min={field.type === "number" ? 0 : undefined}
          step={field.type === "number" ? "any" : undefined}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(event) =>
            onChange(
              field.type === "number"
                ? event.target.value === ""
                  ? null
                  : Number(event.target.value)
                : event.target.value,
            )
          }
          placeholder={field.placeholder}
        />
      </label>
    );
  };

  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">{config.eyebrow}</span>
          <h1>{config.title}</h1>
        </div>
        <div className="admin-actions">
          <span className="presentation-badge">Données serveur</span>
          <Link
            className="button button-outline button-sm"
            href={`/api/admin/operations/${module}/export`}
            prefetch={false}
          >
            <Download size={15} /> Exporter CSV
          </Link>
        </div>
      </div>
      <section className="chart-card admin-module-intro">
        <FileText size={22} />
        <div>
          <h2>Registre opérationnel</h2>
          <p>{config.description}</p>
        </div>
      </section>
      {module === "conformite" && (
        <div className="form-notice operation-warning">
          <AlertTriangle size={18} />
          <span>
            Outil documentaire seulement : une validation réglementaire externe demeure requise avant
            impression ou vente.
          </span>
        </div>
      )}
      {module === "rappels" && (
        <div className="form-notice operation-warning">
          <AlertTriangle size={18} />
          <span>
            Aucune notification client n’est envoyée automatiquement. Faites valider la procédure et les
            communications avant toute action.
          </span>
        </div>
      )}
      {message && (
        <p className="form-feedback admin-global-feedback" role="status">
          {message}
        </p>
      )}

      <details className="admin-create-panel">
        <summary>
          <Plus size={17} /> Ajouter un dossier
        </summary>
        <form className="admin-product-form" onSubmit={createRecord}>
          <label>
            {config.titleLabel}
            <input
              required
              value={create.title}
              onChange={(event) => setCreate((current) => ({ ...current, title: event.target.value }))}
            />
          </label>
          <label>
            Statut
            <select
              value={create.status}
              onChange={(event) => setCreate((current) => ({ ...current, status: event.target.value }))}
            >
              {config.statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          {config.fields.map((field) =>
            renderField(
              field,
              create.data[field.key],
              (value) => updateCreateData(field.key, value),
              "create",
            ),
          )}
          <button className="button button-dark" disabled={pending !== null} type="submit">
            <Plus size={15} /> Créer le dossier
          </button>
        </form>
      </details>

      <div className="admin-products-stack operations-stack">
        {!records.length && (
          <div className="empty-state admin-empty">
            <div>
              <FileText size={34} />
              <h2>Aucun dossier.</h2>
              <p>Créez le premier dossier avec le formulaire ci-dessus.</p>
            </div>
          </div>
        )}
        {records.map((record) => {
          const draft = drafts[record.id] || fromRecord(record);
          return (
            <article className="admin-product-card operation-card" key={record.id}>
              <header>
                <div className="feature-list-icon">
                  <FileText size={19} />
                </div>
                <div>
                  <span className="small muted">Mis à jour le {formatDate(record.updatedAt)}</span>
                  <h2>{draft.title}</h2>
                  <p>{draft.status}</p>
                </div>
              </header>
              {module === "importations" && <ImportCostSummary data={draft.data} />}
              {module === "rappels" && (
                <RecallImpactSummary
                  impact={recallImpacts[record.id]}
                  lotCode={typeof draft.data.lotCode === "string" ? draft.data.lotCode : ""}
                />
              )}
              <div className="admin-product-form">
                <label>
                  {config.titleLabel}
                  <input
                    required
                    value={draft.title}
                    onChange={(event) => updateRecord(record, "title", event.target.value)}
                  />
                </label>
                <label>
                  Statut
                  <select
                    value={draft.status}
                    onChange={(event) => updateRecord(record, "status", event.target.value)}
                  >
                    {config.statuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                {config.fields.map((field) =>
                  renderField(
                    field,
                    draft.data[field.key],
                    (value) => updateRecordData(record, field.key, value),
                    record,
                  ),
                )}
              </div>
              <div className="admin-order-actions">
                <button
                  className="button button-dark button-sm"
                  disabled={pending !== null}
                  onClick={() =>
                    void request(record.id, `/api/admin/operations/${module}/${record.id}`, "PATCH", draft)
                  }
                >
                  <Save size={15} /> Enregistrer
                </button>
                <button
                  className="button button-danger button-sm"
                  disabled={pending !== null}
                  onClick={() => {
                    if (window.confirm(`Archiver « ${record.title} » ?`))
                      void request(
                        `${record.id}-archive`,
                        `/api/admin/operations/${module}/${record.id}`,
                        "DELETE",
                      );
                  }}
                >
                  <Archive size={15} /> Archiver
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
