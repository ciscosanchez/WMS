"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { createKitDefinition } from "@/modules/vas/actions";

type ProductOption = {
  id: string;
  sku: string;
  name: string;
};

type ComponentLine = {
  productId: string;
  quantity: number;
};

export function KitForm({ products }: { products: ProductOption[] }) {
  const router = useRouter();
  const t = useTranslations("tenant.vas");
  const [name, setName] = useState("");
  const [productId, setProductId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [productSearch, setProductSearch] = useState("");
  const [components, setComponents] = useState<ComponentLine[]>([{ productId: "", quantity: 1 }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (product) =>
        product.sku.toLowerCase().includes(query) || product.name.toLowerCase().includes(query)
    );
  }, [productSearch, products]);

  function updateComponent(index: number, next: Partial<ComponentLine>) {
    setComponents((current) =>
      current.map((component, componentIndex) =>
        componentIndex === index ? { ...component, ...next } : component
      )
    );
  }

  function addComponent() {
    setComponents((current) => [...current, { productId: "", quantity: 1 }]);
  }

  function removeComponent(index: number) {
    setComponents((current) => current.filter((_, componentIndex) => componentIndex !== index));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const validComponents = components.filter(
        (component) => component.productId && component.quantity > 0
      );

      if (!productId) {
        setError(t("productRequired"));
        setSubmitting(false);
        return;
      }

      if (validComponents.length === 0) {
        setError(t("componentsRequired"));
        setSubmitting(false);
        return;
      }

      const result = await createKitDefinition({
        name,
        productId,
        isActive,
        components: validComponents,
      });

      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      toast.success(t("kitCreated"));
      router.push(result.id ? `/products/kits/${result.id}` : "/products/kits");
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("failedCreateKit");
      setError(message);
      toast.error(message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("newKit")} description={t("newKitDesc")} />

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("kitDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="kit-name">{t("kitName")}</Label>
              <Input
                id="kit-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("kitNamePlaceholder")}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="kit-product-search">{t("searchProducts")}</Label>
              <Input
                id="kit-product-search"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder={t("searchProductsPlaceholder")}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="kit-product">{t("productName")}</Label>
              <select
                id="kit-product"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">{t("selectProduct")}</option>
                {filteredProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} - {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id="kit-active"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(Boolean(checked))}
              />
              <Label htmlFor="kit-active">{t("active")}</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{t("components")}</CardTitle>
              <Button type="button" variant="outline" onClick={addComponent}>
                {t("addComponent")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {components.map((component, index) => (
              <div
                key={`${index}-${component.productId}`}
                className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[2fr_120px_auto]"
              >
                <div className="space-y-2">
                  <Label>{t("componentProduct")}</Label>
                  <select
                    value={component.productId}
                    onChange={(event) => updateComponent(index, { productId: event.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="">{t("selectProduct")}</option>
                    {filteredProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} - {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{t("componentQty")}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={component.quantity}
                    onChange={(event) =>
                      updateComponent(index, {
                        quantity: Number.parseInt(event.target.value, 10) || 0,
                      })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeComponent(index)}
                    disabled={components.length === 1}
                  >
                    {t("remove")}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? t("creating") : t("createKit")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/products/kits")}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
