"use client";

import { createContext, useContext } from "react";

/**
 * Whether the signed-in user is on the ADMIN_EMAILS allowlist, provided by
 * AppShell from the proxy's x-is-admin header. Client-side only for display
 * (e.g. showing plan-locked models as unlocked); every paid gate is enforced
 * again on the server with isAdminEmail().
 */
const IsAdminContext = createContext(false);

export const IsAdminProvider = IsAdminContext.Provider;

export function useIsAdmin() {
  return useContext(IsAdminContext);
}
