/**
 * Universal fact engine.
 *
 * Extracts tri-state facts from product data (HTS code, free text, and
 * structured clarification answers) and drives regulatory module activation.
 *
 * Evidence precedence (highest → lowest):
 *   1. structured_answer  — an explicit answer from the clarification step
 *   2. explicit_negative  — "no battery", "battery-free", etc. in text
 *   3. explicit_positive  — "Bluetooth speaker", "lithium battery", etc.
 *   4. hts_indication     — HTS prefix strongly implies a fact
 *   5. inference          — keyword-based, lower confidence
 *   6. default            — unknown, no evidence
 *
 * A higher-precedence source always wins over a lower one.
 *
 * Rules enforced:
 *   - "magnetic toy" → intended_for_children yes; contains_battery stays unknown.
 *   - "food-safe plastic container" → food_contact yes; contains_food stays unknown.
 *   - "medical-grade" alone → medical_intended_use unknown (not yes).
 *   - Negative answer "No battery" (structured_answer) overrides any inference.
 */

// ── Fact keys ─────────────────────────────────────────────────────────────────

export type FactKey =
  | 'contains_battery'
  | 'contains_electronics'
  | 'contains_wireless_transmitter'
  | 'intended_for_children'
  | 'contains_magnets'
  | 'contains_food'
  | 'food_contact'
  | 'contains_cosmetic'
  | 'contains_chemical'
  | 'contains_textile'
  | 'contains_wood'
  | 'medical_intended_use'
  | 'is_automotive_part'
  // ── Sports & Outdoor facts ─────────────────────────────────────────────────
  | 'is_sports_equipment'
  | 'head_protection'
  | 'flotation_or_lifesaving'
  | 'load_bearing'
  | 'climbing_or_fall_arrest'
  | 'inflatable'
  | 'intended_for_water'
  | 'protective_equipment';

export const ALL_FACT_KEYS: readonly FactKey[] = [
  'contains_battery',
  'contains_electronics',
  'contains_wireless_transmitter',
  'intended_for_children',
  'contains_magnets',
  'contains_food',
  'food_contact',
  'contains_cosmetic',
  'contains_chemical',
  'contains_textile',
  'contains_wood',
  'medical_intended_use',
  'is_automotive_part',
  'is_sports_equipment',
  'head_protection',
  'flotation_or_lifesaving',
  'load_bearing',
  'climbing_or_fall_arrest',
  'inflatable',
  'intended_for_water',
  'protective_equipment',
];

// ── Fact type ─────────────────────────────────────────────────────────────────

export type FactValue = 'yes' | 'no' | 'unknown';

export type FactSource =
  | 'structured_answer'
  | 'explicit_negative'
  | 'explicit_positive'
  | 'hts_indication'
  | 'inference'
  | 'default';

const SOURCE_PRECEDENCE: Record<FactSource, number> = {
  structured_answer: 6,
  explicit_negative: 5,
  explicit_positive: 4,
  hts_indication: 3,
  inference: 2,
  default: 1,
};

export interface TriStateFact {
  readonly value: FactValue;
  readonly source: FactSource;
  readonly confidence: number;     // 0–1
  readonly supporting_text?: string;
}

export type FactSet = Record<FactKey, TriStateFact>;

const DEFAULT_FACT: TriStateFact = { value: 'unknown', source: 'default', confidence: 0 };

export function defaultFacts(): FactSet {
  return Object.fromEntries(ALL_FACT_KEYS.map((k) => [k, DEFAULT_FACT])) as FactSet;
}

// ── Module manifest ───────────────────────────────────────────────────────────

export interface ModuleManifest {
  /** Module ID — matches CategoryId / ModuleId in other files */
  readonly id: string;
  /**
   * Module activates when ANY required fact is:
   *  - 'yes', OR
   *  - 'unknown' with a non-default source (evidence exists but unresolved)
   */
  readonly requiredFacts: readonly FactKey[];
  /** If ANY exclusion fact is 'yes', the module does not activate. */
  readonly exclusionFacts?: readonly FactKey[];
}

export const MODULE_MANIFESTS: readonly ModuleManifest[] = [
  { id: 'automotive',      requiredFacts: ['is_automotive_part'] },
  { id: 'electronics',     requiredFacts: ['contains_electronics'] },
  { id: 'batteries',       requiredFacts: ['contains_battery'] },
  { id: 'childrens',       requiredFacts: ['intended_for_children'] },
  { id: 'textiles',        requiredFacts: ['contains_textile'] },
  { id: 'cosmetics',       requiredFacts: ['contains_cosmetic'] },
  { id: 'food',            requiredFacts: ['contains_food', 'food_contact'] },
  { id: 'medical_devices', requiredFacts: ['medical_intended_use'] },
  { id: 'chemicals',       requiredFacts: ['contains_chemical'] },
  { id: 'furniture',       requiredFacts: ['contains_wood'] },
  { id: 'sports',          requiredFacts: ['is_sports_equipment', 'climbing_or_fall_arrest', 'flotation_or_lifesaving'] },
];

// ── Text rules ────────────────────────────────────────────────────────────────

interface TextRules {
  /** Patterns in product text that set the fact to 'no' (explicit_negative). */
  readonly negativeRe?: RegExp;
  /** Patterns in product text that set the fact to 'yes' (explicit_positive). */
  readonly positiveRe?: RegExp;
  /** Weaker patterns (inference). Only fires if no higher-level rule matched. */
  readonly inferenceRe?: RegExp;
}

const TEXT_RULES: Readonly<Record<FactKey, TextRules>> = {
  contains_battery: {
    negativeRe:
      /\bno\s+batter(?:y|ies)\b|\bbattery[-\s]?free\b|\bwithout\s+(?:a\s+)?batter(?:y|ies)\b|\bsold\s+without\s+batter(?:y|ies)\b|\bdoes\s+not\s+contain\s+a?\s*batter(?:y|ies)\b|\bbatter(?:y|ies)\s+not\s+included\b|\bno\s+internal\s+batter(?:y|ies)\b/i,
    positiveRe:
      /\blithium[-\s](?:ion|polymer|metal|battery)\b|\bli[-\s]?(?:ion|poly)\b|\brechargeable\s+batter(?:y|ies)\b|\bbattery\s+(?:pack|cell|included|built[-\s]in)\b|\blead[-\s]?acid\s+batter(?:y|ies)\b|\bpower\s+bank\b|\baccumulator\b|\bbuilt[-\s]in\s+(?:rechargeable\s+)?batter(?:y|ies)\b/i,
    // Bare "battery" is omitted intentionally — appearing alone it is too
    // ambiguous (e.g., "No electronics, battery, …" lists a negative).
    inferenceRe:
      /\bbattery[-\s]?(?:powered|operated|backup|compartment)\b|\bcordless\b|\brechargeable\b/i,
  },

  contains_electronics: {
    negativeRe:
      /\bno\s+electronics?\b|\bnon[-\s]?electronic\b|\bnot\s+(?:an?\s+)?electronic\b|\bdoes\s+not\s+contain\s+electronics?\b|\bpassive\s+(?:mechanical\s+)?device\b|\bpurely\s+mechanical\b/i,
    positiveRe:
      /\belectronic[s]?\b|\bprinted\s*circuit\b|\bcircuit\s*board\b|\bpcb\b|\bsemiconductor\b|\bdigital\s+(?:display|circuit|controller|thermostat|thermometer|meter|scale|sensor|timer)\b|\bpower\s+(?:supply|adapter|converter)\b|\busb\s+(?:powered|charger|hub|port)\b|\bcharger\b/i,
    inferenceRe:
      /\bbluetooth\b|\bwi[-\s]?fi\b|\bwireless\b|\bsensor\b|\bLED\s+(?:light|strip|panel)\b|\bsmart\b|\bdigital\b/i,
  },

  contains_wireless_transmitter: {
    negativeRe:
      /\bno\s+wireless\b|\bwired[- ]only\b|\bno\s+radio\b|\bno\s+transmitter\b|\bpassive\b|\bno\s+bluetooth\b|\bbluetooth\s+disabled\b/i,
    positiveRe:
      /\bbluetooth\b|\bwi[-\s]?fi\b|\bwifi\b|\bwireless\s+(?:radio|transmitter|speaker|headphone|earphone|keyboard|mouse|charging)\b|\bZigbee\b|\bZ[-\s]?Wave\b|\bcellular\b|\bLTE\b|\b5G\s+capable\b|\bNFC\s+transmitter\b|\bactive\s+RFID\b|\b2\.4\s*GHz\s+(?:radio|wireless)\b|\b5\s*GHz\s+(?:radio|wireless)\b/i,
    inferenceRe: undefined,   // wireless transmitter requires an explicit signal
  },

  intended_for_children: {
    negativeRe:
      /\bnot\s+(?:intended\s+)?for\s+children\b|\badult[s]?\s+only\b|\bfor\s+adults?\s+only\b|\bages?\s+1[3-9]\b|\b18\s*\+\b|\bnot\s+a\s+(?:children|toy)\b/i,
    positiveRe:
      /\bchildren'?s?\b|\bkids'?\b|\bfor\s+(?:kids?|children|toddlers?|infants?|babies)\b|\btoy\b|\btoys\b|\bdoll\b|\bjuvenile\b|\bnursery\b|\binfant\b|\btoddler\b|\bstroller\b|\bcrib\b|\bplaypen\b/i,
    inferenceRe:
      /\bgame\b|\bpuzzle\b|\bplayset\b|\blearning\b|\beducational\b/i,
  },

  contains_magnets: {
    negativeRe:  /\bno\s+magnets?\b|\bnon[-\s]?magnetic\b/i,
    positiveRe:  /\bmagnetic\b|\bmagnet[s]?\b|\bneodymium\b/i,
    inferenceRe: undefined,
  },

  contains_food: {
    negativeRe:
      /\bnot\s+(?:for\s+)?(?:human\s+)?consumption\b|\bnot\s+edible\b|\bnon[-\s]?food\b|\bfor\s+display\s+only\b|\bdecorativ[e]\b.*\bfood\b|\bnot\s+intended\s+for\s+(?:food|consumption)\b/i,
    positiveRe:
      /\bsnack\b|\bedible\b|\bfood\s+product\b|\bcanned\s+(?:tuna|meat|fish|sardine)\b|\bfrozen\s+(?:food|meal|entree)\b|\bdried\s+(?:fruit|vegetable|meat)\b|\bdairy\s+product\b|\bbakery\s+product\b|\bprotein\s+powder\b|\bsupplement\b|\bvitamin\s+(?:pill|capsule|gummy)\b|\bready[-\s]?to[-\s]?eat\b|\bpackaged\s+food\b/i,
    // Deliberately excludes bare "food" to avoid false positives on food-contact
    // items ("food storage container", "food-safe plastic"). Use explicit positiveRe
    // or HTS chapter 1–24 for food-product activation.
    inferenceRe:
      /\bbeverage\b|\bdrink\b|\bmeat\b|\bfish\b|\bseafood\b|\bpoultry\b|\bdairy\b|\bcheese\b|\bmilk\b|\begg\s+product\b|\bfruit\b|\bvegetable\b|\bgrain\b|\bcereal\b|\bbread\b|\bconfectionery\b|\bcandy\b|\bchocolate\b|\bjuice\b|\bbeer\b|\bwine\b|\bspirits\b/i,
  },

  food_contact: {
    negativeRe:
      /\bno\b[^.!?;]*\bfood[-\s]?contact\b|\bnot\s+for\s+food\b|\bnot\s+food[-\s]?grade\b|\bdoes\s+not\s+touch\s+food\b|\bfor\s+display\s+only\b/i,
    positiveRe:
      /\bfood[-\s]?(?:safe|grade|contact)\b|\bfood\s+storage\b|\bfda[-\s]?approved\s+(?:for\s+)?food\b|\blunch(?:box|bag)\b|\bbpa[-\s]?free\b.*\b(?:container|bottle|cup)\b|\bdrinkware\b|\bwater\s+bottle\b|\bthermos\b|\btumbler\b|\bkitchen\s+(?:utensil|tool|container)\b|\bcutlery\b|\bfood\s+container\b/i,
    inferenceRe:
      /\bsippy\b|\bmug\b|\bflask\b|\bplate\b|\bbowl\b|\butensil\b|\bkettle\b|\bstorage\s+container\b|\bkitchen\b/i,
  },

  contains_cosmetic: {
    negativeRe:
      /\bnot\s+a\s+cosmetic\b|\bnot\s+(?:a\s+)?personal\s+care\b|\bno\s+cosmetic\b/i,
    positiveRe:
      /\bmoisturizer\b|\blotion\b|\bcream\b|\bserum\b|\btoner\b|\bsunscreen\b|\bspf\b|\bfoundation\b|\blipstick\b|\bmascara\b|\beyeliner\b|\bblush\b|\bconcealer\b|\bshampoo\b|\bconditioner\b|\bhair\s*(?:dye|color|mask)\b|\bnail\s*polish\b|\bperfume\b|\bcologne\b|\bdeodorant\b|\bantiperspirant\b|\bbody\s*wash\b|\bface\s*(?:wash|cleanser)\b|\bskincare\b|\bmakeup\b|\bbeauty\s+product\b/i,
    inferenceRe:
      /\bcosmetic\b|\bfragrance\b|\btopical\b/i,
  },

  contains_chemical: {
    negativeRe:
      /\bno\s+hazardous\s+chemicals?\b|\bchemical[-\s]?free\b|\bno\s+chemicals?\b/i,
    positiveRe:
      /\bdisinfectant\b|\bpesticide\b|\bherbicide\b|\binsecticide\b|\bfungicide\b|\bsolvent\b|\bepoxy\b|\bbleach\b|\bacid\b|\balkali\b|\bcorrosive\b|\bflammable\s+liquid\b|\badhesive\b|\bsealant\b|\bcaulk\b|\blubricant\b|\bgrease\b/i,
    inferenceRe:
      /\bcleaner\b|\bdetergent\b|\bpaint\b|\bvarnish\b|\blacquer\b|\bcoating\b|\baerosol\b/i,
  },

  contains_textile: {
    negativeRe:
      /\bno\s+(?:textile|fabric)\b|\bnon[-\s]?textile\b|\bno\s+fabric\s+content\b/i,
    positiveRe:
      /\bfabric\b|\btextile\b|\bapparel\b|\bgarment\b|\bclothing\b|\bshirt\b|\bpants\b|\bdress\b|\bsuit\b|\bjacket\b|\bcoat\b|\bsweater\b|\bhat\b|\bcap\b|\bglove\b|\bsock\b|\bunderwear\b|\bfootwear\b|\bshoe\b|\bboot\b|\bsandal\b|\bfiber\s+content\b|\byarn\b|\bknit\b|\bwoven\b|\bcotton\b|\bwool\b|\bsilk\b|\bpolyester\b|\bnylon\b|\blinen\b|\bdenim\b|\bspandex\b/i,
    inferenceRe: undefined,   // textiles are strongly keyword-driven; inference adds noise
  },

  contains_wood: {
    negativeRe:
      /\bno\s+wood\b|\bwood[-\s]?free\b|\ball[-\s]?metal\b|\ball[-\s]?plastic\b|\bsolid\s+metal\b|\bsolid\s+plastic\b/i,
    positiveRe:
      /\bwood(?:en)?\b|\bhardwood\b|\bsoftwood\b|\bplywood\b|\bMDF\b|\bparticleboard\b|\bcomposite\s+wood\b|\bfiberboard\b|\bveneer\b|\btimber\b|\blumber\b|\boak\b|\bpine\b|\bwalnut\b|\bmahogany\b|\bbamboo\b/i,
    inferenceRe:
      /\bfurniture\b|\bchair\b|\bsofa\b|\bcouch\b|\btable\b|\bdesk\b|\bcabinet\b|\bshelf\b|\bbookcase\b|\bwardrobe\b|\bdresser\b|\bbed\s*frame\b/i,
  },

  medical_intended_use: {
    negativeRe:
      /\bnot\s+a\s+medical\s+device\b|\bnot\s+for\s+medical\s+use\b|\bno\s+medical\s+intended\s+use\b|\bgeneral\s+(?:consumer|household)\s+use\b(?!.*\bmedical\b)/i,
    positiveRe:
      /\bmedical\s+device\b|\bsurgical\s+(?:instrument|tool|implant)\b|\bdiagnostic\s+(?:device|equipment|tool)\b|\btherapeutic\b|\bimplant\b|\bprosthetic\b|\borthopedic\s+device\b|\bhearing\s+aid\b|\bblood\s+pressure\s+(?:monitor|cuff)\b|\bglucose\s+monitor\b|\bpulse\s+oximeter\b|\bstethoscope\b|\bsyringe\b|\bcatheter\b|\bwound\s+care\b|\bcontact\s+lens\b|\bdental\s+implant\b|\bpacemaker\b|\bdefibrillator\b|\bmedical\s+thermometer\b|\bclinical\s+thermometer\b/i,
    inferenceRe:
      /\bFDA\s+510k\b|\bFDA\s+PMA\b|\bFDA-cleared\b|\bFDA-approved\s+device\b|\bClass\s+(?:I|II|III)\s+device\b/i,
  },

  is_automotive_part: {
    negativeRe: undefined,
    positiveRe:
      /\bbrake\b|\bbumper\b|\baxle\b|\bsuspension\b|\bdriveshaft\b|\bcrankshaft\b|\bcamshaft\b|\bpiston\b|\btransmission\b|\bclutch\b|\bdifferential\b|\bmotor\s*vehicle\b|\bautomotive\b|\bautomobile\b|\bpassenger\s*vehicle\b|\btruck\s*part\b|\bvehicle\s*part\b|\bwheel\s*hub\b|\bsteering\b|\bmuffler\b|\bexhaust\b|\bradiator\b|\bshock\s*absorber\b|\bspark\s*plug\b|\bfuel\s*injector\b|\bcatalytic\s*converter\b/i,
    inferenceRe: undefined,
  },

  // ── Sports & Outdoor ─────────────────────────────────────────────────────────
  is_sports_equipment: {
    negativeRe:
      /\bnot\s+(?:a\s+)?sports?\s+(?:equipment|product|item|gear)\b|\bnot\s+intended\s+for\s+sports?\b/i,
    positiveRe:
      /\bbicycle\b|\bbike\s+(?:frame|wheel|saddle|handlebar|pedal|fork|cassette|derailleur)\b|\bkayak\b|\bcanoe\b|\bsurfboard\b|\bpaddleboard\b|\bwetsuit\b|\blife\s+jacket\b|\bpersonal\s+flotation\s+device\b|\bPFD\b|\bbuoyancy\s+aid\b|\bclimbing\s+harness\b|\bfall[- ]?arrest\b|\bfall\s+protection\s+harness\b|\btreadmill\b|\belliptical\b|\bstationary\s+(?:bike|bicycle)\b|\bspin\s+bike\b|\bexercise\s+(?:machine|bike)\b|\browing\s+machine\b|\bdumbbell[s]?\b|\bbarbell[s]?\b|\bweight\s+(?:plate|bench|rack)\b|\bshin\s+guard\b|\bknee\s+(?:pad|guard)\b|\belbow\s+(?:pad|guard)\b|\bboxing\s+gloves?\b|\bsparring\s+(?:gloves?|equipment|gear)\b|\bskateboard\b|\binline\s+skates?\b|\bice\s+skates?\b|\broller\s+skates?\b|\btrampoline\b|\bski\s+(?:equipment|poles?|boots?|goggle|jacket|pants)\b|\bskiing\s+equipment\b|\bsnowboard\b|\bsoccer\s+goal\b|\bfootball\s+goal\b|\bgoal\s+(?:net|post)\b|\btennis\s+racket\b|\bbadminton\s+racket\b|\bgolf\s+club\b|\bhockey\s+stick\b|\bbaseball\s+bat\b|\bsports?\s+(?:protective\s+)?equipment\b|\bsports?\s+gear\b|\bsports?\s+goods\b|\bfitness\s+(?:tracker|wearable|band|watch)\b|\bGPS\s+(?:running|sports?|fitness)\s+watch\b|\bgymnastics\s+equipment\b|\bwakeboard\b|\bwater\s+ski\b|\bscuba\s+(?:tank|regulator|mask|fins|gear)\b|\bsnorkeling\s+(?:set|gear|mask)\b|\bbelay\s+device\b|\bclimbing\s+(?:rope|shoe|wall)\b|\bfull[- ]?body\s+harness\b|\bself[- ]?retracting\s+lifeline\b|\bsports?\s+protective\s+gear\b|\bcombat\s+sports?\b|\bmartial\s+arts?\s+equipment\b/i,
    inferenceRe:
      /\bgym\s+equipment\b|\bfitness\s+equipment\b|\bsports?\s+equipment\b|\bworkout\s+equipment\b|\brecreational\s+equipment\b|\bexercise\s+equipment\b|\boutdoor\s+(?:sports?|recreation)\s+equipment\b/i,
  },

  head_protection: {
    negativeRe: /\bnot\s+a\s+helmet\b|\bnot\s+head\s+protection\b|\bno\s+helmet\b/i,
    positiveRe: /\bhelmet\b|\bhead\s+protection\b|\bprotective\s+headgear\b/i,
    inferenceRe: undefined,
  },

  flotation_or_lifesaving: {
    negativeRe: /\bnot\s+(?:a\s+)?(?:life\s+jacket|PFD|flotation|lifesaving)\b/i,
    positiveRe:
      /\blife\s+jacket\b|\bpersonal\s+flotation\s+device\b|\bPFD\b|\bbuoyancy\s+aid\b|\blife\s+preserver\b|\blife\s+vest\b|\bcoast\s+guard\s+(?:approved|certification)\b|\bUSCG\s+(?:type|approved)\b/i,
    inferenceRe: undefined,
  },

  load_bearing: {
    negativeRe: /\bnot\s+load[- ]?bearing\b|\bdecorative\s+only\b/i,
    positiveRe:
      /\bclimbing\s+harness\b|\bfall[- ]?(?:arrest|protection)\s+harness\b|\bfull[- ]?body\s+harness\b|\bworking\s+load\s+limit\b|\bsafe\s+working\s+load\b|\brated\s+(?:load|capacity)\b|\bload[- ]?bearing\b|\blifeline\b|\bself[- ]?retracting\s+lifeline\b|\brope\s+access\s+(?:equipment|system)\b|\bbelay\s+device\b/i,
    inferenceRe: /\bcarabiner\b|\banchor\s+point\b/i,
  },

  climbing_or_fall_arrest: {
    negativeRe: /\bnot\s+climbing\s+equipment\b|\bnot\s+(?:a\s+)?fall[- ]?arrest\b/i,
    positiveRe:
      /\bclimbing\s+(?:harness|equipment|rope|gear)\b|\bfall[- ]?arrest\b|\bfall\s+protection\s+(?:harness|system|equipment)\b|\brope\s+access\b|\bbelay\b|\brappel\b|\babseil\b|\bascender\b|\bdescender\b|\brock\s+climbing\b|\bmountaineering\b|\balpinism\b|\bvia\s+ferrata\b|\bbouldering\b|\bself[- ]?retracting\s+lifeline\b/i,
    inferenceRe: /\bcarabiner\b|\banchor\s+point\b|\bbelay\s+device\b/i,
  },

  inflatable: {
    negativeRe: /\bnot\s+inflatable\b|\bsolid[- ]?(?:shell|hull|frame)\b|\bhard[- ]?shell\b/i,
    positiveRe:
      /\binflatable\b|\binflates\b|\bair\s+chamber\b|\bair\s+bladder\b|\bpump\s+(?:to\s+)?inflate\b|\bself[- ]?inflating\b|\bpneumatic\s+(?:cushion|chamber|mat)\b|\bdrop[-\s]?stitch\b/i,
    inferenceRe: undefined,
  },

  intended_for_water: {
    negativeRe: /\bnot\s+for\s+water\b|\bindoor\s+only\b/i,
    positiveRe:
      /\baquatic\b|\bwater\s+sports?\b|\bkayak\b|\bcanoe\b|\bsurfboard\b|\bpaddleboard\b|\bwetsuit\b|\bswimming\b|\bsnorkeling\b|\bdiving\b|\bwater\s+ski\b|\bsailboard\b|\bwakeboard\b|\bscuba\b|\bboating\b|\bopen\s+water\b/i,
    inferenceRe: /\bpool\b|\baqua\b/i,
  },

  protective_equipment: {
    negativeRe: /\bnot\s+protective\s+(?:equipment|gear)\b|\bnot\s+(?:a\s+)?safety\s+(?:gear|equipment)\b/i,
    positiveRe:
      /\bshin\s+guard\b|\bknee\s+(?:pad|guard)\b|\belbow\s+(?:pad|guard)\b|\bbody\s+armor\b|\bface\s+guard\b|\bmouthguard\b|\bprotective\s+(?:vest|padding|gear|equipment|cup)\b|\bimpact\s+(?:protection|absorbing|resistant)\b|\bsports?\s+protective\s+(?:gear|equipment)\b/i,
    inferenceRe: /\bpadding\b|\bprotective\b/i,
  },
};

// ── HTS rules ─────────────────────────────────────────────────────────────────

interface HtsRule {
  readonly prefixes?: readonly string[];
  readonly chapterRange?: readonly [number, number];
  readonly fact: FactKey;
  readonly value: 'yes' | 'no';
}

const HTS_RULES: readonly HtsRule[] = [
  { prefixes: ['8506', '8507'],                         fact: 'contains_battery',     value: 'yes' },
  { prefixes: ['8471','8472','8517','8518','8519','8520','8521','8522','8523',
               '8524','8525','8526','8527','8528','8529','8530','8531','8532',
               '8533','8534','8535','8536','8537','8538','8539','8540','8541',
               '8542','8543','8544','8545','8546','8547','8548','9009','9013'],
                                                         fact: 'contains_electronics', value: 'yes' },
  { prefixes: ['9501','9502','9503','9504','9505','9506','9507','9508'],
                                                         fact: 'intended_for_children', value: 'yes' },
  { prefixes: ['3303','3304','3305','3306','3307','3401'], fact: 'contains_cosmetic',  value: 'yes' },
  { prefixes: ['9018','9019','9020','9021','9022'],       fact: 'medical_intended_use', value: 'yes' },
  { prefixes: ['8505'],                                  fact: 'contains_magnets',     value: 'yes' },
  { prefixes: ['4410','4411','4412'],                    fact: 'contains_wood',        value: 'yes' },
  { prefixes: ['9401','9402','9403','9404','9405','9406'], fact: 'contains_wood',      value: 'yes' },
  { prefixes: ['8701','8702','8703','8704','8705','8706','8707','8708',
               '8711','8712','8713','8714','8715','8716','8407','8408','8409','8483'],
                                                         fact: 'is_automotive_part',   value: 'yes' },
  // Chemical HTS prefixes (chapters 28–38 subsets)
  { prefixes: ['2801','2802','2803','2804','2805','2806','2807','2808','2809','2810',
               '2811','2812','2813','2814','2815','2816','2817','2818','2819','2820',
               '3208','3209','3210','3211','3212','3213','3214',
               '3401','3402','3403','3404','3405','3406','3407',
               '3808','3809','3810','3811','3812','3813','3814','3815','3816','3817',
               '3818','3819','3820','3821','3822','3823','3824','3825','3826','3827'],
                                                         fact: 'contains_chemical',    value: 'yes' },
  // Sports & Outdoor Equipment
  // 8712: bicycles; 9506/9507: sports and athletic equipment
  { prefixes: ['8712'],                                    fact: 'is_sports_equipment', value: 'yes' },
  { prefixes: ['9506','9507'],                             fact: 'is_sports_equipment', value: 'yes' },
  // 6307.20 covers life jackets, but bare '6307' is too broad (flags, dishcloths, etc.).
  // flotation_or_lifesaving is set via TEXT_RULES positiveRe and ANSWER_RULES instead.
  // Food: chapters 1–24 (handled separately below)
  // Textiles: chapters 50–63 + 64 (handled separately below)
];

function applyChapterRangeRules(h: string, facts: FactSet): void {
  if (h.length < 2) return;
  const chapter = parseInt(h.slice(0, 2), 10);
  if (chapter >= 1 && chapter <= 24) {
    maybeSet(facts, 'contains_food', 'yes', 'hts_indication', 0.9, `HTS chapter ${chapter}`);
  }
  if ((chapter >= 50 && chapter <= 63) || chapter === 64) {
    maybeSet(facts, 'contains_textile', 'yes', 'hts_indication', 0.9, `HTS chapter ${chapter}`);
  }
}

// ── Structured answer → fact mapping ─────────────────────────────────────────

interface AnswerRule {
  readonly fact: FactKey;
  readonly value: 'yes' | 'no';
  readonly matchValues: readonly string[];
}

const ANSWER_RULES: Record<string, readonly AnswerRule[]> = {
  battery_type: [
    { fact: 'contains_battery', value: 'no',  matchValues: ['no_battery', 'none', 'not_applicable'] },
    { fact: 'contains_battery', value: 'yes', matchValues: ['lithium_ion', 'lithium_metal', 'lead_acid', 'other_chemistry'] },
  ],
  has_wireless_tx: [
    { fact: 'contains_wireless_transmitter', value: 'yes', matchValues: ['yes'] },
    { fact: 'contains_wireless_transmitter', value: 'no',  matchValues: ['no'] },
    { fact: 'contains_electronics',          value: 'yes', matchValues: ['yes'] },
  ],
  product_function: [
    { fact: 'contains_electronics', value: 'yes', matchValues: [
        'audio_speaker','headphones_earbuds','tv_monitor','computer_laptop_tablet',
        'phone_tablet','router_modem','other_no_radio',
      ]},
    { fact: 'contains_electronics', value: 'no',  matchValues: ['not_electronic', 'not_applicable'] },
  ],
  age_range: [
    { fact: 'intended_for_children', value: 'yes', matchValues: ['under_3', 'age_3_to_12'] },
    { fact: 'intended_for_children', value: 'no',  matchValues: ['over_12', 'not_for_children', 'adults_only', 'not_applicable'] },
  ],
  contains_otc_ingredient: [
    { fact: 'contains_cosmetic', value: 'no',  matchValues: ['not_cosmetic', 'not_applicable'] },
  ],
  is_meat_or_poultry: [
    { fact: 'contains_food', value: 'yes', matchValues: ['yes_meat', 'yes_poultry', 'yes_egg', 'no'] },
    { fact: 'contains_food', value: 'no',  matchValues: ['not_food', 'not_applicable'] },
  ],
  food_contact_use: [
    { fact: 'food_contact', value: 'yes', matchValues: ['yes'] },
    { fact: 'food_contact', value: 'no',  matchValues: ['no', 'not_applicable'] },
    { fact: 'contains_food', value: 'no',  matchValues: ['no_food_contact', 'not_food', 'not_applicable'] },
  ],
  fda_device_class: [
    { fact: 'medical_intended_use', value: 'yes', matchValues: ['class_1', 'class_2', 'class_3'] },
    { fact: 'medical_intended_use', value: 'no',  matchValues: ['not_medical_device', 'not_applicable'] },
  ],
  is_pesticide_or_disinfectant: [
    { fact: 'contains_chemical', value: 'yes', matchValues: ['yes'] },
    { fact: 'contains_chemical', value: 'no',  matchValues: ['not_applicable', 'not_chemical_product'] },
  ],
  contains_hazmat: [
    { fact: 'contains_chemical', value: 'yes', matchValues: ['yes'] },
    { fact: 'contains_chemical', value: 'no',  matchValues: ['no', 'not_applicable'] },
  ],
  contains_composite_wood: [
    { fact: 'contains_wood', value: 'yes', matchValues: ['yes'] },
    { fact: 'contains_wood', value: 'no',  matchValues: ['no', 'not_applicable'] },
  ],
  textile_type: [
    { fact: 'contains_textile', value: 'no', matchValues: ['not_textile', 'not_applicable'] },
  ],
  vehicle_type: [
    { fact: 'is_automotive_part', value: 'yes', matchValues: ['passenger_vehicle', 'heavy_commercial', 'non_road'] },
    { fact: 'is_automotive_part', value: 'no',  matchValues: ['not_automotive', 'not_applicable'] },
  ],

  // ── Sports answer rules ────────────────────────────────────────────────────
  sports_product_type: [
    { fact: 'is_sports_equipment',     value: 'yes', matchValues: [
        'bicycle', 'kayak_canoe', 'surfboard_paddleboard', 'climbing_equipment',
        'pfd_life_jacket', 'fitness_machine', 'free_weights', 'combat_sports',
        'snow_sports', 'water_sports', 'ball_racket_sports', 'trampoline',
        'protective_gear', 'scuba_snorkel', 'other_sports',
      ]},
    { fact: 'is_sports_equipment',     value: 'no',  matchValues: ['not_sports', 'not_applicable'] },
    { fact: 'head_protection',         value: 'yes', matchValues: ['bicycle'] },
    { fact: 'flotation_or_lifesaving', value: 'yes', matchValues: ['pfd_life_jacket', 'kayak_canoe', 'surfboard_paddleboard'] },
    { fact: 'climbing_or_fall_arrest', value: 'yes', matchValues: ['climbing_equipment'] },
    { fact: 'intended_for_water',      value: 'yes', matchValues: ['kayak_canoe', 'surfboard_paddleboard', 'water_sports', 'scuba_snorkel', 'pfd_life_jacket'] },
    { fact: 'protective_equipment',    value: 'yes', matchValues: ['protective_gear', 'combat_sports'] },
  ],
  sports_helmet_type: [
    { fact: 'head_protection', value: 'yes', matchValues: ['bicycle_helmet', 'ski_snowboard_helmet', 'motorcycle_helmet', 'other_helmet'] },
    { fact: 'head_protection', value: 'no',  matchValues: ['no_helmet', 'not_applicable'] },
  ],
  pfd_type: [
    { fact: 'flotation_or_lifesaving', value: 'yes', matchValues: ['type_1', 'type_2', 'type_3', 'type_5'] },
    { fact: 'flotation_or_lifesaving', value: 'no',  matchValues: ['not_pfd', 'not_applicable'] },
    { fact: 'inflatable',              value: 'yes', matchValues: ['type_5'] },
  ],
  climbing_equipment_type: [
    { fact: 'climbing_or_fall_arrest', value: 'yes', matchValues: [
        'harness', 'rope', 'carabiner', 'belay_device', 'fall_arrest_system', 'anchor',
      ]},
    { fact: 'load_bearing',            value: 'yes', matchValues: [
        'harness', 'rope', 'carabiner', 'belay_device', 'fall_arrest_system', 'anchor',
      ]},
    { fact: 'climbing_or_fall_arrest', value: 'no',  matchValues: ['not_applicable'] },
  ],
  water_sports_type: [
    { fact: 'intended_for_water', value: 'yes', matchValues: ['kayak', 'canoe', 'surfboard', 'paddleboard', 'wetsuit', 'swim', 'scuba', 'other_water'] },
    { fact: 'intended_for_water', value: 'no',  matchValues: ['not_applicable'] },
    { fact: 'inflatable',         value: 'yes', matchValues: ['inflatable_kayak', 'inflatable_paddleboard', 'inflatable_boat'] },
  ],
  protective_gear_type: [
    { fact: 'protective_equipment', value: 'yes', matchValues: ['shin_guard', 'knee_pad', 'elbow_pad', 'body_armor', 'face_guard', 'mouthguard', 'other_protective'] },
    { fact: 'protective_equipment', value: 'no',  matchValues: ['not_applicable'] },
    { fact: 'head_protection',      value: 'yes', matchValues: ['head_guard', 'face_guard'] },
  ],
  is_occupational: [
    { fact: 'load_bearing', value: 'yes', matchValues: ['yes_occupational', 'yes_recreational'] },
  ],
};

// ── Core fact extraction ──────────────────────────────────────────────────────

function maybeSet(
  facts: FactSet,
  key: FactKey,
  value: FactValue,
  source: FactSource,
  confidence: number,
  supporting_text?: string,
): void {
  const current = facts[key];
  if (SOURCE_PRECEDENCE[source] > SOURCE_PRECEDENCE[current.source]) {
    (facts as Record<FactKey, TriStateFact>)[key] = { value, source, confidence, supporting_text };
  }
}

/**
 * Extract the complete tri-state fact set for a product.
 *
 * @param htsDigits        Digit-only HTS code (may be partial or empty)
 * @param productText      Product name + description concatenated
 * @param structuredAnswers  Answers from the dynamic clarification step
 */
export function extractFacts(
  htsDigits: string,
  productText: string,
  structuredAnswers: Record<string, string> = {},
): FactSet {
  const h = htsDigits.replace(/[^0-9]/g, '');
  const facts = defaultFacts();

  // ── Level 5: inference ────────────────────────────────────────────────────
  for (const [factKey, rules] of Object.entries(TEXT_RULES) as Array<[FactKey, TextRules]>) {
    if (rules.inferenceRe?.test(productText)) {
      maybeSet(facts, factKey, 'yes', 'inference', 0.5, 'keyword inference');
    }
  }

  // ── Level 4: HTS indication ────────────────────────────────────────────────
  applyChapterRangeRules(h, facts);
  for (const rule of HTS_RULES) {
    if (rule.prefixes?.some((p) => h.startsWith(p))) {
      maybeSet(facts, rule.fact, rule.value, 'hts_indication', 0.9, `HTS prefix ${h.slice(0, 4)}`);
    }
  }

  // ── Level 3 & 2: explicit positive then negative from text ────────────────
  for (const [factKey, rules] of Object.entries(TEXT_RULES) as Array<[FactKey, TextRules]>) {
    if (rules.positiveRe?.test(productText)) {
      maybeSet(facts, factKey, 'yes', 'explicit_positive', 0.9, 'explicit keyword');
    }
  }
  for (const [factKey, rules] of Object.entries(TEXT_RULES) as Array<[FactKey, TextRules]>) {
    if (rules.negativeRe?.test(productText)) {
      maybeSet(facts, factKey, 'no', 'explicit_negative', 1.0, 'explicit negative statement');
    }
  }

  // ── Level 1: structured answers (always wins) ─────────────────────────────
  for (const [questionKey, answerValue] of Object.entries(structuredAnswers)) {
    const rules = ANSWER_RULES[questionKey];
    if (!rules) continue;
    for (const rule of rules) {
      if (rule.matchValues.includes(answerValue)) {
        maybeSet(facts, rule.fact, rule.value, 'structured_answer', 1.0,
          `structured answer: ${questionKey}=${answerValue}`);
      }
    }
  }

  return facts;
}

// ── Module activation ─────────────────────────────────────────────────────────

/**
 * Returns the IDs of modules that should be activated for the given fact set.
 *
 * A module activates when:
 *   - ANY required fact is 'yes', OR
 *   - ANY required fact is 'unknown' with a non-default source (has some signal)
 * AND
 *   - No exclusion fact is 'yes'
 */
export function activateFromFacts(
  facts: FactSet,
  manifests: readonly ModuleManifest[] = MODULE_MANIFESTS,
): string[] {
  const active: string[] = [];
  for (const manifest of manifests) {
    const excluded = manifest.exclusionFacts?.some((k) => facts[k].value === 'yes') ?? false;
    if (excluded) continue;

    const shouldActivate = manifest.requiredFacts.some((k) => {
      const f = facts[k];
      if (f.value === 'yes') return true;
      if (f.value === 'unknown' && f.source !== 'default') return true;
      return false;
    });

    if (shouldActivate) active.push(manifest.id);
  }
  return active;
}

// ── Contradiction detection ───────────────────────────────────────────────────

export interface Contradiction {
  readonly factKey: FactKey;
  readonly conflict: string;
  readonly answer_value: string;
  readonly inferred_value: string;
}

/**
 * Detects cases where structured answers contradict text-derived facts.
 * The structured answer always wins, but conflicts are surfaced so the UI
 * can prompt the user to confirm.
 */
export function detectContradictions(
  htsDigits: string,
  productText: string,
  structuredAnswers: Record<string, string>,
): Contradiction[] {
  if (Object.keys(structuredAnswers).length === 0) return [];

  const textOnlyFacts = extractFacts(htsDigits, productText, {});
  const withAnswers    = extractFacts(htsDigits, productText, structuredAnswers);

  const contradictions: Contradiction[] = [];
  for (const key of ALL_FACT_KEYS) {
    const textFact   = textOnlyFacts[key];
    const finalFact  = withAnswers[key];
    if (
      finalFact.source === 'structured_answer' &&
      textFact.value !== 'unknown' &&
      textFact.value !== finalFact.value
    ) {
      contradictions.push({
        factKey: key,
        conflict: `Text implies "${textFact.value}" but answer sets "${finalFact.value}".`,
        answer_value:   finalFact.value,
        inferred_value: textFact.value,
      });
    }
  }
  return contradictions;
}
