"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useApp } from "@/components/app-providers";
import { getDetailedCart } from "@/lib/catalog";
import { calculateOrderTotals } from "@/lib/commerce";
import { writeStorage, readStorage } from "@/lib/storage";
import { checkoutContactSchema, storedOrderSchema, type StoredOrder } from "@/lib/validation";
import { formatCurrency } from "@/lib/utils";
import type { CheckoutResponse, ShippingMethod } from "@/types/commerce";
import { trackEvent } from "@/lib/analytics-client";

const ordersSchema = storedOrderSchema.array().max(100);
const stepNames = ["Coordonnées", "Livraison", "Paiement"];

interface CheckoutForm {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  marketingConsent: boolean;
}

type FormErrors = Partial<Record<keyof CheckoutForm | "form", string>>;

const initialForm: CheckoutForm = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  marketingConsent: false,
};

interface CheckoutSettings {
  standardShippingPrice: number;
  expressShippingPrice: number;
  freeShippingThreshold: number;
  business: {
    name: string;
    supportEmail: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
}

export function CheckoutFlow({
  cancelled = false,
  settings,
}: {
  cancelled?: boolean;
  settings: CheckoutSettings;
}) {
  const router = useRouter();
  const { cart, catalog, catalogMode, clearCart } = useApp();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [shipping, setShipping] = useState<ShippingMethod>("standard");
  const [errors, setErrors] = useState<FormErrors>({});
  const [pending, setPending] = useState(false);
  const checkoutAttemptId = useRef<string | null>(null);
  const detailed = useMemo(() => getDetailedCart(cart, catalog), [cart, catalog]);
  const subtotal = detailed.reduce((sum, item) => sum + item.variant.price * item.quantity, 0);
  const shippingPrice =
    shipping === "express"
      ? settings.expressShippingPrice
      : subtotal >= settings.freeShippingThreshold
        ? 0
        : settings.standardShippingPrice;
  const totals = calculateOrderTotals(subtotal, shippingPrice);

  const update = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setErrors((current) => ({ ...current, [name]: undefined, form: undefined }));
  };

  const validateContact = () => {
    const parsed = checkoutContactSchema.safeParse(form);
    if (parsed.success) return true;
    const fields = parsed.error.flatten().fieldErrors;
    setErrors({
      email: fields.email?.[0],
      firstName: fields.firstName?.[0],
      lastName: fields.lastName?.[0],
      phone: fields.phone?.[0],
    });
    return false;
  };

  const createDemoOrder = () => {
    const year = new Date().getFullYear();
    const number = `AVA-DEMO-${year}-${String(Date.now()).slice(-6)}`;
    const order: StoredOrder = {
      number,
      createdAt: new Date().toISOString(),
      status: "Confirmée",
      items: detailed.map((item) => ({
        product: item.product.name,
        variant: item.variant.label,
        quantity: item.quantity,
        lot: item.product.lotCode,
        price: item.variant.price,
      })),
      shipping,
      subtotal,
      shippingPrice,
      tax: totals.tax,
      total: totals.total,
      demo: true,
    };
    const orders = readStorage(localStorage, "avana-orders", ordersSchema, []);
    writeStorage(localStorage, "avana-orders", [order, ...orders].slice(0, 100));
    writeStorage(sessionStorage, "avana-last-order", order);
    clearCart();
    router.push(`/commande/${encodeURIComponent(number)}`);
  };

  const startSecurePayment = async () => {
    checkoutAttemptId.current ||= crypto.randomUUID();
    trackEvent("begin_checkout", { itemCount: cart.reduce((sum, item) => sum + item.quantity, 0) });
    const response = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId: checkoutAttemptId.current,
        contact: form,
        cart,
        shippingMethod: shipping,
      }),
    });
    const payload = (await response.json()) as Partial<CheckoutResponse> & {
      error?: string;
      retryWithNewAttempt?: boolean;
    };
    if (!response.ok || !payload.checkoutUrl) {
      if (payload.retryWithNewAttempt) checkoutAttemptId.current = null;
      throw new Error(payload.error || "Le paiement sécurisé n’a pas pu être démarré.");
    }
    window.location.assign(payload.checkoutUrl);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    if (step === 0 && !validateContact()) return;
    if (step < stepNames.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    if (catalogMode === "unconfigured") {
      setErrors({ form: "Le commerce réel n’est pas encore configuré sur le serveur." });
      return;
    }

    setPending(true);
    try {
      if (catalogMode === "live") await startSecurePayment();
      else createDemoOrder();
    } catch (caught) {
      setErrors({ form: caught instanceof Error ? caught.message : "Le paiement ne peut pas démarrer." });
      setPending(false);
    }
  };

  if (!detailed.length) {
    return (
      <div className="confirmation-card">
        <h1>Votre panier est vide.</h1>
        <p className="muted">Ajoutez un produit avant de poursuivre.</p>
        <Link className="button button-dark" href="/boutique">
          Voir la boutique
        </Link>
      </div>
    );
  }

  return (
    <div className="checkout-shell">
      <div className="checkout-top">
        <Link className="brand" href="/">
          AVANA<span>{catalogMode === "live" ? "Paiement sécurisé" : "Checkout de démonstration"}</span>
        </Link>
        <Link className="text-link" href="/panier">
          <ArrowLeft size={15} /> Retour au panier
        </Link>
      </div>

      <div className="progress-bar" aria-label={`Étape ${step + 1} sur ${stepNames.length}`}>
        {stepNames.map((name, index) => (
          <div
            className={`progress-step ${index < step ? "done" : index === step ? "active" : ""}`}
            key={name}
          >
            <span />
            <small>{name}</small>
          </div>
        ))}
      </div>

      <div className="checkout-grid">
        <form className="checkout-panel" noValidate onSubmit={submit}>
          <span className="demo-badge">
            {catalogMode === "live" ? "Commande réelle" : "Démonstration"} · Étape {step + 1} sur{" "}
            {stepNames.length}
          </span>
          {cancelled && step === 0 && (
            <p className="form-notice" role="status">
              Le paiement a été annulé. Votre panier est toujours disponible.
            </p>
          )}
          {errors.form && (
            <p className="form-error" role="alert">
              {errors.form}
            </p>
          )}

          {step === 0 && (
            <>
              <h1>Vos coordonnées</h1>
              <p className="checkout-intro">
                Votre adresse complète sera demandée uniquement sur la page de paiement sécurisée de Stripe.
              </p>
              <div className="form-grid">
                <Field id="email" label="Courriel" error={errors.email} full>
                  <input
                    aria-invalid={Boolean(errors.email)}
                    type="email"
                    id="email"
                    name="email"
                    value={form.email}
                    onChange={update}
                    autoComplete="email"
                  />
                </Field>
                <Field id="firstName" label="Prénom" error={errors.firstName}>
                  <input
                    aria-invalid={Boolean(errors.firstName)}
                    id="firstName"
                    name="firstName"
                    value={form.firstName}
                    onChange={update}
                    autoComplete="given-name"
                  />
                </Field>
                <Field id="lastName" label="Nom" error={errors.lastName}>
                  <input
                    aria-invalid={Boolean(errors.lastName)}
                    id="lastName"
                    name="lastName"
                    value={form.lastName}
                    onChange={update}
                    autoComplete="family-name"
                  />
                </Field>
                <Field id="phone" label="Téléphone (optionnel)" error={errors.phone} full required={false}>
                  <input
                    aria-invalid={Boolean(errors.phone)}
                    type="tel"
                    id="phone"
                    name="phone"
                    value={form.phone}
                    onChange={update}
                    autoComplete="tel"
                  />
                </Field>
              </div>
              <label className="consent-check">
                <input
                  type="checkbox"
                  name="marketingConsent"
                  checked={form.marketingConsent}
                  onChange={update}
                />
                <span>
                  Je souhaite recevoir occasionnellement les nouvelles AVANA. Désabonnement en tout temps.
                </span>
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <h1>Mode de livraison</h1>
              <p className="checkout-intro">
                Les délais commencent lorsque la commande est remise au transporteur.
              </p>
              <label className={`shipping-option ${shipping === "standard" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="shipping"
                  checked={shipping === "standard"}
                  onChange={() => setShipping("standard")}
                />
                <div>
                  <strong>
                    Livraison standard —{" "}
                    {subtotal >= settings.freeShippingThreshold
                      ? "Sans frais"
                      : formatCurrency(settings.standardShippingPrice)}
                  </strong>
                  <span>Délai indicatif : 3 à 6 jours ouvrables</span>
                </div>
              </label>
              <label className={`shipping-option ${shipping === "express" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="shipping"
                  checked={shipping === "express"}
                  onChange={() => setShipping("express")}
                />
                <div>
                  <strong>Livraison express — {formatCurrency(settings.expressShippingPrice)}</strong>
                  <span>Délai indicatif : 1 à 3 jours ouvrables</span>
                </div>
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <h1>{catalogMode === "live" ? "Paiement sécurisé" : "Validation finale"}</h1>
              <div className="payment-demo" role="status">
                <LockKeyhole size={18} />
                <div>
                  <strong>
                    {catalogMode === "live"
                      ? "Carte traitée exclusivement par Stripe"
                      : "Paiement désactivé en démonstration"}
                  </strong>
                  <span>AVANA ne reçoit et ne conserve jamais votre numéro de carte.</span>
                </div>
              </div>
              <div className="checkout-review">
                <ShieldCheck size={20} />
                <div>
                  <strong>Montants vérifiés côté serveur</strong>
                  <p>
                    {catalogMode === "live"
                      ? "Stripe confirmera l’adresse, les taxes applicables et le total final avant le paiement."
                      : "Le bouton final crée uniquement un reçu local anonyme."}
                  </p>
                </div>
              </div>
              <div className="checkout-legal">
                <strong>Vendu par {settings.business.name}</strong>
                <span>
                  {[
                    settings.business.addressLine1,
                    settings.business.addressLine2,
                    settings.business.city,
                    settings.business.province,
                    settings.business.postalCode,
                    settings.business.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
                {(settings.business.supportEmail || settings.business.phone) && (
                  <span>
                    {[settings.business.supportEmail, settings.business.phone].filter(Boolean).join(" · ")}
                  </span>
                )}
                <p>
                  En continuant, vous confirmez avoir consulté les{" "}
                  <Link href="/politiques/conditions" target="_blank">
                    conditions de vente
                  </Link>
                  , la{" "}
                  <Link href="/politiques/livraison" target="_blank">
                    livraison
                  </Link>
                  , les{" "}
                  <Link href="/politiques/retours" target="_blank">
                    retours
                  </Link>{" "}
                  et la{" "}
                  <Link href="/politiques/confidentialite" target="_blank">
                    confidentialité
                  </Link>
                  .
                </p>
              </div>
            </>
          )}

          <div className="checkout-nav">
            {step > 0 ? (
              <button
                className="button button-outline"
                type="button"
                onClick={() => {
                  setErrors({});
                  setStep((current) => current - 1);
                }}
              >
                <ArrowLeft size={16} /> Précédent
              </button>
            ) : (
              <span />
            )}
            <button
              className={step === 2 ? "button button-green" : "button button-dark"}
              disabled={pending || catalogMode === "unconfigured"}
              type="submit"
            >
              {step === 2 ? (
                pending ? (
                  "Ouverture du paiement…"
                ) : catalogMode === "live" ? (
                  <>
                    Continuer avec Stripe <LockKeyhole size={16} />
                  </>
                ) : (
                  "Créer la commande démo"
                )
              ) : (
                <>
                  Continuer <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>

        <aside className="checkout-panel checkout-summary">
          <h2 className="checkout-summary-title">Votre commande</h2>
          {detailed.map((item) => (
            <div className="summary-line" key={`${item.productId}-${item.variantId}`}>
              <span>
                {item.quantity} × {item.product.name}
                <small>{item.variant.label}</small>
              </span>
              <strong>{formatCurrency(item.variant.price * item.quantity)}</strong>
            </div>
          ))}
          <div className="summary-line">
            <span>Sous-total</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="summary-line">
            <span>Livraison estimée</span>
            <span>{shippingPrice === 0 ? "Sans frais" : formatCurrency(shippingPrice)}</span>
          </div>
          <div className="summary-line">
            <span>Taxes</span>
            <span>{catalogMode === "live" ? "Calculées par Stripe" : formatCurrency(totals.tax)}</span>
          </div>
          <div className="summary-line total">
            <span>{catalogMode === "live" ? "Avant taxes" : "Total démo"}</span>
            <span>{formatCurrency(catalogMode === "live" ? subtotal + shippingPrice : totals.total)}</span>
          </div>
          <div className="purchase-note">
            <CheckCircle2 size={15} /> Panier et stock revérifiés avant paiement
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  full = false,
  required = true,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  full?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "form-field full" : "form-field"}>
      <label htmlFor={id}>
        {label} {required ? "*" : ""}
      </label>
      {children}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
