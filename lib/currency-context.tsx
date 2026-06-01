"use client";
import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { CurrencyMode, CurrencyState } from "./currency-utils";

const CurrencyContext = createContext<CurrencyState>({
  currency: "USD",
  inrRate: 83,
});

export function useCurrency(): CurrencyState {
  return useContext(CurrencyContext);
}

export function CurrencyProvider({
  children,
  currency,
  inrRate,
}: {
  children: ReactNode;
  currency: CurrencyMode;
  inrRate: number;
}) {
  return (
    <CurrencyContext.Provider value={{ currency, inrRate }}>
      {children}
    </CurrencyContext.Provider>
  );
}
