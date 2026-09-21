"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/types";
import type { CatalogSnapshot } from "@/types/commerce";

const filters = ["Tous", "Gousses", "Poudre", "Nouveautés", "B2C", "Professionnels"];

export function ShopCatalog({ products, mode }: { products: Product[]; mode: CatalogSnapshot["mode"] }) {
  const [filter, setFilter] = useState("Tous");
  const [sort, setSort] = useState("relevance");
  const visible = useMemo(() => {
    const filtered = products.filter((product) => {
      if (filter === "Tous" || filter === "Nouveautés") return true;
      if (filter === "B2C" || filter === "Professionnels") return product.audience.includes(filter);
      return product.category === filter;
    });
    return [...filtered].sort((a, b) => {
      const priceA = a.variants[0].price;
      const priceB = b.variants[0].price;
      if (sort === "low") return priceA - priceB;
      if (sort === "high") return priceB - priceA;
      return Number(b.featured) - Number(a.featured);
    });
  }, [filter, products, sort]);
  return (
    <div className="section-shell page-section-tight">
      <div className="shop-toolbar">
        <div className="filter-row" role="group" aria-label="Filtrer les produits">
          {filters.map((value) => (
            <button
              key={value}
              aria-pressed={filter === value}
              className={`filter-chip ${filter === value ? "active" : ""}`}
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <select
          className="sort-select"
          aria-label="Trier les produits"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="relevance">Pertinence</option>
          <option value="low">Prix croissant</option>
          <option value="high">Prix décroissant</option>
        </select>
      </div>
      <p className="results-count">
        {visible.length} produit{visible.length > 1 ? "s" : ""}
        {mode === "demo" ? " · Prix et disponibilités de démonstration" : " · Disponibilités en direct"}
      </p>
      <div className="product-grid">
        {visible.map((product) => (
          <ProductCard product={product} key={product.id} />
        ))}
      </div>
    </div>
  );
}
