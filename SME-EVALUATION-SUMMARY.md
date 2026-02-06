# SpecVault - SME Evaluation Summary

## What This Tool Does

**SpecVault** is an AI-powered document search tool specifically designed for materials engineers. Instead of manually searching through PDF specifications, you can:

1. **Upload your specification PDFs** (ASTM, API, NACE, etc.)
2. **Ask questions in plain English** (e.g., "What is the yield strength of 2205 duplex?")
3. **Get answers with exact page citations** back to your source documents

### Key Benefit for Compliance Work
Every answer includes a clickable citation (e.g., "[1] ASTM A789, Page 4") so you can verify the information and use it in compliance reports.

---

## Current Test Results (January 2026)

I tested the system with ASTM A789 (tubing) and A790 (pipe) duplex stainless steel specifications. Here's what I found:

### Accuracy Tests

| Question Asked | System's Answer | Correct? |
|----------------|-----------------|----------|
| "What is the yield strength of 2205 duplex?" | 70 ksi [485 MPa] with citation to A789 Table 4 | **Yes** |
| "What is the tensile strength of S32750?" | 116 ksi [800 MPa] with citation to A790 Table 3 | **Yes** |
| "What is the heat treatment temp for S32205?" | 1870-2010°F [1020-1100°C] with citation to A789 Table 2 | **Yes** |
| "What is the chromium content of S31803?" | "Cannot answer - not in uploaded documents" | **Correct refusal** |

### What's Working Well
- Numerical values match the specification tables exactly
- Page numbers in citations are accurate
- System refuses to guess when information isn't available (no hallucinations)
- Handles both common names (2205) and UNS designations (S32205)

### Current Limitations
- Some grade aliases may not be recognized (e.g., "2507" vs "S32750")
- Complex multi-document comparisons may miss some data
- Table formatting may affect how chemical compositions are retrieved

---

## How to Test It Yourself

1. Go to the application (your colleague will provide the URL)
2. Upload one of your specification PDFs (up to 50MB supported)
3. Wait for the green "Ready!" checkmark
4. Try these test questions:
   - "What is the minimum yield strength of [grade you know]?"
   - "What heat treatment does [UNS number] require?"
   - "What is the carbon limit for [grade]?"

5. **Verify the answers** by clicking the citation links and checking against the PDF

---

## Questions for Your Evaluation

Please review the system and provide feedback on:

1. **Accuracy**: Do the answers match what you'd find in the specifications?
2. **Usefulness**: Would this save you time compared to manual PDF searching?
3. **Missing features**: What else would you need to use this in your daily work?
4. **Trust level**: Would you trust these answers for initial research (with verification)?

Your feedback will directly shape the next version of this tool.
