/**
 * Thin adapter between ConversationState and the submitWatchlistEntry payload.
 *
 * This is the ONLY coupling point between the conversational UX layer and the
 * ClearPort domain engine. It must never derive compliance facts — it only
 * maps user-supplied field values into the same payload shape that
 * MonitoringForm.runScan() assembles.
 */

import { answersToAttrs } from "@/lib/productQuestions";
import type { ProductAttrs } from "@/lib/productQuestions";
import { getLang } from "@/lib/i18n";

export interface ConversationState {
  email: string;
  productName: string;
  description: string;
  htsCode: string;
  originCountry: string;
  destination: string;
  estimatedValue: string;
  freightUsd: string;
  insuranceUsd: string;
  transportMode: "ocean" | "air" | "truck" | "rail" | "";
  manufacturerName: string;
  exporterName: string;
  knownFacts: Record<string, string>;
}

export const EMPTY_STATE: ConversationState = {
  email: "",
  productName: "",
  description: "",
  htsCode: "",
  originCountry: "",
  destination: "",
  estimatedValue: "",
  freightUsd: "",
  insuranceUsd: "",
  transportMode: "",
  manufacturerName: "",
  exporterName: "",
  knownFacts: {},
};

function parseUsd(raw: string): number | undefined {
  const n = parseFloat(raw.replace(/[,$\s]/g, ""));
  return isFinite(n) && n >= 0 ? n : undefined;
}

export interface WatchlistPayload {
  email: string;
  product_name: string;
  product_description?: string;
  hts_code?: string;
  origin_country: string;
  destination_country: string;
  alert_frequency: "weekly";
  estimated_value_usd?: number;
  freight_usd?: number;
  insurance_usd?: number;
  transport_mode?: "ocean" | "air" | "truck" | "rail";
  manufacturer_name?: string;
  exporter_name?: string;
  language: "en" | "zh";
  known_facts?: Record<string, string>;
  is_children?: boolean;
  has_battery?: boolean;
  is_electronic?: boolean;
  is_textile?: boolean;
  is_cosmetic?: boolean;
  is_food_contact?: boolean;
  is_supplement?: boolean;
}

export function intakeToPayload(state: ConversationState): WatchlistPayload {
  const attrs: ProductAttrs = answersToAttrs(state.knownFacts);

  const payload: WatchlistPayload = {
    email: state.email.trim(),
    product_name: state.productName.trim(),
    origin_country: state.originCountry.trim() || "China",
    destination_country: state.destination.trim() || "United States",
    alert_frequency: "weekly",
    language: getLang(),
  };

  if (state.description.trim()) {
    payload.product_description = state.description.trim();
  }
  if (state.htsCode.trim()) {
    payload.hts_code = state.htsCode.trim();
  }

  const ev = parseUsd(state.estimatedValue);
  if (ev !== undefined) payload.estimated_value_usd = ev;

  const fv = parseUsd(state.freightUsd);
  if (fv !== undefined) payload.freight_usd = fv;

  const iv = parseUsd(state.insuranceUsd);
  if (iv !== undefined) payload.insurance_usd = iv;

  if (state.transportMode) {
    payload.transport_mode = state.transportMode;
  }
  if (state.manufacturerName.trim()) {
    payload.manufacturer_name = state.manufacturerName.trim();
  }
  if (state.exporterName.trim()) {
    payload.exporter_name = state.exporterName.trim();
  }
  if (Object.keys(state.knownFacts).length > 0) {
    payload.known_facts = state.knownFacts;
  }

  if (attrs.is_children) payload.is_children = true;
  if (attrs.has_battery) payload.has_battery = true;
  if (attrs.is_electronic) payload.is_electronic = true;
  if (attrs.is_textile) payload.is_textile = true;
  if (attrs.is_cosmetic) payload.is_cosmetic = true;
  if (attrs.is_food_contact) payload.is_food_contact = true;
  if (attrs.is_supplement) payload.is_supplement = true;

  return payload;
}
