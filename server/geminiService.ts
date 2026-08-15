import { GoogleGenAI } from '@google/genai';

let genAIClient: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI | null {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 0) {
      genAIClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }
  return genAIClient;
}

// Candidate models - prioritize gemini-3.7-flash and gemini-3.1-flash-lite
const CANDIDATE_MODELS = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-2.5-flash'];

export interface GenerateGeminiOptions {
  contents: string | any;
  systemInstruction?: string;
  responseMimeType?: string;
  temperature?: number;
}

/**
 * Safely parse JSON from LLM output, stripping markdown code fences if present
 */
export function extractJsonFromText(rawText: string): any {
  if (!rawText) return null;
  let text = rawText.trim();
  
  // Strip markdown ```json ... ``` or ``` ... ```
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }
  
  try {
    return JSON.parse(text.trim());
  } catch {
    // Attempt regex extraction for outer JSON object {...}
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Call Gemini with multi-model fallback and transient retry logic to handle 503 high demand / 429 rate limit
 */
export async function callGeminiSafe(options: GenerateGeminiOptions): Promise<{ text: string; parsedJson?: any } | null> {
  const ai = getGenAI();
  if (!ai) return null;

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const config: any = {};
        if (options.systemInstruction) {
          config.systemInstruction = options.systemInstruction;
        }
        if (options.responseMimeType) {
          config.responseMimeType = options.responseMimeType;
        }
        if (typeof options.temperature === 'number') {
          config.temperature = options.temperature;
        }

        const response = await ai.models.generateContent({
          model,
          contents: options.contents,
          config: Object.keys(config).length > 0 ? config : undefined,
        });

        const text = response.text || '';
        let parsedJson = undefined;
        if (options.responseMimeType === 'application/json' || text.trim().startsWith('{')) {
          parsedJson = extractJsonFromText(text);
        }

        return { text, parsedJson };
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const isUnavailableOrRateLimit =
          errMsg.includes('503') ||
          errMsg.includes('429') ||
          errMsg.includes('high demand') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('RESOURCE_EXHAUSTED');

        if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('Quota exceeded')) {
          // Advance immediately to next candidate model if quota on current model is exhausted
          break;
        }

        if (isUnavailableOrRateLimit) {
          // Wait briefly before retry if 503 or transient 429
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
          continue;
        } else {
          break; // move to next candidate model
        }
      }
    }
  }

  return null;
}
