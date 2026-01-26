import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware

# Check if we're in demo mode (no API keys)
DEMO_MODE = not os.getenv("GOOGLE_API_KEY") or not os.getenv("PINECONE_API_KEY")

if not DEMO_MODE:
    from agent import run_agent

app = FastAPI(
    title="Steel Agent API",
    description="AI-powered knowledge retrieval for steel specifications and O&G compliance",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Demo Data ---

DEMO_RESPONSES = {
    "yield strength": {
        "query_match": ["yield strength", "a106", "grade b"],
        "response": "According to ASTM A106 [1], Grade B seamless carbon steel pipe has:\n\n• **Minimum Yield Strength**: 35 ksi (241 MPa)\n• **Minimum Tensile Strength**: 60 ksi (415 MPa)\n• **Minimum Elongation**: 30%\n\nThis grade is commonly used for high-temperature service piping in refineries and power plants, with a maximum service temperature of approximately 1000°F (538°C).",
        "sources": [
            {
                "ref": "[1]",
                "document": "ASTM_A106.pdf",
                "page": "3",
                "content_preview": "Table 1 - Tensile Requirements: Grade B - Tensile strength, min, ksi [MPa]: 60 [415]. Yield strength, min, ksi [MPa]: 35 [240]."
            },
            {
                "ref": "[2]",
                "document": "ASTM_A106.pdf",
                "page": "5",
                "content_preview": "Chemical Composition - Grade B: Carbon max 0.30%, Manganese 0.29-1.06%, Phosphorus max 0.035%, Sulfur max 0.035%."
            }
        ]
    },
    "nace": {
        "query_match": ["nace", "4140", "sour", "h2s", "mr0175"],
        "response": "AISI 4140 steel can meet NACE MR0175/ISO 15156 requirements for sour service, but **only with proper heat treatment** [1].\n\n**Key Requirements:**\n• Maximum hardness: **22 HRC** (248 HBW)\n• Heat treatment: Normalized & tempered, or Q&T with minimum tempering at 1150°F\n\n**Warning:** In the standard Q&T condition (400°F temper), 4140 typically exceeds 50 HRC and is **NOT compliant** for sour service [2].\n\n**For Compliance:**\n1. Specify tempering temperature ≥1150°F\n2. Verify hardness testing per NACE requirements\n3. Document heat treatment records",
        "sources": [
            {
                "ref": "[1]",
                "document": "NACE_MR0175_ISO15156.pdf",
                "page": "12",
                "content_preview": "Table A.2 - Low-alloy steels: Maximum hardness 22 HRC. Materials shall be in the quenched and tempered, normalized and tempered, or normalized condition."
            },
            {
                "ref": "[2]",
                "document": "AISI_4140_DataSheet.pdf",
                "page": "2",
                "content_preview": "Mechanical Properties - Quenched & Tempered at 400°F: Hardness 54 HRC, Tensile 280 ksi. NOT suitable for sour service without re-tempering."
            }
        ]
    },
    "compare": {
        "query_match": ["compare", "a53", "a106", "difference", "vs"],
        "response": "**ASTM A106 vs A53 Comparison for High-Temperature Service:**\n\n| Property | A106 | A53 |\n|----------|------|-----|\n| **Primary Use** | High-temp service | General purpose |\n| **Max Temp** | 1000°F | ~750°F |\n| **Manufacturing** | Seamless only | Seamless or ERW |\n| **Chemistry Control** | Stricter | Standard |\n| **P & S Limits** | 0.035% max | 0.05% max |\n\n**Recommendation:** For refinery process piping, power plant steam lines, and heat exchangers above 750°F, **ASTM A106 Grade B** is the industry standard [1][2].\n\nA53 is acceptable for lower-temperature applications like utility lines, structural supports, and water/gas distribution.",
        "sources": [
            {
                "ref": "[1]",
                "document": "ASTM_A106.pdf",
                "page": "1",
                "content_preview": "Scope: This specification covers seamless carbon steel pipe for high-temperature service."
            },
            {
                "ref": "[2]",
                "document": "ASTM_A53.pdf",
                "page": "1",
                "content_preview": "Scope: This specification covers seamless and welded black and hot-dipped galvanized steel pipe for ordinary uses."
            },
            {
                "ref": "[3]",
                "document": "ASME_B31.3_TableA1.pdf",
                "page": "45",
                "content_preview": "Allowable Stress Values - A106 Grade B is listed with stress values up to 1000°F. A53 Grade B limited to lower temperatures."
            }
        ]
    },
    "hardness": {
        "query_match": ["hardness", "sour service", "maximum", "limit", "hrc"],
        "response": "Per **NACE MR0175/ISO 15156**, the maximum allowable hardness for carbon and low-alloy steels in sour (H2S) service is [1]:\n\n• **22 HRC** (Rockwell C)\n• **248 HBW** (Brinell)\n• **250 HV** (Vickers)\n\n**When This Applies:**\n• H2S partial pressure > 0.05 psi (0.3 kPa)\n• Aqueous environment present\n• pH typically 3.5 - 6.5\n\n**Critical Notes:**\n• Weld HAZ must also meet hardness limits\n• Post-weld heat treatment often required\n• Hardness testing per ASTM E18/E10 required",
        "sources": [
            {
                "ref": "[1]",
                "document": "NACE_MR0175_ISO15156-2.pdf",
                "page": "8",
                "content_preview": "Section 7.2 - Hardness: The maximum hardness of carbon steel and low-alloy steel shall not exceed 22 HRC."
            },
            {
                "ref": "[2]",
                "document": "NACE_MR0175_ISO15156-2.pdf",
                "page": "15",
                "content_preview": "Table 1 - H2S limits: For SSC Region 0, partial pressure of H2S > 0.05 psi requires compliance with hardness and other requirements."
            }
        ]
    },
    "a333": {
        "query_match": ["a333", "grade 6", "low temperature", "cryogenic"],
        "response": "**ASTM A333 Grade 6** is the most common carbon steel for low-temperature service [1]:\n\n**Mechanical Properties:**\n• Yield Strength: 35 ksi min\n• Tensile Strength: 60 ksi min\n• Minimum Service Temp: **-50°F (-46°C)**\n\n**Key Requirements:**\n• Charpy impact testing at -50°F required\n• 15 ft-lb minimum absorbed energy\n• Chemistry similar to A106 Grade B\n\n**Common Applications:**\n• LNG facilities\n• Cryogenic piping\n• Cold climate pipelines\n• Refrigeration systems\n\nFor temperatures below -50°F, consider A333 Grade 3 (3.5% Ni) rated to -150°F.",
        "sources": [
            {
                "ref": "[1]",
                "document": "ASTM_A333.pdf",
                "page": "2",
                "content_preview": "Table 1 - Grade 6: Min tensile 60 ksi, min yield 35 ksi. Impact test temperature -50°F."
            },
            {
                "ref": "[2]",
                "document": "ASTM_A333.pdf",
                "page": "4",
                "content_preview": "Section 6 - Impact Requirements: Charpy V-notch specimens shall exhibit minimum 15 ft-lbf at specified test temperature."
            }
        ]
    },
    "default": {
        "response": "I found relevant information in the steel specifications database.\n\nBased on industry standards including ASTM A106, A53, A333, NACE MR0175, and API 5L, here's what I can tell you:\n\nFor specific material properties, compliance requirements, or comparison questions, please try queries like:\n• \"What is the yield strength of A106 Grade B?\"\n• \"Does 4140 steel meet NACE MR0175?\"\n• \"Compare A53 and A106 for high-temperature service\"\n• \"Maximum hardness for sour service?\"\n\nI have detailed specifications for carbon steel pipe, low-alloy steels, and sour service requirements.",
        "sources": [
            {
                "ref": "[1]",
                "document": "Steel_Specifications_Index.pdf",
                "page": "1",
                "content_preview": "This knowledge base contains ASTM, API, ASME, and NACE standards for steel materials used in oil & gas and industrial applications."
            }
        ]
    }
}

def get_demo_response(query: str) -> dict:
    """Get a demo response based on query keywords."""
    query_lower = query.lower()

    for key, data in DEMO_RESPONSES.items():
        if key == "default":
            continue
        if any(keyword in query_lower for keyword in data.get("query_match", [])):
            return {
                "response": data["response"],
                "sources": data["sources"]
            }

    return {
        "response": DEMO_RESPONSES["default"]["response"],
        "sources": DEMO_RESPONSES["default"]["sources"]
    }

# --- Request/Response Models ---

class QueryRequest(BaseModel):
    query: str

    class Config:
        json_schema_extra = {
            "example": {
                "query": "What is the yield strength of ASTM A106 Grade B?"
            }
        }

class Source(BaseModel):
    ref: str
    document: str
    page: str
    content_preview: str

    class Config:
        json_schema_extra = {
            "example": {
                "ref": "[1]",
                "document": "ASTM_A106.pdf",
                "page": "5",
                "content_preview": "ASTM A106 Grade B: Minimum yield strength 35,000 psi..."
            }
        }

class ChatResponse(BaseModel):
    response: str
    sources: List[Source]

    class Config:
        json_schema_extra = {
            "example": {
                "response": "According to ASTM A106 [1], Grade B seamless carbon steel pipe has a minimum yield strength of 35,000 psi (240 MPa).",
                "sources": [
                    {
                        "ref": "[1]",
                        "document": "ASTM_A106.pdf",
                        "page": "5",
                        "content_preview": "ASTM A106 Grade B: Minimum yield strength 35,000 psi..."
                    }
                ]
            }
        }

class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    mode: str = "demo" if DEMO_MODE else "production"

# --- Endpoints ---

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: QueryRequest):
    """
    Query the steel knowledge base.

    Returns an AI-generated response with source citations.
    Each citation includes document name, page number, and content preview.
    """
    try:
        if DEMO_MODE:
            result = get_demo_response(request.query)
        else:
            result = run_agent(request.query)

        return ChatResponse(
            response=result["response"],
            sources=[Source(**s) for s in result["sources"]]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(status="ok", mode="demo" if DEMO_MODE else "production")
