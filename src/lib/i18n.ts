import { useSyncExternalStore } from "react";

export type Lang = "en" | "zh";
const KEY = "clearport_lang";

function read(): Lang {
  if (typeof localStorage === "undefined") return "en";
  return localStorage.getItem(KEY) === "zh" ? "zh" : "en";
}

let current: Lang = read();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}
export function setLang(l: Lang) {
  current = l;
  if (typeof localStorage !== "undefined") localStorage.setItem(KEY, l);
  listeners.forEach((fn) => fn());
}
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => "en" as Lang,
  );
}

// Translation dictionary. Official agency names, HTS codes, CFR citations and
// URLs are never placed here — they come verbatim from the backend.
const DICT: Record<string, { en: string; zh: string }> = {
  nav_assistant: { en: "ClearPort Assistant", zh: "ClearPort 助手" },
  nav_sources: { en: "Official sources", zh: "官方来源" },
  nav_check: { en: "Check a product", zh: "检查产品" },

  form_title: { en: "Start monitoring a product", zh: "开始监测产品" },
  form_email: { en: "Your email address", zh: "您的电子邮箱" },
  form_product: { en: "Product name", zh: "产品名称" },
  form_desc: { en: "Product description", zh: "产品描述" },
  form_hts: { en: "HTS / HS code", zh: "HTS / HS 编码" },
  form_value: { en: "Estimated customs value of shipment (USD)", zh: "预计货物报关价值（美元）" },
  form_origin: { en: "Country of origin", zh: "原产国" },
  form_dest: { en: "Import destination", zh: "进口目的地" },
  form_details: { en: "Product details", zh: "产品属性" },
  form_check_all: { en: "check everything that applies", zh: "勾选所有适用项" },
  form_submit: { en: "Start monitoring + generate risk scan", zh: "开始监测并生成风险扫描" },
  form_optional: { en: "optional", zh: "选填" },

  // Verification statuses
  vs_verified: { en: "Verified applicable", zh: "已核实适用" },
  vs_unconfirmed: { en: "Official requirement — applicability needs confirmation", zh: "官方要求 — 适用性需确认" },
  vs_none: { en: "No verified source found", zh: "未找到已核实来源" },

  // Report section headers
  rep_baseline: { en: "Current verified baseline", zh: "当前已核实基准" },
  rep_changes: { en: "Recent verified changes", zh: "近期已核实变更" },
  rep_readiness: { en: "Launch readiness", zh: "进口准备度" },
  rep_docs_supplier: { en: "Ask your supplier for these documents", zh: "向供应商索取以下文件" },
  rep_broker_q: { en: "Questions to ask your customs broker", zh: "向报关行询问的问题" },
  rep_no_change: {
    en: "No relevant change found in the last 30 days for this product.",
    zh: "过去 30 天内未发现与该产品相关的变更。",
  },

  // Assistant
  asst_title: { en: "ClearPort Assistant", zh: "ClearPort 助手" },
  asst_placeholder: { en: "Ask about duties, classification, tests, documents…", zh: "询问关税、归类、测试、文件……" },
  asst_send: { en: "Ask", zh: "提问" },
  asst_need_product: {
    en: "Run a product check first, then open the Assistant from your report.",
    zh: "请先检查产品，然后从报告中打开助手。",
  },

  banner_saved: { en: "Product saved for monitoring.", zh: "产品已保存以进行监测。" },
  err_generic: { en: "Something went wrong. Please try again.", zh: "出现问题，请重试。" },
};

export function t(lang: Lang, key: keyof typeof DICT): string {
  return DICT[key]?.[lang] ?? DICT[key]?.en ?? key;
}
