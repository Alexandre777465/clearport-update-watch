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

// Translation dictionary for ClearPort's customer-facing UI.
//
// What is NEVER translated and is therefore never placed here (requirement 6):
//   • official agency names (CBP, USTR, USITC, FDA, FTC, CPSC…)
//   • HTS / HS codes and statistical lines
//   • CFR / U.S.C. citations
//   • official document titles and URLs
//   • dates and rate numbers
// Those values come verbatim from the backend or are rendered as-is in the JSX.
// We also never translate user-entered product names or descriptions
// (requirement 7) — those are echoed back exactly as typed.
const DICT = {
  // ── Nav / footer ─────────────────────────────────────────────────────────
  nav_assistant: { en: "ClearPort Assistant", zh: "ClearPort 助手" },
  nav_sources: { en: "Official sources", zh: "官方来源" },
  nav_check: { en: "Check a product", zh: "检查产品" },
  footer_tagline: {
    en: "U.S. import rule updates, simplified for importers.",
    zh: "美国进口法规更新，为进口商简化呈现。",
  },
  footer_product: { en: "Product", zh: "产品" },
  footer_legal: { en: "Legal", zh: "法律" },
  footer_privacy: { en: "Privacy", zh: "隐私政策" },
  footer_terms: { en: "Terms & disclaimer", zh: "条款与免责声明" },
  footer_disclaimer: {
    en: "ClearPort provides source-backed summaries for preparation. It is not legal advice and does not replace a licensed customs broker, lawyer, or accredited laboratory.",
    zh: "ClearPort 提供有官方来源支持的摘要，仅供准备之用。它不构成法律意见，也不能取代持证报关行、律师或认可的检测实验室。",
  },
  footer_rights: { en: "All rights reserved.", zh: "保留所有权利。" },

  // ── Homepage: hero ───────────────────────────────────────────────────────
  home_badge: { en: "For importers buying from China", zh: "为从中国采购的进口商打造" },
  home_headline: {
    en: "Never miss a customs or tariff update affecting your products.",
    zh: "绝不错过任何影响您产品的海关或关税更新。",
  },
  home_desc: {
    en: "Enter your product details and HTS/HS code once. ClearPort monitors official U.S. trade sources and emails you when something relevant changes.",
    zh: "只需录入一次产品信息和 HTS/HS 编码。ClearPort 会监测美国官方贸易来源，并在出现相关变更时通过邮件通知您。",
  },
  home_cta_start: { en: "Start monitoring a product", zh: "开始监测产品" },
  home_cta_sample: { en: "See a sample alert", zh: "查看提醒示例" },
  home_built_for: {
    en: "Built for Amazon sellers, e-commerce brands, sourcing agents, and importers buying from China.",
    zh: "专为亚马逊卖家、电商品牌、采购代理以及从中国采购的进口商打造。",
  },
  home_hero_disclaimer: {
    en: "ClearPort provides source-backed summaries for preparation. Final interpretation should be confirmed with your customs broker.",
    zh: "ClearPort 提供有官方来源支持的摘要，仅供准备之用。最终解释应与您的报关行确认。",
  },
  home_latest_alert: { en: "Latest alert", zh: "最新提醒" },
  home_verify_broker: { en: "What to verify with broker", zh: "需与报关行核实的事项" },
  home_source_label: { en: "Source:", zh: "来源：" },
  home_open_alert: { en: "Open alert", zh: "打开提醒" },
  badge_china_usa: { en: "China → USA", zh: "中国 → 美国" },
  badge_effective: { en: "Effective", zh: "生效" },

  // ── Homepage: problems ───────────────────────────────────────────────────
  prob_heading: {
    en: "Importers are buried in technical notices.",
    zh: "进口商被淹没在繁杂的技术通知中。",
  },
  prob_1_t: { en: "Long government documents", zh: "冗长的政府文件" },
  prob_1_b: {
    en: "Important updates are often hidden inside technical customs notices and tariff publications.",
    zh: "重要更新常常隐藏在专业的海关通知和关税公告之中。",
  },
  prob_2_t: { en: "Hard to know what applies", zh: "难以判断哪些适用" },
  prob_2_b: {
    en: "Importers struggle to know if a change affects their product, HTS code, or shipment route.",
    zh: "进口商很难判断某项变更是否影响自己的产品、HTS 编码或运输路线。",
  },
  prob_3_t: { en: "Late surprises", zh: "临门一脚的意外" },
  prob_3_b: {
    en: "Many importers only hear about requirements when their broker raises questions close to shipment.",
    zh: "许多进口商直到临近发货、报关行提出疑问时才得知相关要求。",
  },
  prob_4_t: { en: "China-origin updates matter", zh: "中国原产地的更新尤为关键" },
  prob_4_b: {
    en: "Tariff actions, exclusions, and product-specific rules can affect China-origin goods.",
    zh: "关税措施、排除清单及针对特定产品的规则都可能影响中国原产货物。",
  },
  prob_5_t: { en: "Broker dependency", zh: "对报关行的依赖" },
  prob_5_b: {
    en: "Brokers are important, but importers still need to understand what to ask and what to monitor.",
    zh: "报关行固然重要，但进口商仍需了解该询问什么、该监测什么。",
  },

  // ── Homepage: solutions ──────────────────────────────────────────────────
  sol_heading: {
    en: "ClearPort turns import rule changes into simple alerts.",
    zh: "ClearPort 将进口法规变更转化为简明提醒。",
  },
  sol_1_t: { en: "Plain-English summaries", zh: "通俗易懂的摘要" },
  sol_1_b: {
    en: "Long customs and tariff updates summarized into importer-friendly language.",
    zh: "把冗长的海关和关税更新提炼成进口商易懂的语言。",
  },
  sol_2_t: { en: "Product-specific monitoring", zh: "针对具体产品的监测" },
  sol_2_b: {
    en: "Track updates by product category, HS/HTS code, origin country, and destination country.",
    zh: "按产品类别、HS/HTS 编码、原产国和目的国跟踪更新。",
  },
  sol_3_t: { en: "Source-backed alerts", zh: "有官方来源支持的提醒" },
  sol_3_b: {
    en: "Every alert includes the source, publication date, effective date, and official reference.",
    zh: "每条提醒都附有来源、发布日期、生效日期及官方依据。",
  },
  sol_4_t: { en: "Broker-ready questions", zh: "可直接询问报关行的问题" },
  sol_4_b: {
    en: "Generate clear questions to verify with your customs broker before shipment.",
    zh: "生成清晰的问题清单，供您在发货前与报关行核实。",
  },
  sol_5_t: { en: "Weekly or instant updates", zh: "每周或即时更新" },
  sol_5_b: {
    en: "Choose instant alerts, daily digest, or weekly digest.",
    zh: "可选择即时提醒、每日汇总或每周汇总。",
  },

  // ── Homepage: sources / trust / bottom CTA ───────────────────────────────
  src_eyebrow: { en: "Trust & sourcing", zh: "可信与来源" },
  src_sec_heading: { en: "Built around official trade sources.", zh: "围绕官方贸易来源构建。" },
  src_sec_sub: {
    en: "Every alert is matched back to its official publication so you can verify the source yourself.",
    zh: "每条提醒都可追溯到其官方出处，让您能够亲自核实来源。",
  },
  visit_official_source: { en: "Visit official source", zh: "访问官方来源" },
  // Descriptive type labels for the homepage source list (names stay official/English).
  srctype_fr_cbp: { en: "Customs rules & notices (official API)", zh: "海关规则与通知（官方 API）" },
  srctype_fr_ustr: { en: "Section 301 & trade actions (official API)", zh: "Section 301 与贸易措施（官方 API）" },
  srctype_fr_usitc: { en: "Trade Commission notices (official API)", zh: "贸易委员会通知（官方 API）" },
  srctype_cbp_news: { en: "CBP newsroom RSS", zh: "CBP 新闻中心 RSS" },
  srctype_hts: { en: "HTS classifications & duty rates", zh: "HTS 归类与关税税率" },
  srctype_ustr_301: { en: "Tariff actions & exclusions", zh: "关税措施与排除清单" },

  trust_heading: {
    en: "Built for preparation, not legal interpretation.",
    zh: "为准备工作而生，而非提供法律解释。",
  },
  trust_body: {
    en: "ClearPort helps importers monitor official import-rule updates and prepare better questions for their customs broker. It does not replace a licensed customs broker, legal advisor, or customs authority.",
    zh: "ClearPort 帮助进口商监测官方进口法规更新，并为与报关行沟通准备更到位的问题。它不能取代持证报关行、法律顾问或海关主管机关。",
  },
  trust_b1: { en: "Source-backed summaries", zh: "有官方来源支持的摘要" },
  trust_b2: { en: "Live source-health status", zh: "实时来源运行状态" },
  trust_b3: { en: "Official references", zh: "官方依据" },
  trust_b4: { en: "Broker verification prompts", zh: "报关行核实提示" },
  trust_b5: { en: "Cautious relevance matching", zh: "审慎的相关性匹配" },

  cta_heading: { en: "Don't read 50-page notices manually.", zh: "无需再手动阅读 50 页的通知。" },
  cta_body: {
    en: "Enter your product details once. Get emailed when official U.S. trade rules change.",
    zh: "只需录入一次产品信息。当美国官方贸易规则变更时，您将收到邮件通知。",
  },
  see_pricing: { en: "See pricing", zh: "查看价格" },

  // ── Sample alert (hero card + /sample-alert page) ────────────────────────
  sample_relevance_direct: { en: "Direct HTS match", zh: "HTS 直接匹配" },
  sample_title: {
    en: "USTR updates Section 301 tariff exclusion status for selected China-origin products",
    zh: "USTR 更新部分中国原产产品的 Section 301 关税排除状态",
  },
  sample_summary: {
    en: "Certain tariff exclusions for China-origin products have been extended, modified, or allowed to expire. Importers using affected HTS codes should verify whether their products remain eligible for exclusion treatment.",
    zh: "部分中国原产产品的关税排除已被延长、修改或允许到期。使用受影响 HTS 编码的进口商应核实其产品是否仍符合排除待遇资格。",
  },
  sample_why: { en: "Why this may matter", zh: "为何这可能重要" },
  sample_why_body: {
    en: "If your product uses one of the affected HTS codes, your landed cost or filing process may change.",
    zh: "如果您的产品使用了受影响的 HTS 编码之一，您的到岸成本或报关流程可能会发生变化。",
  },
  sample_q1: { en: "Does your saved HTS code appear in the notice?", zh: "您保存的 HTS 编码是否出现在该通知中？" },
  sample_q2: { en: "Is your product description covered by the exclusion?", zh: "您的产品描述是否在排除范围内？" },
  sample_q3: { en: "What is the effective date?", zh: "生效日期是哪一天？" },
  sample_q4: { en: "Does your entry require special filing treatment?", zh: "您的报关是否需要特殊的申报处理？" },
  sample_q5: {
    en: "Does your supplier invoice include the required product description?",
    zh: "您的供应商发票是否包含所要求的产品描述？",
  },
  sa_badge: { en: "Sample alert", zh: "提醒示例" },
  sa_plain_summary: { en: "Plain-English summary", zh: "通俗摘要" },
  sa_origin: { en: "Origin: China", zh: "原产地：中国" },
  sa_destination: { en: "Destination: United States", zh: "目的地：美国" },
  sa_export: { en: "Export Broker Questions", zh: "导出报关行问题清单" },
  sa_disclaimer: {
    en: "ClearPort provides source-backed summaries for preparation. It is not legal advice and does not guarantee customs clearance.",
    zh: "ClearPort 提供有官方来源支持的摘要，仅供准备之用。它不构成法律意见，也不保证海关放行。",
  },
  sa_start: { en: "Start Monitoring your products", zh: "开始监测您的产品" },

  // ── Monitoring form ──────────────────────────────────────────────────────
  form_title: { en: "Start monitoring a product", zh: "开始监测产品" },
  form_intro: {
    en: "We'll scan your product against official U.S. trade sources and check for relevant customs, tariff, and regulatory risks. We'll save it to your monitoring list so you can track it over time.",
    zh: "我们会对照美国官方贸易来源扫描您的产品，检查相关的海关、关税和监管风险，并将其保存到您的监测列表中，方便您持续跟踪。",
  },
  form_email: { en: "Your email address", zh: "您的电子邮箱" },
  form_email_ph: { en: "you@company.com", zh: "you@company.com" },
  form_product: { en: "Product name", zh: "产品名称" },
  form_product_ph: { en: "e.g. Bluetooth speaker", zh: "例如：蓝牙音箱" },
  form_desc: { en: "Product description", zh: "产品描述" },
  form_desc_opt: { en: "(optional — improves scan accuracy)", zh: "（选填——可提升扫描准确度）" },
  form_desc_ph: {
    en: "e.g. Portable rechargeable Bluetooth speaker, ABS plastic, 10W output",
    zh: "例如：便携式可充电蓝牙音箱，ABS 塑料外壳，10W 输出",
  },
  form_hts: { en: "HTS / HS code", zh: "HTS / HS 编码" },
  form_hts_opt: { en: "(optional — significantly improves scan)", zh: "（选填——可显著提升扫描效果）" },
  form_hts_ph: { en: "e.g. 8517.13.00", zh: "例如：8517.13.00" },
  form_hts_help: {
    en: "Find on past customs entries or ask your factory for their export HS code.",
    zh: "可在过往报关单上查找，或向工厂索取其出口 HS 编码。",
  },
  form_value: { en: "Estimated customs value of shipment (USD)", zh: "预计货物报关价值（美元）" },
  form_value_opt: { en: "(optional — enables dollar impact)", zh: "（选填——可估算金额影响）" },
  form_value_ph: { en: "e.g. 25000", zh: "例如：25000" },
  form_value_help: {
    en: "Used only to estimate dollar impact from verified official rates. Leave blank to see rates only.",
    zh: "仅用于根据已核实的官方税率估算金额影响。留空则仅显示税率。",
  },
  form_origin: { en: "Country of origin", zh: "原产国" },
  form_dest: { en: "Import destination", zh: "进口目的地" },
  form_details: { en: "Product details", zh: "产品属性" },
  form_check_all: { en: "check everything that applies", zh: "勾选所有适用项" },
  form_selected: { en: "selected", zh: "项已选" },
  form_details_help: {
    en: "These answers determine which risk categories and compliance requirements we check.",
    zh: "这些选项决定了我们将检查哪些风险类别和合规要求。",
  },
  form_submit: { en: "Start monitoring + generate risk scan", zh: "开始监测并生成风险扫描" },
  form_disclaimer: {
    en: "This is not legal or customs advice. Verify with your customs broker.",
    zh: "本内容不构成法律或海关意见。请与您的报关行核实。",
  },
  err_email: { en: "A valid email address is required.", zh: "请填写有效的电子邮箱地址。" },
  err_product: { en: "Product name is required.", zh: "产品名称为必填项。" },

  // Product-attribute options
  attr_children: { en: "For children under 12", zh: "供 12 岁以下儿童使用" },
  attr_battery: { en: "Contains a battery", zh: "含电池" },
  attr_electronic: { en: "Electronic product", zh: "电子产品" },
  attr_textile: { en: "Textile / apparel", zh: "纺织品 / 服装" },
  attr_cosmetic: { en: "Cosmetic / beauty / personal care", zh: "化妆品 / 美妆 / 个人护理" },
  attr_food_contact: { en: "Touches food or drink", zh: "接触食品或饮料" },
  attr_supplement: { en: "Supplement / food / medical-adjacent", zh: "膳食补充剂 / 食品 / 医疗相关" },
  attr_amazon: { en: "Selling on Amazon", zh: "在亚马逊销售" },
  attr_tiktok: { en: "Selling on TikTok Shop", zh: "在 TikTok Shop 销售" },
  attr_eu: { en: "Also selling in the EU", zh: "同时在欧盟销售" },

  // Inference confirmation step
  inf_title: { en: "Quick check before we scan", zh: "扫描前的快速确认" },
  inf_body: {
    en: "Based on your product name and description, these characteristics look likely but weren't selected. Confirm the ones that apply — they change which compliance requirements we check.",
    zh: "根据您的产品名称和描述，以下特征看起来很可能适用，但您尚未勾选。请确认其中适用的项——它们会影响我们检查的合规要求。",
  },
  inf_run: { en: "Run analysis", zh: "运行分析" },
  inf_note: {
    en: "We never change your answers without asking. Uncheck anything that doesn't apply.",
    zh: "未经您确认，我们绝不会更改您的选择。请取消勾选任何不适用的项。",
  },

  // Scanning / loading states
  scan_saving: { en: "Saving your product…", zh: "正在保存您的产品……" },
  scan_saving_sub: { en: "Setting up monitoring.", zh: "正在设置监测。" },
  scan_scanning_for: { en: "Scanning import risks for", zh: "正在扫描进口风险：" },
  scan_scanning_sub: {
    en: "Checking tariff exposure, compliance requirements, and documentation needs.",
    zh: "正在检查关税风险、合规要求和文件需求。",
  },

  // Scan error states
  scan_not_completed: { en: "Scan not completed", zh: "扫描未完成" },
  err_scan_failed: {
    en: "We couldn't complete the risk scan. Your product was saved — please try again.",
    zh: "我们无法完成风险扫描。您的产品已保存——请重试。",
  },
  err_scan_timeout: {
    en: "The scan is taking longer than usual. Your product was saved — please try again.",
    zh: "扫描耗时比平常更久。您的产品已保存——请重试。",
  },
  err_save: {
    en: "Something went wrong saving your product. Please try again.",
    zh: "保存您的产品时出现问题。请重试。",
  },
  btn_try_again: { en: "Try again", zh: "重试" },
  btn_back_edit: { en: "Back to edit", zh: "返回编辑" },

  // Confirmation banner + report
  conf_scan_generated: { en: "Risk scan generated.", zh: "风险扫描已生成。" },
  conf_saved: { en: "Product saved for monitoring.", zh: "产品已保存以进行监测。" },
  conf_email_pre: {
    en: "We'll monitor official U.S. trade sources and email",
    zh: "我们将监测美国官方贸易来源，并在出现可能影响",
  },
  conf_email_mid: { en: "when a relevant update may affect", zh: "的相关更新时，发送邮件至" },
  conf_email_disabled: {
    en: "has been saved for monitoring. Email alerts are not yet active — your risk scan is ready below.",
    zh: "已保存以进行监测。邮件提醒尚未启用——您的风险扫描已在下方就绪。",
  },
  conf_backend_warn: {
    en: "⚠️ Backend not connected — entry not persisted. Set VITE_API_URL to connect the live backend.",
    zh: "⚠️ 后端未连接——条目未持久化保存。请设置 VITE_API_URL 以连接线上后端。",
  },
  rep_baseline: { en: "Current verified baseline", zh: "当前已核实基准" },
  rep_baseline_sub: {
    en: "What is true for this product right now, from official sources — duty rates and standing compliance requirements. Recent changes are shown separately below.",
    zh: "根据官方来源，该产品当前的实际情况——关税税率和持续性合规要求。近期变更在下方单独显示。",
  },
  rep_risk_suffix: { en: "risk", zh: "风险" },
  rep_readiness: { en: "Launch readiness", zh: "进口准备度" },
  rep_broker_q: { en: "Questions to ask your customs broker", zh: "向报关行询问的问题" },
  rep_broker_pack: { en: "Broker pack", zh: "报关行资料包" },
  rep_changes: { en: "Recent verified changes", zh: "近期已核实变更" },
  rep_changes_sub: {
    en: "Official publications from the last 30 days relevant to your HTS code — newly published rules, tariff actions, or notices, each linked to its source.",
    zh: "过去 30 天内与您 HTS 编码相关的官方出版物——新发布的规则、关税措施或通知，每条均附有来源链接。",
  },
  rep_no_change: {
    en: "No relevant change found in the last 30 days for this product. ClearPort will alert you here when a relevant official update is published.",
    zh: "过去 30 天内未发现与该产品相关的变更。当有相关官方更新发布时，ClearPort 将在此处提醒您。",
  },
  ask_q_title: { en: "Questions about this report?", zh: "对本报告有疑问？" },
  ask_q_body: {
    en: "Ask ClearPort about duties, classification, tests, or documents — answered only from your verified findings and matched official sources.",
    zh: "向 ClearPort 询问关税、归类、测试或文件——回答仅依据您的已核实结论和匹配的官方来源。",
  },
  ask_clearport: { en: "Ask ClearPort", zh: "询问 ClearPort" },
  disclaimer_long: {
    en: "This is not legal or customs advice. Verify all findings with your customs broker before making import decisions.",
    zh: "本内容不构成法律或海关意见。在做出进口决策前，请与您的报关行核实所有结论。",
  },
  prev_effective: { en: "Effective", zh: "生效" },
  prev_what_ask: { en: "What to ask your customs broker", zh: "需向报关行询问的事项" },

  // ── RiskScanCard ─────────────────────────────────────────────────────────
  vs_verified: { en: "Verified applicable", zh: "已核实适用" },
  vs_unconfirmed: { en: "Official requirement — applicability needs confirmation", zh: "官方要求 — 适用性需确认" },
  vs_none: { en: "No verified source found", zh: "未找到已核实来源" },
  rs_overall_risk: { en: "Overall risk:", zh: "总体风险：" },
  rs_conf_label: { en: "Confidence:", zh: "可信度：" },
  rs_conf_suffix: {
    en: "Generated from official regulatory requirements",
    zh: "依据官方监管要求生成",
  },
  rs_breakdown: { en: "Risk breakdown", zh: "风险明细" },
  rs_what_changed: { en: "What changed:", zh: "变更内容：" },
  rs_how_affects: { en: "How it affects this product:", zh: "对本产品的影响：" },
  rs_applies_when: { en: "Applies when:", zh: "适用条件：" },
  rs_fin_impact: { en: "Estimated financial impact:", zh: "预计金额影响：" },
  rs_required_action: { en: "Required action:", zh: "需采取的行动：" },
  rs_needs_verify: { en: "What ClearPort needs to verify this:", zh: "ClearPort 核实此项所需的信息：" },
  rs_official_source: { en: "Official source", zh: "官方来源" },
  rs_citation: { en: "Citation:", zh: "引用依据：" },
  rs_published: { en: "Published", zh: "发布于" },
  rs_effective_rev: { en: "Effective/rev", zh: "生效/修订" },
  rs_last_verified: { en: "Last verified", zh: "最近核实" },
  rs_view_doc: { en: "View official document", zh: "查看官方文件" },
  rs_next: { en: "What to do next", zh: "后续行动" },
  lvl_Critical: { en: "Critical", zh: "严重" },
  lvl_High: { en: "High", zh: "高" },
  lvl_Medium: { en: "Medium", zh: "中" },
  lvl_Low: { en: "Low", zh: "低" },
  "lvl_N/A": { en: "N/A", zh: "不适用" },

  // ── ReadinessScore ───────────────────────────────────────────────────────
  ready_verified_req: { en: "verified requirements", zh: "项已核实要求" },
  ready_verified_req_one: { en: "verified requirement", zh: "项已核实要求" },
  ready_need_confirm: { en: "need confirmation", zh: "项需确认" },
  ready_none: {
    en: "No requirements were verified from official sources for the details provided.",
    zh: "根据所提供的信息，未能从官方来源核实任何要求。",
  },

  // ── BrokerPack ───────────────────────────────────────────────────────────
  bp_title: { en: "Broker Pack", zh: "报关行资料包" },
  bp_hide: { en: "Hide", zh: "隐藏" },
  bp_preview: { en: "Preview", zh: "预览" },
  bp_copied: { en: "Copied", zh: "已复制" },
  bp_copy: { en: "Copy to clipboard", zh: "复制到剪贴板" },
  bp_desc: {
    en: "A ready-to-send summary for your customs broker — includes product details, risk flags, and questions to ask.",
    zh: "一份可直接发送给报关行的摘要——包含产品信息、风险标记和待询问的问题。",
  },

  // ── Document checklist (responsibility groups) ───────────────────────────
  doc_group_supplier: { en: "Ask your supplier for these", zh: "向供应商索取以下文件" },
  doc_group_broker: { en: "Importer / customs-broker tasks", zh: "进口商 / 报关行的任务" },
  doc_group_conditional: { en: "Applicability needs confirmation", zh: "适用性需确认" },
  doc_group_conditional_help: {
    en: "These may apply depending on your product's exact classification and attributes — confirm with your supplier or broker before treating them as mandatory.",
    zh: "这些文件是否适用取决于产品的确切归类和属性——在视为强制要求之前，请与供应商或报关行确认。",
  },
  doc_required: { en: "Required", zh: "必需" },
  doc_needs_confirmation: { en: "Needs confirmation", zh: "需确认" },
  doc_view_source: { en: "View official source", zh: "查看官方来源" },
  doc_missing_prefix: { en: "Not yet collected:", zh: "尚未收集：" },
  doc_missing_suffix: { en: "required document(s)", zh: "项必需文件" },
  doc_none: {
    en: "No required documents could be tied to a verified finding for this product yet.",
    zh: "目前尚无可与已核实结论关联的必需文件。",
  },
  docs_section_title: { en: "Documents & responsibilities", zh: "文件与责任分工" },

  // ── ClearPort Assistant (/ask) ───────────────────────────────────────────
  asst_title: { en: "ClearPort Assistant", zh: "ClearPort 助手" },
  asst_placeholder: { en: "Ask about duties, classification, tests, documents…", zh: "询问关税、归类、测试、文件……" },
  asst_send: { en: "Ask", zh: "提问" },
  ask_intro: {
    en: "Answers use only your product's verified findings and matched official sources. When the official sources don't cover something, ClearPort says so rather than guessing.",
    zh: "回答仅依据您产品的已核实结论和匹配的官方来源。当官方来源未涵盖某项内容时，ClearPort 会如实说明，而非凭空猜测。",
  },
  ask_need_product: {
    en: "The Assistant answers questions about a specific product you've checked. Run a product check first, then open the Assistant from your report.",
    zh: "助手仅就您已检查的特定产品回答问题。请先检查产品，然后从报告中打开助手。",
  },
  ask_chip_1: { en: "What duties or tariffs apply?", zh: "适用哪些关税或税费？" },
  ask_chip_2: { en: "What documents do I need?", zh: "我需要哪些文件？" },
  ask_chip_3: { en: "What tests or certificates are required?", zh: "需要哪些测试或证书？" },
  ask_chip_4: { en: "What should I ask my customs broker?", zh: "我该向报关行询问什么？" },
  ask_chip_5: { en: "What are my next steps?", zh: "我接下来该做什么？" },
  ask_official_sources: { en: "Official sources", zh: "官方来源" },
  ask_checking: { en: "Checking your verified findings…", zh: "正在核对您的已核实结论……" },
  ask_disclaimer: {
    en: "Informational only. Verify with a licensed customs broker before importing.",
    zh: "仅供参考。进口前请与持证报关行核实。",
  },

  // ── Sources page (/sources) ──────────────────────────────────────────────
  srcp_sub: {
    en: "The official U.S. sources ClearPort monitors — with live status.",
    zh: "ClearPort 监测的美国官方来源——附实时状态。",
  },
  srcp_banner: {
    en: "ClearPort checks official sources and matches updates to your monitored products. Status below is read live from the monitoring backend.",
    zh: "ClearPort 检查官方来源，并将更新与您监测的产品进行匹配。下方状态实时读取自监测后端。",
  },
  srcp_loaded_pre: { en: "Status loaded", zh: "状态加载于" },
  srcp_loaded_post: {
    en: "Each source shows its real schedule and last successful sync.",
    zh: "每个来源均显示其真实的检查计划和最近一次成功同步。",
  },
  srcp_unavailable_title: { en: "Status unavailable", zh: "状态不可用" },
  srcp_unavailable_body: {
    en: "We can't reach the monitoring backend right now, so live source health can't be shown. Please check back shortly.",
    zh: "我们目前无法连接监测后端，因此无法显示实时来源状态。请稍后再查看。",
  },
  srcp_none: { en: "No sources are configured.", zh: "尚未配置任何来源。" },
  srcp_deactivated: {
    en: "This source is deactivated — no reliable official feed is currently connected. It is not being checked.",
    zh: "此来源已停用——目前未连接可靠的官方数据源。它未被检查。",
  },
  srcp_schedule: { en: "Schedule:", zh: "检查计划：" },
  srcp_last_checked: { en: "Last checked:", zh: "最近检查：" },
  srcp_last_sync: { en: "Last successful sync:", zh: "最近成功同步：" },
  srcp_recent_error: { en: "Recent error:", zh: "近期错误：" },
  srcp_footer: {
    en: "ClearPort summaries describe what an update may mean. Final interpretation should be confirmed with a licensed customs broker.",
    zh: "ClearPort 的摘要描述某项更新可能意味着什么。最终解释应与持证报关行确认。",
  },
  st_Active: { en: "Active", zh: "正常运行" },
  st_Degraded: { en: "Degraded", zh: "性能下降" },
  st_Error: { en: "Error", zh: "错误" },
  st_Unavailable: { en: "Unavailable", zh: "不可用" },
  "st_Never checked": { en: "Never checked", zh: "从未检查" },

  // ── Privacy ──────────────────────────────────────────────────────────────
  priv_title: { en: "Privacy", zh: "隐私政策" },
  priv_p1: {
    en: "ClearPort collects the product details and email address you submit so it can generate an import-readiness report and monitor official U.S. trade sources for updates relevant to your product.",
    zh: "ClearPort 收集您提交的产品信息和电子邮箱，以便生成进口准备度报告，并监测美国官方贸易来源中与您产品相关的更新。",
  },
  priv_p2: {
    en: "We store your submission (product name, description, HTS code, origin/destination, product attributes and email) to run scans and send you monitoring alerts. We do not sell your data. Your email is used only for ClearPort monitoring communications.",
    zh: "我们会存储您提交的内容（产品名称、描述、HTS 编码、原产地/目的地、产品属性及电子邮箱），用于运行扫描并向您发送监测提醒。我们不会出售您的数据。您的邮箱仅用于 ClearPort 的监测通信。",
  },
  priv_p3: {
    en: "Official source documents are retrieved from public U.S. government sources. AI is used only to explain and summarize stored official data — not as a source of legal, tariff, or compliance facts.",
    zh: "官方来源文件取自美国政府公开来源。AI 仅用于解释和总结已存储的官方数据——而非作为法律、关税或合规事实的来源。",
  },
  priv_p4: {
    en: "To request deletion of your data, contact the pilot administrator.",
    zh: "如需删除您的数据，请联系试点管理员。",
  },

  // ── Terms ────────────────────────────────────────────────────────────────
  terms_title: { en: "Terms & Disclaimer", zh: "条款与免责声明" },
  terms_p1: {
    en: "ClearPort does not replace a licensed customs broker, a lawyer, or an accredited testing laboratory.",
    zh: "ClearPort 不能取代持证报关行、律师或认可的检测实验室。",
  },
  terms_p2: {
    en: "ClearPort provides source-backed, informational summaries to help importers prepare. Every factual rate or requirement shown is linked to an official U.S. government source. Findings labeled “Applicability needs confirmation” or “No verified source found” are not assertions that a rule applies to your product.",
    zh: "ClearPort 提供有官方来源支持的信息性摘要，帮助进口商做好准备。所显示的每项事实性税率或要求均链接至美国政府官方来源。标注为“适用性需确认”或“未找到已核实来源”的结论，并不代表断定某项规则适用于您的产品。",
  },
  terms_p3: {
    en: "ClearPort does not guarantee import clearance, classification accuracy, or regulatory compliance. Duty rates depend on correct HTS classification, which only a licensed broker can confirm. Always verify findings with your customs broker and the relevant agency before making import decisions.",
    zh: "ClearPort 不保证进口放行、归类准确性或合规性。关税税率取决于正确的 HTS 归类，而这只能由持证报关行确认。在做出进口决策前，请务必与您的报关行及相关主管机关核实结论。",
  },
  terms_p4: {
    en: "ClearPort is provided “as is” for a private pilot, without warranties. Use is at your own risk.",
    zh: "ClearPort 以“现状”形式提供，用于私密试点，不附带任何保证。使用风险由您自行承担。",
  },

  // ── Import check result (new top section replacing risk scoring) ─────────
  imp_check_result: { en: "Import check result", zh: "进口检查结果" },
  imp_product: { en: "Product", zh: "产品" },
  imp_route: { en: "Route", zh: "路线" },
  imp_hts_label: { en: "HTS code", zh: "HTS 编码" },
  imp_overall_status: { en: "Overall status", zh: "总体状态" },
  imp_status_ready: { en: "Ready to prepare import", zh: "可准备进口" },
  imp_status_checks: { en: "Checks still required", zh: "仍需确认事项" },
  imp_status_donot: { en: "Do not import yet", zh: "暂勿进口" },
  imp_status_incomplete: { en: "Analysis incomplete", zh: "分析未完成" },
  imp_costs_title: { en: "Import costs", zh: "进口费用" },
  imp_costs_base: { en: "Base tariff (MFN)", zh: "基础关税（MFN）" },
  imp_costs_s301: { en: "Section 301 tariff", zh: "第301条关税" },
  imp_costs_s232: { en: "Section 232 tariff", zh: "第232条关税" },
  imp_costs_ad: { en: "Antidumping duty", zh: "反倾销税" },
  imp_costs_cvd: { en: "Countervailing duty", zh: "反补贴税" },
  imp_costs_total: { en: "Total tariff exposure", zh: "关税总敞口" },
  imp_costs_total_note: { en: "Total depends on confirmed rates above", zh: "总额取决于以上已确认税率" },
  imp_still_need: { en: "What we still need", zh: "仍需了解的信息" },
  imp_next: { en: "What to do next", zh: "下一步操作" },
  imp_findings: { en: "Detailed findings", zh: "详细调查结论" },
  imp_cost_confirmed: { en: "Confirmed", zh: "已确认" },
  imp_cost_may_apply: { en: "May apply — confirm", zh: "可能适用——请确认" },
  imp_cost_likely: { en: "Likely applies — confirm rate", zh: "很可能适用——请确认税率" },
  imp_cost_not_applicable: { en: "Not applicable", zh: "不适用" },
  imp_cost_unknown: { en: "Not confirmed", zh: "待确认" },
  imp_cost_unavailable: { en: "Source unavailable", zh: "来源不可用" },
  imp_no_coverage: { en: "Coverage data not available for this scan.", zh: "此次扫描无覆盖数据。" },

  // ── Misc ─────────────────────────────────────────────────────────────────
  banner_saved: { en: "Product saved for monitoring.", zh: "产品已保存以进行监测。" },
  err_generic: { en: "Something went wrong. Please try again.", zh: "出现问题，请重试。" },
} satisfies Record<string, { en: string; zh: string }>;

export type DictKey = keyof typeof DICT;

export function t(lang: Lang, key: DictKey): string {
  return DICT[key]?.[lang] ?? DICT[key]?.en ?? key;
}

// Localize a risk/severity level value coming from the backend ("High", "N/A"…).
export function tLevel(lang: Lang, level: string): string {
  const key = `lvl_${level}` as DictKey;
  return (DICT as Record<string, { en: string; zh: string }>)[key]?.[lang] ?? level;
}

// Localize a confidence value ("High" / "Medium" / "Low") using the same labels.
export function tConfidence(lang: Lang, level: string): string {
  return tLevel(lang, level);
}

// Localize a live source-status value ("Active", "Degraded"…).
export function tStatus(lang: Lang, status: string): string {
  const key = `st_${status}` as DictKey;
  return (DICT as Record<string, { en: string; zh: string }>)[key]?.[lang] ?? status;
}

// The English strings the homepage source list maps to, keyed by source name.
// (Source names themselves stay official/English per requirement 6.)
export const SOURCE_TYPE_KEYS: Record<string, DictKey> = {
  "Federal Register — CBP": "srctype_fr_cbp",
  "Federal Register — USTR": "srctype_fr_ustr",
  "Federal Register — USITC": "srctype_fr_usitc",
  "U.S. Customs and Border Protection": "srctype_cbp_news",
  "USITC Harmonized Tariff Schedule": "srctype_hts",
  "USTR Section 301": "srctype_ustr_301",
};
