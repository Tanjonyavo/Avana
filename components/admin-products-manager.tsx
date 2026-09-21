"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, ImageUp, PackagePlus, Plus, Save, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import type { AdminProduct, AdminProductVariant } from "@/types/commerce";

type ProductDraft = Omit<AdminProduct, "id" | "variants" | "dataStatus"> & {
  category: "Gousses" | "Poudre" | "Coffret";
  dataStatus: "Réel" | "Hypothèse" | "Démo";
  usesText: string;
};

type VariantDraft = Pick<
  AdminProductVariant,
  "label" | "sku" | "priceCents" | "compareAtPriceCents" | "stockOnHand" | "weightGrams" | "active"
>;

interface NewVariantDraft {
  label: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  weight: string;
  active: boolean;
}

const emptyVariant = (): NewVariantDraft => ({
  label: "",
  sku: "",
  price: "",
  compareAtPrice: "",
  stock: "0",
  weight: "",
  active: false,
});

const initialCreate = {
  name: "",
  slug: "",
  category: "Gousses" as const,
  shortDescription: "",
  description: "",
  image: "/images/avana-still-life-v2.webp",
  origin: "Madagascar",
  region: "SAVA",
  species: "Vanilla planifolia",
  lotCode: "",
  status: "development" as const,
  featured: false,
  active: false,
  audience: ["B2C"] as Array<"B2C" | "Professionnels">,
  usesText: "Pâtisserie, cuisine",
  storage: "Conserver dans un endroit frais et sec, à l’abri de la lumière.",
  composition: "Vanille.",
  dataStatus: "Réel" as const,
  variantLabel: "",
  sku: "",
  price: "",
  compareAtPrice: "",
  stock: "0",
  weight: "",
  variantActive: false,
};

function productDraft(product: AdminProduct): ProductDraft {
  return {
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    description: product.description,
    category: product.category as ProductDraft["category"],
    image: product.image,
    origin: product.origin,
    region: product.region,
    species: product.species,
    lotCode: product.lotCode,
    status: product.status,
    featured: product.featured,
    active: product.active,
    dataStatus: product.dataStatus as ProductDraft["dataStatus"],
    audience: product.audience,
    uses: product.uses,
    usesText: product.uses.join(", "),
    storage: product.storage,
    composition: product.composition,
  };
}

function parseList(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function nullableCents(value: string) {
  return value.trim() ? Math.round(Number(value) * 100) : null;
}

export function AdminProductsManager({ products }: { products: AdminProduct[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [create, setCreate] = useState(initialCreate);
  const [productDrafts, setProductDrafts] = useState<Record<string, ProductDraft>>(() =>
    Object.fromEntries(products.map((product) => [product.id, productDraft(product)])),
  );
  const [variantDrafts, setVariantDrafts] = useState<Record<string, VariantDraft>>(() =>
    Object.fromEntries(
      products.flatMap((product) => product.variants.map((variant) => [variant.id, variant])),
    ),
  );
  const [newVariants, setNewVariants] = useState<Record<string, NewVariantDraft>>({});
  const activeCount = useMemo(() => products.filter((product) => product.active).length, [products]);

  const request = async (key: string, url: string, method: "POST" | "PATCH", body: unknown) => {
    setPending(key);
    setMessage("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Enregistrement impossible.");
      setMessage("Catalogue mis à jour.");
      router.refresh();
      return true;
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Enregistrement impossible.");
      return false;
    } finally {
      setPending(null);
    }
  };

  const uploadImage = async (key: string, file: File | undefined, onUploaded: (url: string) => void) => {
    if (!file) return;
    setPending(key);
    setMessage("");
    try {
      const body = new FormData();
      body.set("folder", "products");
      body.set("file", file);
      const response = await fetch("/api/admin/uploads", { method: "POST", body });
      const result = (await response.json()) as { error?: string; url?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Téléversement impossible.");
      onUploaded(result.url);
      setMessage("Image téléversée. Enregistrez le produit pour la publier.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Téléversement impossible.");
    } finally {
      setPending(null);
    }
  };

  const createProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await request("create", "/api/admin/products", "POST", {
      name: create.name,
      slug: create.slug,
      category: create.category,
      shortDescription: create.shortDescription,
      description: create.description,
      image: create.image,
      origin: create.origin,
      region: create.region,
      species: create.species,
      lotCode: create.lotCode,
      status: create.status,
      featured: create.featured,
      active: create.active,
      audience: create.audience,
      uses: parseList(create.usesText),
      storage: create.storage,
      composition: create.composition,
      dataStatus: create.dataStatus,
      variant: {
        label: create.variantLabel,
        sku: create.sku,
        priceCents: Math.round(Number(create.price) * 100),
        compareAtPriceCents: nullableCents(create.compareAtPrice),
        stockOnHand: Number(create.stock),
        weightGrams: Number(create.weight),
        active: create.variantActive,
      },
    });
    if (created) setCreate(initialCreate);
  };

  const setProductField = <Key extends keyof ProductDraft>(
    product: AdminProduct,
    key: Key,
    value: ProductDraft[Key],
  ) => {
    const current = productDrafts[product.id] || productDraft(product);
    setProductDrafts((drafts) => ({ ...drafts, [product.id]: { ...current, [key]: value } }));
  };

  const toggleProductAudience = (
    product: AdminProduct,
    audience: "B2C" | "Professionnels",
    checked: boolean,
  ) => {
    const current = productDrafts[product.id] || productDraft(product);
    const next = checked
      ? [...new Set([...current.audience, audience])]
      : current.audience.filter((item) => item !== audience);
    if (next.length) setProductField(product, "audience", next);
  };

  const saveProduct = (product: AdminProduct, draft: ProductDraft) =>
    request(product.id, `/api/admin/products/${encodeURIComponent(product.id)}`, "PATCH", {
      ...draft,
      uses: parseList(draft.usesText),
      usesText: undefined,
    });

  const createVariant = async (product: AdminProduct) => {
    const draft = newVariants[product.id] || emptyVariant();
    const created = await request(
      `${product.id}-new-variant`,
      `/api/admin/products/${encodeURIComponent(product.id)}/variants`,
      "POST",
      {
        label: draft.label,
        sku: draft.sku,
        priceCents: Math.round(Number(draft.price) * 100),
        compareAtPriceCents: nullableCents(draft.compareAtPrice),
        stockOnHand: Number(draft.stock),
        weightGrams: Number(draft.weight),
        active: draft.active,
      },
    );
    if (created) setNewVariants((current) => ({ ...current, [product.id]: emptyVariant() }));
  };

  return (
    <>
      <div className="admin-catalog-summary">
        <span>
          <strong>{products.length}</strong> produits
        </span>
        <span>
          <strong>{activeCount}</strong> publiés
        </span>
        <span>
          <strong>
            {products
              .flatMap((product) => product.variants)
              .reduce((sum, variant) => sum + variant.stockOnHand - variant.stockReserved, 0)}
          </strong>{" "}
          unités disponibles
        </span>
      </div>
      {message && (
        <p className="form-feedback admin-global-feedback" role="status">
          {message}
        </p>
      )}

      <details className="admin-create-panel">
        <summary>
          <PackagePlus size={17} /> Ajouter un produit
        </summary>
        <form className="admin-product-form" onSubmit={createProduct}>
          <label>
            Nom
            <input
              required
              value={create.name}
              onChange={(event) => setCreate((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label>
            Slug
            <input
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={create.slug}
              onChange={(event) =>
                setCreate((current) => ({ ...current, slug: event.target.value.toLowerCase() }))
              }
              placeholder="gousses-vanille"
            />
          </label>
          <label>
            Catégorie
            <select
              value={create.category}
              onChange={(event) =>
                setCreate((current) => ({
                  ...current,
                  category: event.target.value as typeof current.category,
                }))
              }
            >
              <option>Gousses</option>
              <option>Poudre</option>
              <option>Coffret</option>
            </select>
          </label>
          <label>
            Nature
            <select
              value={create.dataStatus}
              onChange={(event) =>
                setCreate((current) => ({
                  ...current,
                  dataStatus: event.target.value as typeof current.dataStatus,
                }))
              }
            >
              <option>Réel</option>
              <option>Hypothèse</option>
              <option>Démo</option>
            </select>
          </label>
          <label className="full">
            URL de l’image
            <input
              required
              value={create.image}
              onChange={(event) => setCreate((current) => ({ ...current, image: event.target.value }))}
            />
          </label>
          <label className="full">
            Téléverser une image
            <ImageUp size={15} />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              disabled={pending !== null}
              onChange={(event) =>
                void uploadImage("create-image", event.target.files?.[0], (url) =>
                  setCreate((current) => ({ ...current, image: url })),
                )
              }
            />
          </label>
          <label className="full">
            Description courte
            <textarea
              required
              value={create.shortDescription}
              onChange={(event) =>
                setCreate((current) => ({ ...current, shortDescription: event.target.value }))
              }
            />
          </label>
          <label className="full">
            Description complète
            <textarea
              required
              rows={5}
              value={create.description}
              onChange={(event) => setCreate((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <label>
            Origine
            <input
              required
              value={create.origin}
              onChange={(event) => setCreate((current) => ({ ...current, origin: event.target.value }))}
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
            Code lot
            <input
              required
              value={create.lotCode}
              onChange={(event) =>
                setCreate((current) => ({ ...current, lotCode: event.target.value.toUpperCase() }))
              }
            />
          </label>
          <label className="full">
            Usages, séparés par des virgules
            <input
              value={create.usesText}
              onChange={(event) => setCreate((current) => ({ ...current, usesText: event.target.value }))}
            />
          </label>
          <label className="full">
            Conservation
            <textarea
              required
              value={create.storage}
              onChange={(event) => setCreate((current) => ({ ...current, storage: event.target.value }))}
            />
          </label>
          <label className="full">
            Composition
            <textarea
              required
              value={create.composition}
              onChange={(event) => setCreate((current) => ({ ...current, composition: event.target.value }))}
            />
          </label>
          <label>
            Format initial
            <input
              required
              value={create.variantLabel}
              onChange={(event) => setCreate((current) => ({ ...current, variantLabel: event.target.value }))}
              placeholder="5 gousses"
            />
          </label>
          <label>
            SKU
            <input
              required
              value={create.sku}
              onChange={(event) =>
                setCreate((current) => ({ ...current, sku: event.target.value.toUpperCase() }))
              }
            />
          </label>
          <label>
            Prix CAD
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={create.price}
              onChange={(event) => setCreate((current) => ({ ...current, price: event.target.value }))}
            />
          </label>
          <label>
            Prix comparatif CAD
            <input
              type="number"
              min="0"
              step="0.01"
              value={create.compareAtPrice}
              onChange={(event) =>
                setCreate((current) => ({ ...current, compareAtPrice: event.target.value }))
              }
            />
          </label>
          <label>
            Stock physique
            <input
              required
              type="number"
              min="0"
              step="1"
              value={create.stock}
              onChange={(event) => setCreate((current) => ({ ...current, stock: event.target.value }))}
            />
          </label>
          <label>
            Poids en grammes
            <input
              required
              type="number"
              min="1"
              step="1"
              value={create.weight}
              onChange={(event) => setCreate((current) => ({ ...current, weight: event.target.value }))}
            />
          </label>
          <label>
            Statut
            <select
              value={create.status}
              onChange={(event) =>
                setCreate((current) => ({ ...current, status: event.target.value as typeof current.status }))
              }
            >
              <option value="development">Développement</option>
              <option value="waitlist">Liste d’attente</option>
              <option value="available">Disponible</option>
            </select>
          </label>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={create.audience.includes("B2C")}
              onChange={(event) =>
                setCreate((current) => ({
                  ...current,
                  audience: event.target.checked
                    ? [...new Set([...current.audience, "B2C" as const])]
                    : current.audience.filter((item) => item !== "B2C"),
                }))
              }
            />
            <span>B2C</span>
          </label>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={create.audience.includes("Professionnels")}
              onChange={(event) =>
                setCreate((current) => ({
                  ...current,
                  audience: event.target.checked
                    ? [...new Set([...current.audience, "Professionnels" as const])]
                    : current.audience.filter((item) => item !== "Professionnels"),
                }))
              }
            />
            <span>Professionnels</span>
          </label>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={create.featured}
              onChange={(event) => setCreate((current) => ({ ...current, featured: event.target.checked }))}
            />
            <span>Mettre en vedette</span>
          </label>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={create.active}
              onChange={(event) => setCreate((current) => ({ ...current, active: event.target.checked }))}
            />
            <span>Publier le produit</span>
          </label>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={create.variantActive}
              onChange={(event) =>
                setCreate((current) => ({ ...current, variantActive: event.target.checked }))
              }
            />
            <span>Activer le format</span>
          </label>
          <button
            className="button button-dark"
            disabled={pending !== null || create.audience.length === 0}
            type="submit"
          >
            <Sparkles size={16} /> Créer le produit
          </button>
        </form>
      </details>

      <div className="admin-products-stack">
        {products.map((product) => {
          const draft = productDrafts[product.id] || productDraft(product);
          const newVariant = newVariants[product.id] || emptyVariant();
          return (
            <article className="admin-product-card" key={product.id}>
              <header>
                <Image src={draft.image} alt="" width={72} height={72} />
                <div>
                  <span className="small muted">
                    {draft.category} · {draft.lotCode}
                  </span>
                  <h2>{draft.name}</h2>
                  <p>{draft.slug}</p>
                </div>
                <Link
                  className="icon-small-button"
                  href={`/boutique/${draft.slug}`}
                  aria-label={`Voir ${draft.name}`}
                >
                  <Eye size={16} />
                </Link>
              </header>

              <details className="admin-create-panel admin-edit-panel">
                <summary>Modifier la fiche produit</summary>
                <div className="admin-product-form">
                  <label>
                    Nom
                    <input
                      required
                      value={draft.name}
                      onChange={(event) => setProductField(product, "name", event.target.value)}
                    />
                  </label>
                  <label>
                    Slug
                    <input
                      required
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      value={draft.slug}
                      onChange={(event) => setProductField(product, "slug", event.target.value.toLowerCase())}
                    />
                  </label>
                  <label>
                    Catégorie
                    <select
                      value={draft.category}
                      onChange={(event) =>
                        setProductField(product, "category", event.target.value as ProductDraft["category"])
                      }
                    >
                      <option>Gousses</option>
                      <option>Poudre</option>
                      <option>Coffret</option>
                    </select>
                  </label>
                  <label>
                    Nature
                    <select
                      value={draft.dataStatus}
                      onChange={(event) =>
                        setProductField(
                          product,
                          "dataStatus",
                          event.target.value as ProductDraft["dataStatus"],
                        )
                      }
                    >
                      <option>Réel</option>
                      <option>Hypothèse</option>
                      <option>Démo</option>
                    </select>
                  </label>
                  <label className="full">
                    URL de l’image
                    <input
                      required
                      value={draft.image}
                      onChange={(event) => setProductField(product, "image", event.target.value)}
                    />
                  </label>
                  <label className="full">
                    Remplacer l’image
                    <ImageUp size={15} />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      disabled={pending !== null}
                      onChange={(event) =>
                        void uploadImage(`${product.id}-image`, event.target.files?.[0], (url) =>
                          setProductField(product, "image", url),
                        )
                      }
                    />
                  </label>
                  <label className="full">
                    Description courte
                    <textarea
                      required
                      value={draft.shortDescription}
                      onChange={(event) => setProductField(product, "shortDescription", event.target.value)}
                    />
                  </label>
                  <label className="full">
                    Description complète
                    <textarea
                      required
                      rows={5}
                      value={draft.description}
                      onChange={(event) => setProductField(product, "description", event.target.value)}
                    />
                  </label>
                  <label>
                    Origine
                    <input
                      required
                      value={draft.origin}
                      onChange={(event) => setProductField(product, "origin", event.target.value)}
                    />
                  </label>
                  <label>
                    Région
                    <input
                      required
                      value={draft.region}
                      onChange={(event) => setProductField(product, "region", event.target.value)}
                    />
                  </label>
                  <label>
                    Espèce
                    <input
                      required
                      value={draft.species}
                      onChange={(event) => setProductField(product, "species", event.target.value)}
                    />
                  </label>
                  <label>
                    Code lot
                    <input
                      required
                      value={draft.lotCode}
                      onChange={(event) =>
                        setProductField(product, "lotCode", event.target.value.toUpperCase())
                      }
                    />
                  </label>
                  <label className="full">
                    Usages, séparés par des virgules
                    <input
                      value={draft.usesText}
                      onChange={(event) => setProductField(product, "usesText", event.target.value)}
                    />
                  </label>
                  <label className="full">
                    Conservation
                    <textarea
                      required
                      value={draft.storage}
                      onChange={(event) => setProductField(product, "storage", event.target.value)}
                    />
                  </label>
                  <label className="full">
                    Composition
                    <textarea
                      required
                      value={draft.composition}
                      onChange={(event) => setProductField(product, "composition", event.target.value)}
                    />
                  </label>
                  <label>
                    Statut
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        setProductField(product, "status", event.target.value as AdminProduct["status"])
                      }
                    >
                      <option value="development">Développement</option>
                      <option value="waitlist">Liste d’attente</option>
                      <option value="available">Disponible</option>
                    </select>
                  </label>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={draft.audience.includes("B2C")}
                      onChange={(event) => toggleProductAudience(product, "B2C", event.target.checked)}
                    />
                    <span>B2C</span>
                  </label>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={draft.audience.includes("Professionnels")}
                      onChange={(event) =>
                        toggleProductAudience(product, "Professionnels", event.target.checked)
                      }
                    />
                    <span>Professionnels</span>
                  </label>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={draft.active}
                      onChange={(event) => setProductField(product, "active", event.target.checked)}
                    />
                    <span>Publié</span>
                  </label>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={draft.featured}
                      onChange={(event) => setProductField(product, "featured", event.target.checked)}
                    />
                    <span>Vedette</span>
                  </label>
                  <button
                    className="button button-dark button-sm"
                    disabled={pending !== null || draft.audience.length === 0}
                    onClick={() => void saveProduct(product, draft)}
                  >
                    <Save size={15} /> Enregistrer la fiche
                  </button>
                </div>
              </details>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Format</th>
                      <th>SKU</th>
                      <th>Prix</th>
                      <th>Comparatif</th>
                      <th>Stock</th>
                      <th>Réservé</th>
                      <th>Poids</th>
                      <th>Actif</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((variant) => {
                      const variantDraft = variantDrafts[variant.id] || variant;
                      return (
                        <tr key={variant.id}>
                          <td>
                            <input
                              value={variantDraft.label}
                              onChange={(event) =>
                                setVariantDrafts((current) => ({
                                  ...current,
                                  [variant.id]: { ...variantDraft, label: event.target.value },
                                }))
                              }
                              aria-label={`Format ${variant.sku}`}
                            />
                          </td>
                          <td>
                            <input
                              value={variantDraft.sku}
                              onChange={(event) =>
                                setVariantDrafts((current) => ({
                                  ...current,
                                  [variant.id]: { ...variantDraft, sku: event.target.value.toUpperCase() },
                                }))
                              }
                              aria-label={`SKU ${variant.label}`}
                            />
                          </td>
                          <td>
                            <input
                              className="admin-number-input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={(variantDraft.priceCents / 100).toFixed(2)}
                              onChange={(event) =>
                                setVariantDrafts((current) => ({
                                  ...current,
                                  [variant.id]: {
                                    ...variantDraft,
                                    priceCents: Math.round(Number(event.target.value) * 100),
                                  },
                                }))
                              }
                            />
                            <small>{formatCurrency(variant.priceCents / 100)}</small>
                          </td>
                          <td>
                            <input
                              className="admin-number-input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                variantDraft.compareAtPriceCents === null
                                  ? ""
                                  : (variantDraft.compareAtPriceCents / 100).toFixed(2)
                              }
                              onChange={(event) =>
                                setVariantDrafts((current) => ({
                                  ...current,
                                  [variant.id]: {
                                    ...variantDraft,
                                    compareAtPriceCents: nullableCents(event.target.value),
                                  },
                                }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="admin-number-input"
                              type="number"
                              min={variant.stockReserved}
                              step="1"
                              value={variantDraft.stockOnHand}
                              onChange={(event) =>
                                setVariantDrafts((current) => ({
                                  ...current,
                                  [variant.id]: { ...variantDraft, stockOnHand: Number(event.target.value) },
                                }))
                              }
                            />
                          </td>
                          <td>{variant.stockReserved}</td>
                          <td>
                            <input
                              className="admin-number-input"
                              type="number"
                              min="1"
                              step="1"
                              value={variantDraft.weightGrams}
                              onChange={(event) =>
                                setVariantDrafts((current) => ({
                                  ...current,
                                  [variant.id]: { ...variantDraft, weightGrams: Number(event.target.value) },
                                }))
                              }
                            />{" "}
                            g
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={variantDraft.active}
                              onChange={(event) =>
                                setVariantDrafts((current) => ({
                                  ...current,
                                  [variant.id]: { ...variantDraft, active: event.target.checked },
                                }))
                              }
                              aria-label={`Activer ${variant.label}`}
                            />
                          </td>
                          <td>
                            <button
                              className="icon-small-button"
                              disabled={pending !== null}
                              onClick={() =>
                                void request(
                                  variant.id,
                                  `/api/admin/variants/${encodeURIComponent(variant.id)}`,
                                  "PATCH",
                                  variantDraft,
                                )
                              }
                              aria-label={`Enregistrer ${variant.label}`}
                            >
                              <Save size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <details className="admin-create-panel admin-variant-panel">
                <summary>
                  <Plus size={15} /> Ajouter un format
                </summary>
                <div className="admin-product-form">
                  <label>
                    Format
                    <input
                      required
                      value={newVariant.label}
                      onChange={(event) =>
                        setNewVariants((current) => ({
                          ...current,
                          [product.id]: { ...newVariant, label: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    SKU
                    <input
                      required
                      value={newVariant.sku}
                      onChange={(event) =>
                        setNewVariants((current) => ({
                          ...current,
                          [product.id]: { ...newVariant, sku: event.target.value.toUpperCase() },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Prix CAD
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={newVariant.price}
                      onChange={(event) =>
                        setNewVariants((current) => ({
                          ...current,
                          [product.id]: { ...newVariant, price: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Prix comparatif CAD
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newVariant.compareAtPrice}
                      onChange={(event) =>
                        setNewVariants((current) => ({
                          ...current,
                          [product.id]: { ...newVariant, compareAtPrice: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Stock
                    <input
                      required
                      type="number"
                      min="0"
                      step="1"
                      value={newVariant.stock}
                      onChange={(event) =>
                        setNewVariants((current) => ({
                          ...current,
                          [product.id]: { ...newVariant, stock: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Poids en grammes
                    <input
                      required
                      type="number"
                      min="1"
                      step="1"
                      value={newVariant.weight}
                      onChange={(event) =>
                        setNewVariants((current) => ({
                          ...current,
                          [product.id]: { ...newVariant, weight: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={newVariant.active}
                      onChange={(event) =>
                        setNewVariants((current) => ({
                          ...current,
                          [product.id]: { ...newVariant, active: event.target.checked },
                        }))
                      }
                    />
                    <span>Activer le format</span>
                  </label>
                  <button
                    className="button button-outline button-sm"
                    disabled={pending !== null}
                    onClick={() => void createVariant(product)}
                  >
                    <Plus size={15} /> Ajouter
                  </button>
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </>
  );
}
