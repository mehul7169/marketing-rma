"use client";

import { createContext, useContext, type ReactNode } from "react";

const ActorEmailContext = createContext<string | null>(null);

export function ActorEmailProvider({
  email,
  children
}: {
  email: string | null;
  children: ReactNode;
}) {
  return (
    <ActorEmailContext.Provider value={email}>{children}</ActorEmailContext.Provider>
  );
}

export function useActorEmail(): string | null {
  return useContext(ActorEmailContext);
}
