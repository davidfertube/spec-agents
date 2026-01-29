/**
 * API client for Steel Agent backend
 * Handles communication with the Next.js API routes
 * Includes client-side demo mode fallback
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Demo responses for when backend is unavailable
const DEMO_RESPONSES: Record<string, { response: string; sources: Source[] }> = {
  "yield strength": {
    response: `According to ASTM A106 [1], Grade B seamless carbon steel pipe has:

• **Minimum Yield Strength**: 35 ksi (241 MPa)
• **Minimum Tensile Strength**: 60 ksi (415 MPa)
• **Elongation**: Minimum 16.5% in 2 inches

This grade is commonly used for high-temperature service in refineries and power plants. The yield strength of 35 ksi makes it suitable for pressure applications up to approximately 750°F (400°C).

For comparison, Grade A has a lower yield strength of 30 ksi (207 MPa), while Grade C has a higher yield of 40 ksi (276 MPa) [2].`,
    sources: [
      { ref: "[1]", document: "ASTM_A106.pdf", page: "3", content_preview: "Table 1 - Tensile Requirements: Grade B - Tensile strength, min 60 ksi [415 MPa], Yield strength, min 35 ksi [241 MPa]..." },
      { ref: "[2]", document: "ASTM_A106.pdf", page: "4", content_preview: "Grade A shall have minimum yield strength of 30 ksi, Grade C shall have minimum yield strength of 40 ksi..." }
    ]
  },
  "nace": {
    response: `NACE MR0175/ISO 15156 [1] specifies requirements for metallic materials in H₂S-containing environments (sour service).

**Key Requirements for Carbon Steel:**
• Maximum hardness: 22 HRC (or 248 HV or 237 HBW)
• Heat treatment: Normalized, normalized and tempered, or quenched and tempered
• Welding: Post-weld heat treatment required for certain thicknesses

**For AISI 4140 Steel** [2]:
4140 in the quenched and tempered condition CAN meet NACE MR0175 if:
• Hardness ≤ 22 HRC throughout
• Properly heat treated per NACE requirements
• Tempering temperature ≥ 650°C (1200°F)

⚠️ **Important**: 4140 in as-rolled or improperly tempered condition will NOT meet NACE requirements due to hardness exceeding limits.`,
    sources: [
      { ref: "[1]", document: "NACE_MR0175.pdf", page: "12", content_preview: "Carbon and low-alloy steels shall have a maximum hardness of 22 HRC for base metal and heat-affected zones..." },
      { ref: "[2]", document: "AISI_4140_Datasheet.pdf", page: "2", content_preview: "4140 alloy steel, when properly quenched and tempered, can achieve hardness levels suitable for NACE MR0175 compliance..." }
    ]
  },
  "compare": {
    response: `**Comparison: ASTM A53 vs A106 for High-Temperature Service**

| Property | A53 Type E | A53 Type S | A106 Grade B |
|----------|------------|------------|--------------|
| Manufacturing | ERW Welded | Seamless | Seamless |
| Max Temp | 400°F | 750°F | 750°F |
| Yield Strength | 30 ksi min | 35 ksi min | 35 ksi min |
| Pressure Rating | Lower | Moderate | Higher |

**Recommendation for High-Temperature Service** [1]:

For temperatures above 400°F (204°C), **ASTM A106 Grade B is preferred** because:
1. Seamless construction eliminates weld seam concerns at elevated temps
2. Designed specifically for high-temperature service
3. More stringent chemical composition limits
4. Better creep resistance at sustained high temperatures

A53 Type E (ERW) should NOT be used above 400°F due to potential weld seam degradation [2].`,
    sources: [
      { ref: "[1]", document: "ASTM_A106.pdf", page: "1", content_preview: "This specification covers seamless carbon steel pipe for high-temperature service..." },
      { ref: "[2]", document: "ASTM_A53.pdf", page: "5", content_preview: "Type E (Electric-Resistance-Welded) pipe is not recommended for temperatures exceeding 400°F..." }
    ]
  },
  "hardness": {
    response: `**Maximum Allowable Hardness for Sour Service (NACE MR0175)**

Per NACE MR0175/ISO 15156-2 [1]:

| Material | Max Hardness |
|----------|--------------|
| Carbon Steel (base metal) | 22 HRC / 248 HV / 237 HBW |
| Carbon Steel (weld & HAZ) | 22 HRC / 248 HV / 237 HBW |
| Low Alloy Steel | 22 HRC (some grades to 26 HRC) |
| Stainless Steel (austenitic) | No limit (corrosion concern instead) |

**Testing Requirements** [2]:
• Hardness testing per ASTM E18 (Rockwell) or E10 (Brinell)
• Test locations: base metal, weld metal, heat-affected zone
• Minimum 3 readings per zone, report average

**Common Issues**:
⚠️ Weld repairs often exceed hardness limits without PWHT
⚠️ Flame-cut edges can develop hard zones
⚠️ Cold working can increase surface hardness`,
    sources: [
      { ref: "[1]", document: "NACE_MR0175.pdf", page: "15", content_preview: "The maximum hardness of carbon and low-alloy steels shall be 22 HRC (248 HV10 or 237 HBW)..." },
      { ref: "[2]", document: "NACE_MR0175.pdf", page: "18", content_preview: "Hardness testing shall be performed in accordance with ASTM E18 or equivalent..." }
    ]
  },
  "default": {
    response: `I found relevant information in the steel specifications database.

Based on the available documentation [1], here's what I can tell you:

The steel specifications cover various grades and standards including:
• ASTM A106 - Seamless Carbon Steel Pipe for High-Temperature Service
• ASTM A53 - Welded and Seamless Steel Pipe
• ASTM A333 - Seamless and Welded Steel Pipe for Low-Temperature Service
• NACE MR0175 - Sulfide Stress Corrosion Cracking Resistant Materials

For more specific information, try asking about:
- Yield strength of specific grades (e.g., "yield strength of A106 Grade B")
- NACE compliance requirements
- Material comparisons for specific applications
- Hardness limits for sour service`,
    sources: [
      { ref: "[1]", document: "Steel_Specifications_Index.pdf", page: "1", content_preview: "This index covers ASTM, ASME, API, and NACE standards for steel materials used in oil & gas applications..." }
    ]
  }
};

function getDemoResponse(query: string): { response: string; sources: Source[] } {
  const q = query.toLowerCase();
  if (q.includes("yield") || q.includes("strength") || q.includes("a106")) {
    return DEMO_RESPONSES["yield strength"];
  }
  if (q.includes("nace") || q.includes("sour") || q.includes("4140") || q.includes("mr0175")) {
    return DEMO_RESPONSES["nace"];
  }
  if (q.includes("compare") || q.includes("a53") || q.includes("temperature") || q.includes("vs")) {
    return DEMO_RESPONSES["compare"];
  }
  if (q.includes("hardness") || q.includes("hrc")) {
    return DEMO_RESPONSES["hardness"];
  }
  return DEMO_RESPONSES["default"];
}

// Source citation type
export interface Source {
  ref: string;           // e.g., "[1]"
  document: string;      // e.g., "ASTM_A106.pdf"
  page: string;          // e.g., "5"
  content_preview: string; // First 200 chars of the chunk
  document_url?: string; // Public URL to open PDF at specific page
  storage_path?: string; // Supabase storage path for PDF proxy
  /** Starting character position within the page for citation highlighting */
  char_offset_start?: number;
  /** Ending character position within the page for citation highlighting */
  char_offset_end?: number;
}

// Response types
export interface ChatResponse {
  response: string;
  sources: Source[];
}

export interface GenericLLMResponse {
  response: string;
  sources: [];
  isGenericLLM: true;
}

export interface ComparisonResult {
  steelAgent: ChatResponse;
  genericLLM: GenericLLMResponse;
}

export interface HealthResponse {
  status: string;
  version?: string;
}

export interface ApiError {
  detail: string;
}

// Custom error class for API errors
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Query the knowledge base with a user question
 * Falls back to demo mode if backend is unavailable
 * @param query - The user's question
 * @returns The AI-generated response with source citations
 */
export async function queryKnowledgeBase(query: string): Promise<ChatResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = 'Failed to query knowledge base';
      try {
        const errorData: ApiError = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch {
        // If we can't parse error JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new ApiRequestError(errorMessage, response.status);
    }

    return response.json();
  } catch (error) {
    // If backend is unavailable, use demo mode
    console.log('Backend unavailable, using demo mode');

    // Simulate network delay for realistic feel
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

    return getDemoResponse(query);
  }
}

/**
 * Query a generic LLM (without RAG) for comparison purposes
 * @param query - The user's question
 * @returns The generic LLM response (no sources)
 */
export async function queryGenericLLM(query: string): Promise<GenericLLMResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${API_URL}/api/chat/compare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Failed to query generic LLM');
    }

    return response.json();
  } catch {
    // Return a simulated generic response for demo mode
    await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400));

    return {
      response: `Based on my general knowledge about steel materials:

The specifications you're asking about typically involve various ASTM and industry standards. Common values and requirements include tensile strength, yield strength, and hardness limits that vary by grade and application.

For specific values, I recommend consulting the relevant specification documents directly, as exact requirements can vary significantly between standards and grades.

*Note: This response is based on general knowledge and may not reflect your specific documentation.*`,
      sources: [],
      isGenericLLM: true,
    };
  }
}

/**
 * Query both Steel Agent and generic LLM in parallel for comparison
 * @param query - The user's question
 * @returns Both responses for side-by-side comparison
 */
export async function queryWithComparison(query: string): Promise<ComparisonResult> {
  const [steelAgent, genericLLM] = await Promise.all([
    queryKnowledgeBase(query),
    queryGenericLLM(query),
  ]);

  return { steelAgent, genericLLM };
}

/**
 * Check if the backend is healthy and reachable
 * @returns true if healthy, false otherwise
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      // Short timeout for health checks
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the health status with details
 * @returns Health response or null if unhealthy
 */
export async function getHealthStatus(): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}
