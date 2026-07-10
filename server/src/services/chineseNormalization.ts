/**
 * Chinese product text normalization for deterministic module detection.
 *
 * English regex patterns in factEngine can't match Chinese characters.
 * This utility appends English keyword equivalents when Chinese text is
 * detected, so the same regex-based detection pipeline works for both
 * English and Chinese product descriptions.
 *
 * The original text is preserved — only English keywords are appended.
 * Chinese characters stay in the string so HTS-based and structured-answer
 * facts are unaffected.
 */

// Longer / more specific phrases must come before their substrings.
const ZH_TO_EN: ReadonlyArray<[string, string]> = [
  // ── Sports / bicycles ──────────────────────────────────────────────────────
  ['山地自行车',        'mountain bicycle mountain bike'],
  ['儿童自行车',        'children bicycle child bicycle'],
  ['电动自行车',        'electric bicycle e-bike'],
  ['自行车头盔',        'bicycle helmet'],
  ['自行车',           'bicycle bike'],
  ['头盔',             'helmet head protection'],
  ['安全帽',           'safety helmet'],
  ['头部保护',          'head protection'],
  // ── Children / adults ─────────────────────────────────────────────────────
  // Negative child phrases must come before positive substring matches so the
  // factEngine's negativeRe ("not for children", "adults only", "not a children")
  // is present in the normalized text alongside any positive substring matches.
  // factEngine precedence (negative > positive) resolves the conflict correctly.
  ['不是儿童产品',       'not a children product'],
  ['不面向儿童销售',     'not for children'],
  ['不面向儿童',        'not for children'],
  ['不适用于儿童',      'not for children not intended for children'],
  ['仅适用于成人',      'adults only for adults only'],
  ['成人专用',         'adults only'],
  ['仅成人使用',       'adults only'],
  // Positive child phrases (explicit "for children" triggers positiveRe)
  ['面向儿童销售',      'for children sold to children'],
  ['适用于儿童',       'for children intended for children'],
  ['12岁以下',         'for children under 12 children'],
  ['适用于5至12岁儿童', 'for children ages 5 to 12 children'],
  ['儿童产品',         'children child product'],
  ['婴儿',            'infant baby children child'],
  ['幼儿',            'infant toddler children child'],
  ['儿童',            'children child'],
  ['小孩',            'children child'],
  ['成人',            'adult'],
  // ── Other sports equipment ─────────────────────────────────────────────────
  ['踏板车',            'scooter'],
  ['滑板车',            'kick scooter'],
  ['滑板',             'skateboard'],
  ['内联轮滑鞋',        'inline skates'],
  ['溜冰鞋',           'ice skates roller skates'],
  ['网球拍',            'tennis racket'],
  ['羽毛球拍',          'badminton racket'],
  ['乒乓球拍',          'table tennis racket ping pong paddle'],
  ['高尔夫球杆',        'golf club'],
  ['棒球棒',            'baseball bat'],
  ['冰球棒',            'hockey stick'],
  ['冲浪板',            'surfboard'],
  ['划桨板',            'paddleboard'],
  ['皮划艇',            'kayak'],
  ['独木舟',            'canoe'],
  ['蹦床',             'trampoline'],
  ['跑步机',            'treadmill'],
  ['椭圆机',            'elliptical'],
  ['划船机',            'rowing machine'],
  ['哑铃',             'dumbbell'],
  ['杠铃',             'barbell'],
  ['攀岩',             'rock climbing climbing harness'],
  ['登山',             'mountaineering climbing'],
  ['单板滑雪',          'snowboard'],
  ['滑雪',             'skiing ski'],
  ['射箭',             'archery bow'],
  ['拳击手套',          'boxing gloves'],
  ['武术',             'martial arts combat sports'],
  ['格斗',             'combat sports'],
  ['护腿',             'shin guard'],
  ['护膝',             'knee pad knee guard'],
  ['护肘',             'elbow pad elbow guard'],
  ['护具',             'protective gear protective equipment'],
  ['潜水',             'diving scuba'],
  ['浮潜',             'snorkeling'],
  ['救生衣',            'life jacket personal flotation device PFD'],
  ['浮力辅助装置',       'buoyancy aid personal flotation device PFD'],
  ['体育器材',          'sports equipment sports goods'],
  ['运动器材',          'sports equipment fitness equipment'],
  ['健身器材',          'fitness equipment gym equipment'],
  // ── Electronics / battery ─────────────────────────────────────────────────
  ['锂电池',            'lithium battery battery'],
  ['电池',             'battery'],
  ['蓝牙',             'bluetooth wireless'],
  ['无线',             'wireless'],
  ['充电',             'rechargeable charger'],
  ['电子元件',          'electronic component electronics'],
  ['电子',             'electronic'],
  ['手机',             'mobile phone smartphone'],
  ['耳机',             'headphones earphones'],
  ['音响',             'speaker'],
  // ── Textiles / clothing ───────────────────────────────────────────────────
  ['服装',             'clothing apparel garment'],
  ['衣服',             'clothing apparel'],
  ['纺织品',            'textile fabric'],
  // ── Cosmetics ─────────────────────────────────────────────────────────────
  ['化妆品',            'cosmetic makeup'],
  ['护肤品',            'skin care skincare'],
  ['香水',             'perfume fragrance'],
  // ── Food ──────────────────────────────────────────────────────────────────
  ['食品',             'food'],
  ['食物',             'food'],
  // ── Negative signals (must come before positive matches for same roots) ───
  ['非电动',            'non-electric'],
  ['不含电池',          'no battery battery-free'],
  ['无电池',            'no battery battery-free'],
  ['不含电子元件',       'no electronics'],
  ['无电子元件',         'no electronics'],
  ['不含电子',          'no electronics non-electronic'],
  ['无电子',            'no electronics non-electronic'],
];

function hasChinese(text: string): boolean {
  return /[一-鿿㐀-䶿]/.test(text);
}

/**
 * If `text` contains Chinese characters, appends English keyword equivalents
 * so that English regex patterns in factEngine can match them.
 *
 * Returns the original string unchanged when no Chinese is detected.
 */
export function normalizeProductTextForDetection(text: string): string {
  if (!hasChinese(text)) return text;

  const appendParts: string[] = [];
  for (const [zh, en] of ZH_TO_EN) {
    if (text.includes(zh)) {
      appendParts.push(en);
    }
  }

  return appendParts.length === 0 ? text : `${text} ${appendParts.join(' ')}`;
}
