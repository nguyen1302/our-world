"use client";
import { createContext, useContext } from "react";

// Base for read API calls. Authed app = "/api"; public share page = "/api/public/<token>".
// Only READ endpoints differ (memories, memories/[id], stats, scratch, music, photo);
// mutations are admin-only and never fire on the public page.
const ApiBaseContext = createContext<string>("/api");

export function ApiBaseProvider({ base, children }: { base: string; children: React.ReactNode }) {
  return <ApiBaseContext.Provider value={base}>{children}</ApiBaseContext.Provider>;
}

export function useApiBase(): string {
  return useContext(ApiBaseContext);
}
