"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ORG_PREVIEW_READ_ONLY_MESSAGE } from "@/lib/auth/orgPreviewConstants";

export type OrgPreviewState = {
  active: boolean;
  orgId: string | null;
  orgName: string | null;
  readOnlyMessage: string;
};

const OrgPreviewContext = createContext<OrgPreviewState>({
  active: false,
  orgId: null,
  orgName: null,
  readOnlyMessage: ORG_PREVIEW_READ_ONLY_MESSAGE
});

export function OrgPreviewProvider({
  previewOrgId,
  previewOrgName,
  children
}: {
  previewOrgId: string | null;
  previewOrgName: string | null;
  children: ReactNode;
}) {
  const active = Boolean(previewOrgId && previewOrgName);
  return (
    <OrgPreviewContext.Provider
      value={{
        active,
        orgId: previewOrgId,
        orgName: previewOrgName,
        readOnlyMessage: ORG_PREVIEW_READ_ONLY_MESSAGE
      }}
    >
      {children}
    </OrgPreviewContext.Provider>
  );
}

export function useOrgPreview(): OrgPreviewState {
  return useContext(OrgPreviewContext);
}
