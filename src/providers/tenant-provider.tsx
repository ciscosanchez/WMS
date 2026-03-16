"use client";

import { createContext, useContext } from "react";

interface TenantContextType {
  slug: string;
  tenantId: string;
}

const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({
  slug,
  tenantId,
  children,
}: TenantContextType & { children: React.ReactNode }) {
  return <TenantContext.Provider value={{ slug, tenantId }}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
