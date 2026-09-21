import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { ProductCard } from "@/components/product-card";
import { products as demoProducts } from "@/data/demo";
import { getCatalogSnapshot } from "@/lib/server/catalog";
import { COMMERCE_ENABLED } from "@/lib/site";
import { serializeJsonForHtml } from "@/lib/security";

export function generateStaticParams() {
  return demoProducts.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await getCatalogSnapshot();
  const product = catalog.products.find((item) => item.slug === slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.shortDescription,
    openGraph: { images: [product.image] },
    robots: COMMERCE_ENABLED ? undefined : { index: false, follow: true },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  const { slug } = await params;
  const catalog = await getCatalogSnapshot();
  const product = catalog.products.find((item) => item.slug === slug);
  if (!product) notFound();
  const recommendations = catalog.products.filter((item) => item.id !== product.id).slice(0, 2);
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription,
    image: product.gallery,
    sku: product.variants[0].sku,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "CAD",
      lowPrice: Math.min(...product.variants.map((variant) => variant.price)),
      highPrice: Math.max(...product.variants.map((variant) => variant.price)),
      availability:
        product.status === "available" ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
    },
  };
  return (
    <>
      {COMMERCE_ENABLED && (
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonForHtml(productSchema) }}
        />
      )}
      <ProductDetail product={product} />
      <section className="page-section" style={{ background: "var(--cream-100)" }}>
        <div className="section-shell">
          <div className="section-heading">
            <div>
              <span className="eyebrow">À découvrir aussi</span>
              <h2>Deux gestes, une origine.</h2>
            </div>
            <p>Comparez les formats selon votre façon d’utiliser la vanille.</p>
          </div>
          <div className="product-grid">
            {recommendations.map((item) => (
              <ProductCard product={item} key={item.id} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
