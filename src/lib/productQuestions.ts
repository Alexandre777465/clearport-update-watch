/**
 * Client-side product question engine.
 *
 * Uses the shared factEngine for module detection so the same evidence
 * precedence rules apply as on the server: explicit negatives override
 * keyword inferences, and structured answers override everything.
 *
 * Module activation and question routing are fact-driven, not keyword-driven.
 */

import { extractFacts, activateFromFacts, MODULE_MANIFESTS } from "./factEngine";
import { normalizeProductTextForDetection } from "./chineseNormalization";

export type ModuleId =
  | "automotive"
  | "electronics"
  | "batteries"
  | "childrens"
  | "textiles"
  | "cosmetics"
  | "food"
  | "medical_devices"
  | "chemicals"
  | "furniture"
  | "sports";

export interface ProductQuestion {
  key: string;
  module: ModuleId;
  question: string;
  questionZh?: string;
  helpText?: string;
  helpTextZh?: string;
  options: Array<{ value: string; label: string; labelZh?: string }>;
  /** Only show this question if the given key already has one of these values */
  showIf?: { key: string; values: string[] };
}

export interface ProductAttrs {
  is_children?: boolean;
  has_battery?: boolean;
  is_electronic?: boolean;
  is_textile?: boolean;
  is_cosmetic?: boolean;
  is_food_contact?: boolean;
  is_supplement?: boolean;
}

/**
 * Pure function — uses the shared factEngine to determine active modules.
 * Supports structured question answers (knownFacts) so that negative
 * first-level answers deactivate their module and remove its questions.
 */
export function detectModules(
  htsDigits: string,
  productText: string,
  _attrs: ProductAttrs = {},  // kept for API compat; factEngine supersedes this
  knownFacts: Record<string, string> = {},
): Set<ModuleId> {
  const facts = extractFacts(htsDigits, normalizeProductTextForDetection(productText), knownFacts);
  const active = activateFromFacts(facts, MODULE_MANIFESTS);
  return new Set(active as ModuleId[]);
}

// ── Question bank ─────────────────────────────────────────────────────────────

const QUESTION_BANK: ProductQuestion[] = [
  // ── AUTOMOTIVE ─────────────────────────────────────────────────────────────
  {
    key: "vehicle_type",
    module: "automotive",
    question: "What type of vehicle does this part fit?",
    questionZh: "这个零部件适用于哪类车辆？",
    helpText: "Determines which FMVSS safety standard applies.",
    helpTextZh: "用于确定适用哪项 FMVSS 安全标准。",
    options: [
      { value: "passenger_vehicle", label: "Passenger car / light truck / SUV",          labelZh: "乘用车 / 轻型卡车 / SUV" },
      { value: "heavy_commercial",  label: "Medium/heavy commercial truck or bus",        labelZh: "中/重型商用卡车或大客车" },
      { value: "non_road",          label: "Non-road or agricultural equipment",          labelZh: "非道路或农业设备" },
      { value: "not_automotive",    label: "Not an automotive or vehicle part",           labelZh: "非汽车或车辆零部件" },
      { value: "unknown",           label: "I don't know",                               labelZh: "我不确定" },
    ],
  },
  {
    key: "brake_system_type",
    module: "automotive",
    question: "What brake system type does this part belong to?",
    questionZh: "这个零部件属于哪种制动系统？",
    helpText: "FMVSS 135 covers hydraulic brakes; FMVSS 121 covers air brakes.",
    helpTextZh: "FMVSS 135 适用于液压制动；FMVSS 121 适用于气压制动。",
    showIf: { key: "vehicle_type", values: ["passenger_vehicle", "heavy_commercial"] },
    options: [
      { value: "hydraulic", label: "Hydraulic brakes", labelZh: "液压制动" },
      { value: "air",       label: "Air brakes",       labelZh: "气压制动" },
      { value: "unknown",   label: "I don't know",     labelZh: "我不确定" },
    ],
  },

  // ── ELECTRONICS ────────────────────────────────────────────────────────────
  {
    key: "has_wireless_tx",
    module: "electronics",
    question: "Does this product contain a wireless transmitter?",
    questionZh: "该产品是否包含无线发射器？",
    helpText: "Wi-Fi, Bluetooth, Zigbee, cellular, NFC, active RFID — anything that intentionally broadcasts a radio signal.",
    helpTextZh: "Wi-Fi、蓝牙、Zigbee、蜂窝网络、NFC、主动 RFID——任何主动发射无线电信号的装置。",
    options: [
      { value: "yes",     label: "Yes — Wi-Fi, Bluetooth, cellular, or other radio", labelZh: "是——Wi-Fi、蓝牙、蜂窝或其他无线电" },
      { value: "no",      label: "No wireless transmitter (wired-only or passive)",  labelZh: "无无线发射器（仅有线或被动式）" },
      { value: "unknown", label: "I don't know",                                     labelZh: "我不确定" },
    ],
  },
  {
    key: "product_function",
    module: "electronics",
    question: "What is the primary function of this electronic product?",
    questionZh: "该电子产品的主要功能是什么？",
    options: [
      { value: "audio_speaker",          label: "Audio speaker or soundbar",                              labelZh: "音频扬声器或条形音箱" },
      { value: "headphones_earbuds",     label: "Headphones or earbuds",                                 labelZh: "头戴式耳机或入耳式耳机" },
      { value: "tv_monitor",             label: "TV or monitor",                                          labelZh: "电视或显示器" },
      { value: "computer_laptop_tablet", label: "Computer, laptop, or tablet",                           labelZh: "电脑、笔记本或平板" },
      { value: "router_modem",           label: "Router or modem",                                        labelZh: "路由器或调制解调器" },
      { value: "other_no_radio",         label: "Other electronic device",                               labelZh: "其他电子设备" },
      { value: "not_electronic",         label: "Not an electronic product — no electronic components",  labelZh: "非电子产品——不含任何电子元件" },
      { value: "unknown",                label: "I don't know / prefer not to say",                      labelZh: "我不确定" },
    ],
  },

  // ── BATTERIES ──────────────────────────────────────────────────────────────
  {
    key: "battery_type",
    module: "batteries",
    question: "What type of battery does this product contain?",
    questionZh: "该产品含有哪种类型的电池？",
    helpText: "Lithium batteries trigger UN 38.3 testing and DOT/IATA hazmat classification.",
    helpTextZh: "锂电池需进行 UN 38.3 测试，并须遵循 DOT/IATA 危险品分类规定。",
    options: [
      { value: "lithium_ion",     label: "Lithium-ion or lithium-polymer (rechargeable)", labelZh: "锂离子或锂聚合物（可充电）" },
      { value: "lithium_metal",   label: "Lithium metal (primary / non-rechargeable)",    labelZh: "锂金属（原电池/不可充电）" },
      { value: "lead_acid",       label: "Lead-acid",                                     labelZh: "铅酸电池" },
      { value: "other_chemistry", label: "Other battery chemistry",                        labelZh: "其他类型电池" },
      { value: "no_battery",      label: "No battery — does not contain any battery",     labelZh: "无电池——不含任何电池" },
      { value: "unknown",         label: "I don't know",                                  labelZh: "我不确定" },
    ],
  },
  {
    key: "battery_configuration",
    module: "batteries",
    question: "How is the battery shipped?",
    questionZh: "电池以何种方式运输？",
    helpText: "Each configuration has different DOT/IATA hazmat requirements and UN numbers.",
    helpTextZh: "不同配置对应不同的 DOT/IATA 危险品要求及 UN 编号。",
    showIf: { key: "battery_type", values: ["lithium_ion", "lithium_metal"] },
    options: [
      { value: "in_equipment",     label: "Installed inside the product (UN 3481)",                        labelZh: "安装在产品内部（UN 3481）" },
      { value: "with_equipment",   label: "Packed separately in the same box as the product (UN 3481)",   labelZh: "与产品一同包装但分开放置（UN 3481）" },
      { value: "standalone_loose", label: "Standalone — no accompanying product (UN 3480)",               labelZh: "独立运输——不附带产品（UN 3480）" },
      { value: "unknown",          label: "I don't know",                                                  labelZh: "我不确定" },
    ],
  },
  {
    key: "battery_wh",
    module: "batteries",
    question: "Approximate watt-hour (Wh) rating per cell or battery pack?",
    questionZh: "每节电芯或电池组的额定瓦时（Wh）约为？",
    helpText: "Wh rating determines quantity limits per package under IATA DGR.",
    helpTextZh: "Wh 额定值决定 IATA DGR 每包裹数量限制。",
    showIf: { key: "battery_type", values: ["lithium_ion", "lithium_metal"] },
    options: [
      { value: "under_2wh",       label: "Under 2 Wh per cell",          labelZh: "每节电芯低于 2 Wh" },
      { value: "2_to_20wh",       label: "2 – 20 Wh per cell",           labelZh: "每节电芯 2–20 Wh" },
      { value: "20_to_100wh",     label: "20 – 100 Wh per cell",         labelZh: "每节电芯 20–100 Wh" },
      { value: "over_100wh",      label: "Over 100 Wh per cell",         labelZh: "每节电芯超过 100 Wh" },
      { value: "over_300wh_pack", label: "Over 300 Wh per battery pack", labelZh: "每电池组超过 300 Wh" },
      { value: "unknown",         label: "I don't know",                  labelZh: "我不确定" },
    ],
  },

  // ── CHILDREN'S ─────────────────────────────────────────────────────────────
  {
    key: "age_range",
    module: "childrens",
    question: "What is the intended age range for this product?",
    questionZh: "该产品的适用年龄范围是？",
    helpText: "CPSIA third-party testing applies to products for children 12 and under.",
    helpTextZh: "CPSIA 第三方测试适用于 12 岁及以下儿童产品。",
    options: [
      { value: "under_3",          label: "Under 3 years",                               labelZh: "3 岁以下" },
      { value: "age_3_to_12",      label: "Ages 3 – 12",                                 labelZh: "3–12 岁" },
      { value: "over_12",          label: "Ages 13 and up",                              labelZh: "13 岁及以上" },
      { value: "not_for_children", label: "Not intended for children — adult product",   labelZh: "非儿童用品——成人产品" },
      { value: "unknown",          label: "I don't know / not age-specific",             labelZh: "我不确定" },
    ],
  },
  {
    key: "contains_paint_or_surface_coating",
    module: "childrens",
    question: "Does this product have any paint, surface coating, or dye applied?",
    questionZh: "该产品是否有涂料、表面涂层或染料？",
    helpText: "CPSIA limits lead in surface coatings to 90 ppm for children's products.",
    helpTextZh: "CPSIA 规定儿童产品表面涂层铅含量上限为 90 ppm。",
    showIf: { key: "age_range", values: ["under_3", "age_3_to_12"] },
    options: [
      { value: "yes",     label: "Yes — painted, coated, or dyed", labelZh: "是——有涂漆、涂层或染色" },
      { value: "no",      label: "No paint or coating",            labelZh: "无涂料或涂层" },
      { value: "unknown", label: "I don't know",                   labelZh: "我不确定" },
    ],
  },

  // ── TEXTILES ───────────────────────────────────────────────────────────────
  {
    key: "textile_type",
    module: "textiles",
    question: "Is this product a textile, apparel, or fabric item?",
    questionZh: "该产品是否为纺织品、服装或面料？",
    helpText: "FTC fiber content labeling and care labeling rules apply to textile products.",
    helpTextZh: "FTC 纤维成分标签和保养标签规则适用于纺织品。",
    options: [
      { value: "apparel_clothing",  label: "Apparel or clothing (shirt, pants, dress, etc.)", labelZh: "服装或衣物（衬衫、裤子、裙子等）" },
      { value: "home_textile",      label: "Home textile (towels, bedding, curtains)",         labelZh: "家纺（毛巾、床上用品、窗帘）" },
      { value: "footwear",          label: "Footwear with textile upper",                      labelZh: "含织物鞋面的鞋类" },
      { value: "other_textile",     label: "Other fabric or textile product",                  labelZh: "其他面料或纺织产品" },
      { value: "not_textile",       label: "Not a textile — no fabric content",                labelZh: "非纺织品——不含面料成分" },
      { value: "unknown",           label: "I don't know",                                     labelZh: "我不确定" },
    ],
  },

  // ── COSMETICS ──────────────────────────────────────────────────────────────
  {
    key: "contains_otc_ingredient",
    module: "cosmetics",
    question: "Does this product contain any active drug ingredients?",
    questionZh: "该产品是否含有任何活性药物成分？",
    helpText: "Sunscreen UV filters, benzoyl peroxide (acne), zinc pyrithione (antidandruff) make a cosmetic an OTC drug regulated under a separate FDA monograph.",
    helpTextZh: "防晒 UV 过滤剂、过氧化苯甲酰（祛痘）、吡啶硫酮锌（去屑）等成分可使化妆品被认定为 OTC 药物，须依据 FDA 专论单独监管。",
    options: [
      { value: "yes_sunscreen",     label: "Yes — sunscreen (SPF active ingredients)",                        labelZh: "是——防晒产品（含 SPF 活性成分）" },
      { value: "yes_acne",          label: "Yes — acne treatment (benzoyl peroxide, salicylic acid)",         labelZh: "是——祛痘产品（含过氧化苯甲酰、水杨酸）" },
      { value: "yes_antidandruff",  label: "Yes — antidandruff (zinc pyrithione, selenium sulfide)",          labelZh: "是——去屑产品（含吡啶硫酮锌、硫化硒）" },
      { value: "yes_other_drug",    label: "Yes — other OTC drug ingredient",                                 labelZh: "是——其他 OTC 药物成分" },
      { value: "no",                label: "No active drug ingredients — cosmetic only",                      labelZh: "不含活性药物成分——仅为化妆品" },
      { value: "not_cosmetic",      label: "Not a cosmetic — not a personal care or beauty product",          labelZh: "非化妆品——不属于个人护理或美妆产品" },
      { value: "unknown",           label: "I don't know",                                                    labelZh: "我不确定" },
    ],
  },

  // ── FOOD ───────────────────────────────────────────────────────────────────
  {
    key: "is_meat_or_poultry",
    module: "food",
    question: "Is this product meat, poultry, or an egg product?",
    questionZh: "该产品是肉类、禽类或蛋制品吗？",
    helpText: "Meat, poultry, and egg products are regulated by USDA/FSIS, not FDA. They require FSIS re-inspection at a USDA-approved port.",
    helpTextZh: "肉类、禽类和蛋制品由 USDA/FSIS 监管（而非 FDA），须在 USDA 批准的港口接受 FSIS 重新检验。",
    options: [
      { value: "yes_meat",    label: "Yes — red meat or game",                                                labelZh: "是——红肉或野味" },
      { value: "yes_poultry", label: "Yes — chicken, turkey, duck, or other poultry",                        labelZh: "是——鸡肉、火鸡、鸭肉或其他禽类" },
      { value: "yes_egg",     label: "Yes — processed egg products",                                          labelZh: "是——加工蛋制品" },
      { value: "no",          label: "No — other food or beverage",                                           labelZh: "否——其他食品或饮料" },
      { value: "not_food",    label: "Not a food product — not intended for consumption or food contact",     labelZh: "非食品——不用于消费或食品接触" },
      { value: "unknown",     label: "I don't know",                                                          labelZh: "我不确定" },
    ],
  },

  // ── MEDICAL DEVICES ────────────────────────────────────────────────────────
  {
    key: "fda_device_class",
    module: "medical_devices",
    question: "What is the FDA device classification for this product?",
    questionZh: "该产品的 FDA 医疗器械分类是？",
    helpText: "Class I = general controls only; Class II = 510(k) clearance required; Class III = PMA approval required.",
    helpTextZh: "I 类 = 仅适用一般控制；II 类 = 需 510(k) 上市前通知；III 类 = 需 PMA 上市前批准。",
    options: [
      { value: "class_1",            label: "Class I — general controls only (most exempt)",    labelZh: "I 类——仅适用一般控制（大多数豁免）" },
      { value: "class_2",            label: "Class II — 510(k) premarket notification required", labelZh: "II 类——需 510(k) 上市前通知" },
      { value: "class_3",            label: "Class III — PMA premarket approval required",       labelZh: "III 类——需 PMA 上市前批准" },
      { value: "not_medical_device", label: "Not a medical device — no medical intended use",    labelZh: "非医疗器械——无医疗用途" },
      { value: "unknown",            label: "I don't know",                                      labelZh: "我不确定" },
    ],
  },

  // ── CHEMICALS ──────────────────────────────────────────────────────────────
  {
    key: "is_pesticide_or_disinfectant",
    module: "chemicals",
    question: "Does this product make pesticidal or antimicrobial claims?",
    questionZh: "该产品是否具有农药或抗菌功效声明？",
    helpText: "Any claim to kill, repel, or control insects, bacteria, viruses, fungi, or weeds triggers EPA FIFRA registration.",
    helpTextZh: "任何声称能消灭、驱避或控制昆虫、细菌、病毒、真菌或杂草的产品均须进行 EPA FIFRA 注册。",
    options: [
      { value: "yes",                   label: "Yes — kills or controls pests, bacteria, viruses, or weeds", labelZh: "是——可消灭或控制害虫、细菌、病毒或杂草" },
      { value: "no",                    label: "No pesticidal or antimicrobial claims",                       labelZh: "不含农药或抗菌功效声明" },
      { value: "not_chemical_product",  label: "Not a chemical product — no hazardous chemical substance",   labelZh: "非化学品——不含危险化学物质" },
      { value: "unknown",               label: "I don't know",                                               labelZh: "我不确定" },
    ],
  },
  {
    key: "contains_hazmat",
    module: "chemicals",
    question: "Does this product contain hazardous materials?",
    questionZh: "该产品是否含有危险材料？",
    helpText: "Flammable, corrosive, toxic, or oxidizing substances require DOT hazmat classification and shipping documentation.",
    helpTextZh: "易燃、腐蚀性、有毒或氧化性物质须进行 DOT 危险品分类并提供运输文件。",
    showIf: { key: "is_pesticide_or_disinfectant", values: ["no"] },
    options: [
      { value: "yes",     label: "Yes — flammable, corrosive, toxic, or oxidizing", labelZh: "是——易燃、腐蚀性、有毒或氧化性物质" },
      { value: "no",      label: "No hazardous materials",                           labelZh: "不含危险材料" },
      { value: "unknown", label: "I don't know",                                    labelZh: "我不确定" },
    ],
  },

  // ── FURNITURE ──────────────────────────────────────────────────────────────
  {
    key: "contains_composite_wood",
    module: "furniture",
    question: "Does this product contain composite wood panels?",
    questionZh: "该产品是否含有复合木板？",
    helpText: "Particleboard, MDF, hardwood plywood, and thin-wood veneer panels must meet EPA TSCA Title VI formaldehyde emission standards (40 CFR Part 770).",
    helpTextZh: "刨花板、中密度纤维板（MDF）、硬木胶合板和薄木贴面板须符合 EPA TSCA 第 VI 章甲醛排放标准（40 CFR Part 770）。",
    options: [
      { value: "yes",            label: "Yes — contains particleboard, MDF, or hardwood plywood", labelZh: "是——含刨花板、MDF 或硬木胶合板" },
      { value: "no",             label: "No composite wood — solid wood, metal, or plastic only",  labelZh: "无复合木——仅含实木、金属或塑料" },
      { value: "not_applicable", label: "Does not contain wood of any kind",                       labelZh: "不含任何木质材料" },
      { value: "unknown",        label: "I don't know",                                            labelZh: "我不确定" },
    ],
  },
  {
    key: "has_upholstery",
    module: "furniture",
    question: "Does this product include upholstery or foam padding?",
    questionZh: "该产品是否含有软垫或泡沫填充？",
    showIf: { key: "contains_composite_wood", values: ["yes", "no", "unknown"] },
    options: [
      { value: "yes",     label: "Yes — fabric, leather, or foam upholstery", labelZh: "是——布料、皮革或泡沫软垫" },
      { value: "no",      label: "No upholstery",                             labelZh: "无软垫" },
      { value: "unknown", label: "I don't know",                              labelZh: "我不确定" },
    ],
  },

  // ── SPORTS & OUTDOOR EQUIPMENT ─────────────────────────────────────────────
  {
    key: "sports_product_type",
    module: "sports",
    question: "What type of sports or outdoor equipment is this?",
    questionZh: "这是什么类型的运动或户外设备？",
    helpText: "Determines which mandatory safety standards apply (CPSC, USCG, ASTM, etc.).",
    helpTextZh: "用于判断适用哪些强制性安全标准（CPSC、USCG、ASTM 等）。",
    options: [
      { value: "bicycle",               label: "Bicycle (includes e-bike)",                                          labelZh: "自行车（包括电动自行车）" },
      { value: "kayak_canoe",           label: "Kayak, canoe, or paddleboard",                                       labelZh: "皮划艇、独木舟或桨板" },
      { value: "surfboard_paddleboard", label: "Surfboard or stand-up paddleboard",                                  labelZh: "冲浪板或立式桨板" },
      { value: "climbing_equipment",    label: "Climbing / fall-arrest equipment",                                   labelZh: "攀岩/防坠落设备" },
      { value: "pfd_life_jacket",       label: "Life jacket / PFD / buoyancy aid",                                   labelZh: "救生衣 / PFD / 浮力辅助设备" },
      { value: "fitness_machine",       label: "Fitness machine (treadmill, elliptical, rower)",                     labelZh: "健身器械（跑步机、椭圆机、划船机）" },
      { value: "free_weights",          label: "Free weights / dumbbells / barbells / weight bench",                 labelZh: "自由重量/哑铃/杠铃/卧推凳" },
      { value: "combat_sports",         label: "Combat sports / martial arts equipment",                             labelZh: "格斗/武术装备" },
      { value: "snow_sports",           label: "Snow sports (skis, snowboard, poles, boots)",                        labelZh: "雪上运动装备（滑雪板、单板、雪杖、雪靴）" },
      { value: "water_sports",          label: "Water sports (wetsuit, fins, water ski, wakeboard)",                 labelZh: "水上运动装备（潜水服、脚蹼、水橇、尾波板）" },
      { value: "ball_racket_sports",    label: "Ball or racket sports (tennis, golf, soccer, baseball)",             labelZh: "球类或球拍运动用品（网球、高尔夫、足球、棒球）" },
      { value: "trampoline",            label: "Trampoline or gymnastics equipment",                                 labelZh: "蹦床或体操设备" },
      { value: "protective_gear",       label: "Protective gear (shin guards, knee/elbow pads, body armor)",         labelZh: "护具（护胫、护膝/护肘、护身甲）" },
      { value: "scuba_snorkel",         label: "SCUBA or snorkeling equipment",                                      labelZh: "水肺潜水或浮潜设备" },
      { value: "other_sports",          label: "Other sports or recreational equipment",                             labelZh: "其他运动或休闲设备" },
      { value: "not_sports",            label: "Not sports equipment — misclassified",                               labelZh: "不是运动设备——分类错误" },
      { value: "unknown",               label: "I don't know",                                                       labelZh: "我不确定" },
    ],
  },
  {
    key: "sports_helmet_type",
    module: "sports",
    question: "Does this product include a helmet or head protection?",
    questionZh: "该产品是否包含头盔或头部防护装置？",
    helpText: "Bicycle helmets require CPSC 16 CFR Part 1203 certification. Ski/snowboard helmets follow ASTM F2040.",
    helpTextZh: "自行车头盔须符合 CPSC 16 CFR Part 1203 认证；滑雪/单板头盔须遵循 ASTM F2040。",
    showIf: { key: "sports_product_type", values: ["bicycle", "snow_sports", "combat_sports", "other_sports"] },
    options: [
      { value: "bicycle_helmet",        label: "Bicycle helmet",                              labelZh: "自行车头盔" },
      { value: "ski_snowboard_helmet",  label: "Ski / snowboard helmet",                      labelZh: "滑雪/单板头盔" },
      { value: "motorcycle_helmet",     label: "Motorcycle helmet (DOT FMVSS 218)",           labelZh: "摩托车头盔（DOT FMVSS 218）" },
      { value: "other_helmet",          label: "Other head protection",                       labelZh: "其他头部防护" },
      { value: "no_helmet",             label: "No helmet — does not include head protection", labelZh: "无头盔——不含头部防护" },
      { value: "not_applicable",        label: "Not applicable",                              labelZh: "不适用" },
      { value: "unknown",               label: "I don't know",                               labelZh: "我不确定" },
    ],
  },
  {
    key: "pfd_type",
    module: "sports",
    question: "What USCG PFD type is this life jacket / flotation device?",
    questionZh: "该救生衣/浮力装置的 USCG PFD 类型是？",
    helpText: "46 CFR Part 160 requires USCG approval. Type I (offshore), II (near-shore), III (flotation aid), V (special use, may be inflatable).",
    helpTextZh: "46 CFR Part 160 要求 USCG 批准。I 型（离岸）、II 型（近岸）、III 型（浮力辅助）、V 型（特殊用途，可充气）。",
    showIf: { key: "sports_product_type", values: ["pfd_life_jacket", "kayak_canoe"] },
    options: [
      { value: "type_1",        label: "Type I — Offshore Life Jacket",              labelZh: "I 型——离岸救生衣" },
      { value: "type_2",        label: "Type II — Near-Shore Buoyant Vest",          labelZh: "II 型——近岸浮力背心" },
      { value: "type_3",        label: "Type III — Flotation Aid (kayaking, paddling)", labelZh: "III 型——浮力辅助（皮划艇、划桨）" },
      { value: "type_5",        label: "Type V — Special Use (inflatable, hybrid)",  labelZh: "V 型——特殊用途（充气式、混合型）" },
      { value: "not_pfd",       label: "Not a PFD — other water safety product",     labelZh: "非 PFD——其他水上安全产品" },
      { value: "not_applicable", label: "Not applicable",                            labelZh: "不适用" },
      { value: "unknown",       label: "I don't know",                               labelZh: "我不确定" },
    ],
  },
  {
    key: "climbing_equipment_type",
    module: "sports",
    question: "What type of climbing or fall-arrest equipment is this?",
    questionZh: "这是哪类攀岩或防坠落设备？",
    helpText: "Load-bearing fall-arrest equipment for occupational use must meet OSHA 29 CFR 1910.140. Recreational climbing follows voluntary UIAA/EN standards.",
    helpTextZh: "职业用承重防坠落设备须符合 OSHA 29 CFR 1910.140；休闲攀岩遵循 UIAA/EN 自愿性标准。",
    showIf: { key: "sports_product_type", values: ["climbing_equipment"] },
    options: [
      { value: "harness",            label: "Full-body or sit harness",                             labelZh: "全身式或坐式安全带" },
      { value: "rope",               label: "Dynamic or static climbing rope",                      labelZh: "动力绳或静力绳" },
      { value: "carabiner",          label: "Carabiner or snap hook",                               labelZh: "锁扣或快挂" },
      { value: "belay_device",       label: "Belay / rappel device",                               labelZh: "确保/下降器" },
      { value: "fall_arrest_system", label: "Self-retracting lifeline (SRL) / fall arrest system", labelZh: "自动收缩安全绳（SRL）/防坠落系统" },
      { value: "anchor",             label: "Anchor point / sling / anchor strap",                 labelZh: "锚点/吊带/锚固带" },
      { value: "not_applicable",     label: "Not applicable",                                      labelZh: "不适用" },
      { value: "unknown",            label: "I don't know",                                        labelZh: "我不确定" },
    ],
  },
  {
    key: "is_occupational",
    module: "sports",
    question: "Is this fall-arrest equipment intended for occupational use?",
    questionZh: "该防坠落设备是否用于职业（工作场所）用途？",
    helpText: "Occupational (workplace) fall protection triggers OSHA 29 CFR 1910.140. Consumer/recreational climbing uses voluntary UIAA and EN standards.",
    helpTextZh: "职业（工作场所）防坠保护须遵循 OSHA 29 CFR 1910.140；消费者/休闲攀岩适用 UIAA 和 EN 自愿性标准。",
    showIf: { key: "climbing_equipment_type", values: ["harness", "rope", "carabiner", "belay_device", "fall_arrest_system", "anchor"] },
    options: [
      { value: "yes_occupational",  label: "Yes — intended for workplace / occupational use", labelZh: "是——用于工作场所/职业用途" },
      { value: "yes_recreational",  label: "No — recreational climbing / consumer use only",  labelZh: "否——仅用于休闲攀岩/消费者用途" },
      { value: "unknown",           label: "I don't know",                                    labelZh: "我不确定" },
    ],
  },
  {
    key: "water_sports_type",
    module: "sports",
    question: "What type of watercraft or water-sports product is this?",
    questionZh: "这是哪类水上交通工具或水上运动产品？",
    showIf: { key: "sports_product_type", values: ["kayak_canoe", "surfboard_paddleboard", "water_sports"] },
    options: [
      { value: "kayak",                  label: "Kayak (hard shell)",                     labelZh: "皮划艇（硬壳）" },
      { value: "inflatable_kayak",       label: "Kayak (inflatable)",                     labelZh: "皮划艇（充气式）" },
      { value: "canoe",                  label: "Canoe",                                  labelZh: "独木舟" },
      { value: "surfboard",              label: "Surfboard (hard)",                        labelZh: "冲浪板（硬壳）" },
      { value: "paddleboard",            label: "Stand-up paddleboard (hard)",             labelZh: "立式桨板（硬壳）" },
      { value: "inflatable_paddleboard", label: "Stand-up paddleboard (inflatable)",       labelZh: "立式桨板（充气式）" },
      { value: "wetsuit",                label: "Wetsuit or drysuit",                     labelZh: "潜水服或干式潜水服" },
      { value: "scuba",                  label: "SCUBA gear",                             labelZh: "水肺潜水装备" },
      { value: "other_water",            label: "Other water sports equipment",            labelZh: "其他水上运动设备" },
      { value: "not_applicable",         label: "Not applicable",                         labelZh: "不适用" },
      { value: "unknown",                label: "I don't know",                           labelZh: "我不确定" },
    ],
  },
  {
    key: "protective_gear_type",
    module: "sports",
    question: "What type of protective gear is this?",
    questionZh: "这是哪类护具？",
    showIf: { key: "sports_product_type", values: ["protective_gear", "combat_sports"] },
    options: [
      { value: "shin_guard",       label: "Shin guard",                      labelZh: "护胫" },
      { value: "knee_pad",         label: "Knee pad",                        labelZh: "护膝" },
      { value: "elbow_pad",        label: "Elbow pad",                       labelZh: "护肘" },
      { value: "body_armor",       label: "Body armor / chest protector",    labelZh: "护身甲/胸部防护" },
      { value: "head_guard",       label: "Head guard (boxing, martial arts)", labelZh: "头部护具（拳击、武术）" },
      { value: "face_guard",       label: "Face guard or mask",              labelZh: "面罩或面具" },
      { value: "mouthguard",       label: "Mouthguard",                      labelZh: "护齿套" },
      { value: "other_protective", label: "Other protective gear",           labelZh: "其他护具" },
      { value: "not_applicable",   label: "Not applicable",                  labelZh: "不适用" },
      { value: "unknown",          label: "I don't know",                    labelZh: "我不确定" },
    ],
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the ordered list of clarification questions relevant to the given
 * product. Uses the fact engine so that previous answers (knownFacts) can
 * deactivate modules and suppress their questions in real time.
 */
export function getQuestionsForProduct(
  htsDigits: string,
  productText: string,
  attrs: ProductAttrs = {},
  knownFacts: Record<string, string> = {},
): ProductQuestion[] {
  // Map explicit false booleans to negative structured answers so that a user
  // unchecking "Electronic product" (etc.) immediately suppresses that module's
  // questions without waiting for a full scan round-trip.
  // is_children is EXCLUDED: the checkbox is never exposed in the UI so false is
  // always the default, never an explicit denial. Children's suppression comes from
  // the age_range dynamic question answer.
  const attrOverrides: Record<string, string> = {};
  if (attrs.is_electronic  === false) attrOverrides['product_function']        = 'not_electronic';
  if (attrs.has_battery    === false) attrOverrides['battery_type']             = 'no_battery';
  // is_children === false intentionally NOT mapped — see comment above.
  if (attrs.is_textile     === false) attrOverrides['textile_type']             = 'not_textile';
  if (attrs.is_cosmetic    === false) attrOverrides['contains_otc_ingredient']  = 'not_cosmetic';
  if (attrs.is_food_contact === false) attrOverrides['food_contact_use']        = 'no';
  const mergedFacts = { ...attrOverrides, ...knownFacts };
  const modules = detectModules(htsDigits, productText, attrs, mergedFacts);
  return QUESTION_BANK.filter((q) => modules.has(q.module));
}

/**
 * Maps collected question answers to the boolean product attribute flags
 * the backend needs in the watchlist entry.
 */
export function answersToAttrs(answers: Record<string, string>): ProductAttrs {
  const attrs: ProductAttrs = {};

  if (
    answers.has_wireless_tx === 'yes' ||
    (answers.product_function && answers.product_function !== 'not_electronic' && answers.product_function !== 'unknown')
  ) {
    attrs.is_electronic = true;
  }

  if (
    answers.battery_type &&
    answers.battery_type !== 'no_battery' &&
    answers.battery_type !== 'unknown'
  ) {
    attrs.has_battery = true;
  }

  if (answers.age_range === 'under_3' || answers.age_range === 'age_3_to_12') {
    attrs.is_children = true;
  }

  if (
    answers.contains_otc_ingredient !== undefined &&
    answers.contains_otc_ingredient !== 'not_cosmetic'
  ) {
    attrs.is_cosmetic = true;
  }

  if (answers.is_meat_or_poultry !== undefined && answers.is_meat_or_poultry !== 'not_food') {
    attrs.is_food_contact = true;
  }

  return attrs;
}
