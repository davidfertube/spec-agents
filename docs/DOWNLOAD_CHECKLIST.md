# Steel Specification Document Checklist

Complete list of documents to download for training Steel Agents RAG system.

## Download Sources
- **ASTM**: astm.org (subscription) or Scribd/archive.org
- **NACE/ISO**: nace.org or ISO store
- **API**: api.org
- **ASME**: asme.org

---

## Tier 1: Essential (Required for MVP)

| # | Document | Description | Status |
|---|----------|-------------|--------|
| 1 | ASTM A790/A790M-24 | Duplex Stainless Steel Pipe | [x] Downloaded |
| 2 | ASTM A312/A312M-25 | Austenitic Stainless Steel Pipe | [x] Downloaded |
| 3 | ASTM A240/A240M | Stainless Steel Plate/Sheet | [ ] Needed |
| 4 | ASTM A789/A789M | Duplex Stainless Steel Tubing | [x] Downloaded |
| 5 | ASTM A182/A182M | Forged Fittings/Flanges | [ ] Needed |

**Why Essential**: These cover 80%+ of common steel specification queries.

---

## Tier 2: Important (Production Ready)

| # | Document | Description | Status |
|---|----------|-------------|--------|
| 6 | ASTM A923 | Duplex Testing Methods | [ ] Needed |
| 7 | ASTM A276/A276M | Stainless Steel Bars/Shapes | [ ] Needed |
| 8 | ASTM A479/A479M | Stainless Bars for Vessels | [ ] Needed |
| 9 | ASTM A351/A351M | Austenitic Steel Castings | [ ] Needed |
| 10 | ASTM A890/A890M | Duplex Steel Castings | [ ] Needed |
| 11 | ASTM A872/A872M | Centrifugal Cast Duplex Pipe | [x] Downloaded |
| 12 | ASTM A1049/A1049M | Duplex Forgings | [x] Downloaded |
| 13 | ASTM A928/A928M | Welded Duplex Pipe | [ ] Needed |

**Why Important**: Covers specialty products and testing standards.

---

## Tier 3: Comprehensive (Industry Coverage)

| # | Document | Description | Status |
|---|----------|-------------|--------|
| 14 | NACE MR0175/ISO 15156 | Sour Service Requirements | [ ] Needed |
| 15 | API 6A | Wellhead Equipment | [ ] Needed |
| 16 | API 5L | Line Pipe | [ ] Needed |
| 17 | API 5LC | CRA Line Pipe | [ ] Needed |
| 18 | ASME B16.5 | Pipe Flanges | [ ] Needed |
| 19 | ASME B16.9 | Butt-Weld Fittings | [ ] Needed |
| 20 | ASME B31.3 | Process Piping | [ ] Needed |

**Why Comprehensive**: Covers O&G specific requirements and piping codes.

---

## Tier 4: Reference Standards

| # | Document | Description | Status |
|---|----------|-------------|--------|
| 21 | EN 10204 | Test Certificates (MTR) | [ ] Needed |
| 22 | ASTM G48 | Pitting Corrosion Testing | [ ] Needed |
| 23 | ASTM E562 | Ferrite Measurement | [ ] Needed |
| 24 | ASTM A370 | Mechanical Testing | [ ] Needed |
| 25 | ASTM E112 | Grain Size | [ ] Needed |
| 26 | ASTM A751 | Chemical Analysis | [ ] Needed |

**Why Reference**: Supporting standards for testing and certification.

---

## Golden Dataset Target

| Milestone | Documents | Q&A Pairs | Expected Accuracy |
|-----------|-----------|-----------|-------------------|
| MVP | 5 | 50 | 75% |
| Production | 15 | 150 | 85% |
| Enterprise | 25+ | 250+ | 90%+ |

---

## Current Status

**Downloaded**: 5 documents
**Needed**: 21 documents
**Progress**: 19% complete

### Next Steps
1. Download ASTM A240 (most critical gap)
2. Download ASTM A923 (testing methods)
3. Download NACE MR0175 (sour service)
4. Create golden dataset Q&A pairs for new documents

---

## Quality Checklist for Each Document

Before uploading, verify:
- [ ] PDF is text-searchable (not scanned image)
- [ ] Tables are intact and readable
- [ ] Current revision (not obsolete)
- [ ] Complete document (all pages)
- [ ] File size under 50MB

---

## Notes

### Common Grade Mappings
| Trade Name | UNS | ASTM Grade |
|------------|-----|------------|
| 2205 | S31803/S32205 | F51/F60 |
| 2507 | S32750 | F53 |
| 316L | S31603 | TP316L |
| 304 | S30400 | TP304 |
| 304L | S30403 | TP304L |
| 317L | S31703 | TP317L |

### Document Revision Priority
Always use the latest revision. Common current revisions:
- A790: 2024 (A790/A790M-24)
- A312: 2025 (A312/A312M-25)
- A789: 2023 (A789/A789M-23)
