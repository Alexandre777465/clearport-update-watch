/**
 * Ordered conversation steps for the /check intake flow.
 *
 * Each step maps to a field in ConversationState. Steps are processed
 * sequentially; dynamic product questions are appended after step "email"
 * by useConversation once enough product context exists.
 */

export type StepId =
  | "productName"
  | "description"
  | "htsCode"
  | "originCountry"
  | "destination"
  | "estimatedValue"
  | "freightUsd"
  | "insuranceUsd"
  | "transportMode"
  | "manufacturerName"
  | "exporterName"
  | "email";

export interface ConversationStep {
  id: StepId;
  prompt: string;
  promptZh?: string;
  placeholder?: string;
  placeholderZh?: string;
  helpText?: string;
  helpTextZh?: string;
  inputType: "text" | "email" | "number" | "country" | "transport" | "optional-text" | "optional-number";
  optional?: boolean;
  skipLabel?: string;
  skipLabelZh?: string;
}

export const CONVERSATION_STEPS: ConversationStep[] = [
  {
    id: "productName",
    prompt: "What product are you planning to import?",
    promptZh: "您计划进口什么产品？",
    placeholder: "e.g. ceramic coffee mugs, folding bicycle, LED grow lights",
    placeholderZh: "例如：陶瓷咖啡杯、折叠自行车、LED植物灯",
    inputType: "text",
  },
  {
    id: "description",
    prompt: "Anything else that would help identify it? (optional)",
    promptZh: "还有什么信息可以帮助识别产品？（可选）",
    placeholder: "e.g. material, use case, target age group",
    placeholderZh: "例如：材质、用途、目标年龄段",
    inputType: "optional-text",
    optional: true,
    skipLabel: "Skip",
    skipLabelZh: "跳过",
  },
  {
    id: "htsCode",
    prompt: "Do you have an HTS code for this product?",
    promptZh: "您是否有该产品的HTS编码？",
    placeholder: "e.g. 6911.10.0000",
    placeholderZh: "例如：6911.10.0000",
    helpText: "A 10-digit HTS code enables the most precise duty and tariff analysis.",
    helpTextZh: "10位HTS编码可实现最精确的关税分析。",
    inputType: "optional-text",
    optional: true,
    skipLabel: "I don't have one",
    skipLabelZh: "我没有",
  },
  {
    id: "originCountry",
    prompt: "Where is the product manufactured?",
    promptZh: "产品在哪里生产？",
    placeholder: "Country of origin",
    placeholderZh: "原产国",
    inputType: "country",
  },
  {
    id: "destination",
    prompt: "Where are you importing to?",
    promptZh: "您要进口到哪里？",
    placeholder: "Destination country",
    placeholderZh: "目的地国家",
    inputType: "country",
  },
  {
    id: "estimatedValue",
    prompt: "What is the approximate customs value? (USD)",
    promptZh: "大约的报关价值是多少？（美元）",
    placeholder: "e.g. 50000",
    placeholderZh: "例如：50000",
    helpText: "Used to calculate MPF, HMF, and total landed cost.",
    helpTextZh: "用于计算MPF、HMF和总到岸成本。",
    inputType: "optional-number",
    optional: true,
    skipLabel: "Skip",
    skipLabelZh: "跳过",
  },
  {
    id: "freightUsd",
    prompt: "What is the estimated freight cost? (USD, optional)",
    promptZh: "预计运费是多少？（美元，可选）",
    placeholder: "e.g. 2500",
    placeholderZh: "例如：2500",
    inputType: "optional-number",
    optional: true,
    skipLabel: "Skip",
    skipLabelZh: "跳过",
  },
  {
    id: "insuranceUsd",
    prompt: "What is the estimated insurance cost? (USD, optional)",
    promptZh: "预计保险费是多少？（美元，可选）",
    placeholder: "e.g. 300",
    placeholderZh: "例如：300",
    inputType: "optional-number",
    optional: true,
    skipLabel: "Skip",
    skipLabelZh: "跳过",
  },
  {
    id: "transportMode",
    prompt: "How will the goods be shipped?",
    promptZh: "货物将如何运输？",
    inputType: "transport",
    optional: true,
    skipLabel: "Not sure",
    skipLabelZh: "不确定",
  },
  {
    id: "manufacturerName",
    prompt: "Manufacturer name? (optional)",
    promptZh: "制造商名称？（可选）",
    placeholder: "e.g. Shenzhen Widget Co.",
    placeholderZh: "例如：深圳零件公司",
    inputType: "optional-text",
    optional: true,
    skipLabel: "Skip",
    skipLabelZh: "跳过",
  },
  {
    id: "exporterName",
    prompt: "Exporter name? (optional)",
    promptZh: "出口商名称？（可选）",
    placeholder: "e.g. HK Trade Ltd.",
    placeholderZh: "例如：香港贸易有限公司",
    inputType: "optional-text",
    optional: true,
    skipLabel: "Skip",
    skipLabelZh: "跳过",
  },
  {
    id: "email",
    prompt: "Your email address — we'll send you alerts when rules change.",
    promptZh: "您的电子邮件地址——当规则变更时，我们将向您发送提醒。",
    placeholder: "you@company.com",
    inputType: "email",
  },
];

export const STEP_IDS = CONVERSATION_STEPS.map((s) => s.id);
