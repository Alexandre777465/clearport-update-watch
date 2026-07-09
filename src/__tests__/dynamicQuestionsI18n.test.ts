/**
 * Regression tests for Chinese i18n of dynamic clarification questions.
 *
 * Verified:
 * - Sports module question title/options render in Chinese when lang=zh.
 * - All other modules have zh translations on question/options.
 * - Internal `value` fields are unchanged regardless of language.
 * - "我不确定" maps to the same internal value as "I don't know".
 * - English mode is unaffected (labels stay English).
 * - Adult Chinese bicycle helmet still triggers correct question flow
 *   (sports module activates → sports_product_type question present).
 */

import { describe, test, expect } from "bun:test";
import {
  getQuestionsForProduct,
  type ProductQuestion,
} from "../lib/productQuestions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLabel(q: ProductQuestion, value: string, lang: "en" | "zh"): string | undefined {
  const opt = q.options.find((o) => o.value === value);
  if (!opt) return undefined;
  return lang === "zh" ? (opt.labelZh ?? opt.label) : opt.label;
}

function getQuestion(q: ProductQuestion, lang: "en" | "zh"): string {
  return lang === "zh" ? (q.questionZh ?? q.question) : q.question;
}

function getHelpText(q: ProductQuestion, lang: "en" | "zh"): string | undefined {
  return lang === "zh" ? (q.helpTextZh ?? q.helpText) : q.helpText;
}

// ── Sports module: Chinese labels ─────────────────────────────────────────────

describe("sports module: Chinese question text", () => {
  const hts = "6506103045";
  const productText = "成人自行车头盔 非电动 不含电池 不含电子元件";
  const questions = getQuestionsForProduct(hts, productText);
  const sportsQ = questions.find((q) => q.key === "sports_product_type");

  test("sports module is detected for Chinese bicycle helmet input", () => {
    expect(questions.some((q) => q.module === "sports")).toBe(true);
  });

  test("sports_product_type question has Chinese translation", () => {
    expect(sportsQ).toBeDefined();
    expect(getQuestion(sportsQ!, "zh")).toBe("这是什么类型的运动或户外设备？");
  });

  test("sports_product_type question stays English in en mode", () => {
    expect(getQuestion(sportsQ!, "en")).toBe("What type of sports or outdoor equipment is this?");
  });

  test("sports helpText has Chinese translation", () => {
    const zh = getHelpText(sportsQ!, "zh");
    expect(zh).toContain("CPSC");
    expect(zh).toContain("USCG");
    expect(zh).toContain("ASTM");
    expect(zh).not.toContain("Determines");
  });

  test("'bicycle' option shows Chinese label in zh mode", () => {
    expect(getLabel(sportsQ!, "bicycle", "zh")).toBe("自行车（包括电动自行车）");
  });

  test("'bicycle' option keeps English label in en mode", () => {
    expect(getLabel(sportsQ!, "bicycle", "en")).toBe("Bicycle (includes e-bike)");
  });

  test("all sports options have Chinese labels", () => {
    for (const opt of sportsQ!.options) {
      expect(opt.labelZh).toBeDefined();
      expect(opt.labelZh!.length).toBeGreaterThan(0);
    }
  });

  test("'unknown' option Chinese label is '我不确定'", () => {
    expect(getLabel(sportsQ!, "unknown", "zh")).toBe("我不确定");
  });
});

// ── Internal values are unchanged ─────────────────────────────────────────────

describe("internal option values are unchanged regardless of language", () => {
  const hts = "6506103045";
  const productText = "成人自行车头盔";
  const questions = getQuestionsForProduct(hts, productText);

  test("sports_product_type 'bicycle' value is unchanged", () => {
    const q = questions.find((q) => q.key === "sports_product_type");
    const opt = q!.options.find((o) => o.labelZh === "自行车（包括电动自行车）");
    expect(opt?.value).toBe("bicycle");
  });

  test("sports_product_type 'unknown' value is unchanged", () => {
    const q = questions.find((q) => q.key === "sports_product_type");
    const opt = q!.options.find((o) => o.labelZh === "我不确定");
    expect(opt?.value).toBe("unknown");
  });

  test("'我不确定' maps to the same value as 'I don't know' for every question", () => {
    for (const q of questions) {
      const unknownOpt = q.options.find((o) => o.value === "unknown");
      if (!unknownOpt) continue;
      expect(unknownOpt.labelZh).toBe("我不确定");
      expect(unknownOpt.label).toContain("don't know");
    }
  });
});

// ── All modules have Chinese translations ─────────────────────────────────────

describe("every question in QUESTION_BANK has zh fields", () => {
  // Build all questions by querying with various HTS/text combos
  const ALL_QUESTIONS_HTS_TEXT: [string, string][] = [
    ["8712002500", "bicycle adult"],           // sports
    ["8711000000", "motorcycle"],              // automotive
    ["8518220000", "bluetooth speaker battery"], // electronics + batteries
    ["9503000000", "toy children"],            // childrens
    ["6109100010", "cotton t-shirt apparel"],  // textiles
    ["3304100000", "lipstick cosmetic"],       // cosmetics
    ["0201100000", "fresh beef meat"],         // food
    ["9018100000", "medical diagnostic device"], // medical_devices
    ["3808940000", "pesticide herbicide"],     // chemicals
    ["9403600000", "composite wood MDF sofa"], // furniture
  ];

  const seen = new Set<string>();
  for (const [hts, text] of ALL_QUESTIONS_HTS_TEXT) {
    const qs = getQuestionsForProduct(hts, text);
    for (const q of qs) {
      seen.add(q.key);
    }
  }

  test("all modules produce questions that have questionZh", () => {
    for (const [hts, text] of ALL_QUESTIONS_HTS_TEXT) {
      const qs = getQuestionsForProduct(hts, text);
      for (const q of qs) {
        expect(q.questionZh).toBeDefined();
        expect(q.questionZh!.length).toBeGreaterThan(0);
      }
    }
  });

  test("all options have labelZh", () => {
    for (const [hts, text] of ALL_QUESTIONS_HTS_TEXT) {
      const qs = getQuestionsForProduct(hts, text);
      for (const q of qs) {
        for (const opt of q.options) {
          expect(opt.labelZh).toBeDefined();
          expect(opt.labelZh!.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("all questionZh strings contain Chinese characters", () => {
    for (const [hts, text] of ALL_QUESTIONS_HTS_TEXT) {
      const qs = getQuestionsForProduct(hts, text);
      for (const q of qs) {
        expect(/[一-鿿]/.test(q.questionZh!)).toBe(true);
      }
    }
  });
});

// ── Specific module Chinese question texts ─────────────────────────────────────

describe("each module has correct Chinese question text", () => {
  const cases: [string, string, string, string][] = [
    ["6109100010", "cotton t-shirt", "textile_type",              "该产品是否为纺织品、服装或面料？"],
    ["9503000000", "children toy",   "age_range",                 "该产品的适用年龄范围是？"],
    ["8518220000", "bluetooth speaker", "has_wireless_tx",        "该产品是否包含无线发射器？"],
    ["8507600000", "lithium battery",   "battery_type",           "该产品含有哪种类型的电池？"],
    ["3304100000", "lipstick cosmetic", "contains_otc_ingredient", "该产品是否含有任何活性药物成分？"],
    ["0201100000", "fresh beef",        "is_meat_or_poultry",     "该产品是肉类、禽类或蛋制品吗？"],
    ["9018100000", "medical device",    "fda_device_class",       "该产品的 FDA 医疗器械分类是？"],
    ["3808940000", "pesticide",         "is_pesticide_or_disinfectant", "该产品是否具有农药或抗菌功效声明？"],
    ["9403600000", "MDF furniture",     "contains_composite_wood", "该产品是否含有复合木板？"],
    ["8711000000", "motorcycle part",   "vehicle_type",            "这个零部件适用于哪类车辆？"],
  ];

  for (const [hts, text, questionKey, expectedZh] of cases) {
    test(`${questionKey} → "${expectedZh}"`, () => {
      const questions = getQuestionsForProduct(hts, text);
      const q = questions.find((q) => q.key === questionKey);
      expect(q).toBeDefined();
      expect(getQuestion(q!, "zh")).toBe(expectedZh);
    });
  }
});

// ── Chinese adult bicycle helmet: correct question flow ────────────────────────

describe("Chinese adult bicycle helmet: question flow in zh mode", () => {
  const hts = "6506103045";
  const text = "成人自行车头盔 非电动 不含电池 不含电子元件";

  test("sports module question appears", () => {
    const qs = getQuestionsForProduct(hts, text);
    const keys = qs.map((q) => q.key);
    expect(keys).toContain("sports_product_type");
  });

  test("selecting 'bicycle' value (Chinese UI) shows sports_helmet_type follow-up", () => {
    const qs = getQuestionsForProduct(hts, text, {}, { sports_product_type: "bicycle" });
    const keys = qs.map((q) => q.key);
    expect(keys).toContain("sports_helmet_type");
  });

  test("sports_helmet_type 'bicycle_helmet' option has correct Chinese label", () => {
    const qs = getQuestionsForProduct(hts, text, {}, { sports_product_type: "bicycle" });
    const q = qs.find((q) => q.key === "sports_helmet_type");
    expect(getLabel(q!, "bicycle_helmet", "zh")).toBe("自行车头盔");
  });

  test("selecting 'bicycle_helmet' value submits same internal value in both modes", () => {
    const q = getQuestionsForProduct(hts, text, {}, { sports_product_type: "bicycle" })
      .find((q) => q.key === "sports_helmet_type");
    const enOpt = q!.options.find((o) => o.label === "Bicycle helmet");
    const zhOpt = q!.options.find((o) => o.labelZh === "自行车头盔");
    expect(enOpt?.value).toBe("bicycle_helmet");
    expect(zhOpt?.value).toBe("bicycle_helmet");
    expect(enOpt?.value).toBe(zhOpt?.value);
  });

  test("childrens module does NOT activate for adult helmet", () => {
    const qs = getQuestionsForProduct(hts, text);
    expect(qs.some((q) => q.module === "childrens")).toBe(false);
  });
});

// ── English mode unchanged ─────────────────────────────────────────────────────

describe("English mode: all labels remain English", () => {
  const qs = getQuestionsForProduct("6506103045", "bicycle helmet adult");

  test("sports_product_type question is English in en mode", () => {
    const q = qs.find((q) => q.key === "sports_product_type");
    expect(getQuestion(q!, "en")).toBe("What type of sports or outdoor equipment is this?");
  });

  test("bicycle option is English in en mode", () => {
    const q = qs.find((q) => q.key === "sports_product_type");
    expect(getLabel(q!, "bicycle", "en")).toBe("Bicycle (includes e-bike)");
  });

  test("unknown option is English in en mode", () => {
    const q = qs.find((q) => q.key === "sports_product_type");
    expect(getLabel(q!, "unknown", "en")).toBe("I don't know");
  });
});
