/**
 * Generates a structured import risk scan for a watchlist entry using Claude.
 * Returns null if ANTHROPIC_API_KEY is not set — the frontend falls back to
 * a client-side mock scan in that case.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { WatchlistEntry, ProductRiskScan } from '../types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a practical import compliance advisor helping U.S. importers understand the risks \
for their specific product before they import.

Write everything in plain English for a small business owner or e-commerce seller — not a trade lawyer. \
Be specific about what THEY need to do, not general statements about "consulting professionals." \
Be honest about uncertainty: if something depends on exact HTS classification, say "verify with broker." \
Never guarantee clearance or compliance.

Respond ONLY with valid JSON — no markdown, no code fences, no explanation outside the JSON object.`;

type ScanResult = Omit<ProductRiskScan, 'id' | 'watchlist_entry_id' | 'created_at'>;

export async function generateRiskScan(entry: WatchlistEntry): Promise<ScanResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const isChina = entry.origin_country.toLowerCase().includes('china');

  const userPrompt = `Generate an import risk assessment for this product and return ONLY valid JSON.

PRODUCT:
- Name: ${entry.product_name}
- Description: ${entry.product_description || 'Not provided'}
- HTS/HS Code: ${entry.hts_code || 'Not provided'}
- Origin: ${entry.origin_country}
- Destination: ${entry.destination_country}

PRODUCT CHARACTERISTICS:
- For children under 12: ${entry.is_children ? 'YES' : 'No'}
- Contains battery: ${entry.has_battery ? 'YES' : 'No'}
- Electronic product: ${entry.is_electronic ? 'YES' : 'No'}
- Textile/apparel: ${entry.is_textile ? 'YES' : 'No'}
- Cosmetic/beauty/personal care: ${entry.is_cosmetic ? 'YES' : 'No'}
- Touches food: ${entry.is_food_contact ? 'YES' : 'No'}
- Supplement/food/medical-adjacent: ${entry.is_supplement ? 'YES' : 'No'}
- Sold on Amazon: ${entry.sold_on_amazon ? 'YES' : 'No'}
- Sold on TikTok Shop: ${entry.sold_on_tiktok ? 'YES' : 'No'}
- Also sold in EU: ${entry.sold_in_eu ? 'YES' : 'No'}

Return this exact JSON (no markdown, no code fences):
{
  "overall_risk": "Low|Medium|High|Critical",
  "overall_summary": "One plain-English sentence summarizing the main risk",
  "risk_categories": [
    {
      "category": "Category name",
      "level": "Low|Medium|High|Critical|N/A",
      "explanation": "2-3 sentences in plain English explaining the risk",
      "action": "Specific action this importer should take now"
    }
  ],
  "document_checklist": [
    {
      "document": "Document name",
      "required": true,
      "reason": "One sentence on why it is needed"
    }
  ],
  "broker_questions": ["question 1", "question 2", "question 3", "question 4", "question 5"],
  "supplier_questions": ["question 1", "question 2", "question 3", "question 4"],
  "next_actions": ["action 1", "action 2", "action 3", "action 4"],
  "readiness_score": 0,
  "confidence_level": "Low|Medium|High"
}

RISK CATEGORIES to include (only include what is relevant — skip truly inapplicable ones):
1. Tariff Risk — always include
2. HTS Classification Risk — always include
3. Section 301 China Tariff — ${isChina ? 'MUST include' : 'skip (not China origin)'}
4. AD/CVD Risk — include if product type commonly faces antidumping orders
5. Customs Documentation — always include
6. Product Safety / CPSC — include for consumer products
7. FDA Requirements — ${entry.is_food_contact || entry.is_cosmetic || entry.is_supplement ? 'MUST include' : 'include only if clearly relevant'}
8. Battery / UN 38.3 — ${entry.has_battery ? 'MUST include' : 'skip'}
9. Children\'s Product / CPSIA — ${entry.is_children ? 'MUST include, set level to Critical' : 'skip'}
10. Textile / FTC Labeling — ${entry.is_textile ? 'MUST include' : 'skip'}
11. Marketplace Requirements — ${entry.sold_on_amazon || entry.sold_on_tiktok ? 'MUST include' : 'skip'}
12. EU Requirements — ${entry.sold_in_eu ? 'MUST include' : 'skip'}

DOCUMENT CHECKLIST must always include: Commercial Invoice, Packing List, Country of Origin Declaration.
Add specific docs based on product type: UN 38.3 for battery, CPSIA/CPC for children, food-contact declaration for food-contact, FCC for electronics, fiber content cert for textiles.

READINESS SCORE calculation:
- Start at 40
- +15 if HTS code was provided
- +10 if product description was provided
- +5 if more than 3 product attributes answered YES (user is being thorough)
- -20 if children's product (needs CPSIA cert urgently)
- -15 if battery product (needs UN 38.3)
- -15 if food/supplement (needs FDA work)
- -10 if cosmetic (needs safety data)
- Never go below 10, never above 90 for a new product

CONFIDENCE LEVEL: "High" if HTS code provided and product is straightforward, "Medium" if HTS missing or product has complex characteristics, "Low" if very limited information.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    // Strip any accidental markdown code fences
    const json = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(json) as ScanResult;
  } catch (err: any) {
    console.error('[riskScanner] Failed to generate scan:', err.message);
    return null;
  }
}
