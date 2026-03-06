# Yggdrasil: Domain Knowledge Acquisition and Maintenance Strategy

**Date:** March 5, 2026
**Classification:** Internal / Pre-Decisional
**Version:** 1.0

---

## 1. The Verification Problem

Yggdrasil's auditability thesis requires that neuron content is traceable, current, and accurate. LLM-generated neurons (via the bolster pipeline) cite specific regulatory references — FAR clauses, MIL-STD sections, threshold values, compliance criteria — that may be hallucinated or outdated. An auditable chain to incorrect content is worse than no chain at all, because it demonstrates systematic reliance on unverified AI-generated information.

Solving this requires two capabilities:
1. **Initial verification** — confirming that neuron content accurately reflects the source regulation at time of creation
2. **Ongoing maintenance** — detecting when source regulations change and propagating those changes through the neuron graph

---

## 2. Regulatory Source Classification

Regulatory sources fall into two categories with fundamentally different automation characteristics.

### Category A — Government Regulations with Machine-Readable APIs

These regulations are published in the Code of Federal Regulations (CFR) and amended via Federal Register notices. Both have structured APIs enabling automated change detection.

| Regulation | CFR Location | Neuron Roles Affected |
|---|---|---|
| FAR (Federal Acquisition Regulation) | 48 CFR Ch.1 | Contract Analyst, Contracts Mgr, FAR/DFARS Specialist, Procurement, CFO, Cost Accountant |
| DFARS (Defense FAR Supplement) | 48 CFR Ch.2 | All Contracts & Compliance roles, Supply Chain Mgr, IT Support |
| ITAR (International Traffic in Arms Regulations) | 22 CFR 120-130 | Export Control Officer, CTO, VP BD |
| EAR (Export Administration Regulations) | 15 CFR 730-774 | Export Control Officer |
| OSHA General Industry Standards | 29 CFR 1910 | Safety Officer, Facilities Mgr, Production Mgr |
| CAS (Cost Accounting Standards) | 48 CFR 99 | CFO, Cost Accountant, Financial Analyst |
| Davis-Bacon / Service Contract Act | 29 CFR 1, 4 | Payroll Specialist, HR Generalist |

**Key APIs:**
- **Federal Register API** — `https://www.federalregister.gov/api/v1` — REST API returning structured JSON for all published rules, proposed rules, and notices. Queryable by CFR title, part, and section. Returns affected sections, effective dates, FR document numbers, and full text. No authentication required.
- **eCFR API** — `https://ecfr.gov/api/versioner/v1` — Versioned Code of Federal Regulations. Returns current regulatory text for any CFR title/part/section. Supports historical version queries by date, enabling automated diffing between versions.
- **SAM.gov API** — Wage determinations, entity data, contract opportunities.

### Category B — Standards Body Publications (Copyrighted, Paywalled)

These standards are published by professional organizations and sold commercially. Full text cannot be legally scraped or stored. Change detection is limited to monitoring revision announcements.

| Standard | Publisher | Typical Revision Cycle | Monitoring Method |
|---|---|---|---|
| AS9100 (Aerospace QMS) | SAE/IAQG | 7-10 years | IAQG website, SAE revision notices |
| ASME Y14.5 (GD&T) | ASME | 9-10 years | ASME standards announcements |
| DO-178C / DO-254 / DO-160G | RTCA | 10-15+ years | RTCA publications page, FAA AC updates |
| SAE AS6500 (Mfg Management) | SAE | Varies | SAE standards page |
| NADCAP Audit Criteria | PRI/NADCAP | 1-3 years per checklist | eAuditNet notifications |
| NAS 410 (NDT Qualification) | SAE | 5-7 years | SAE revision notices |
| ASTM Standards | ASTM | Varies by standard | ASTM alerts by standard number |
| ISO 9001 / 14001 / 45001 | ISO | 7-10 years | ISO revision announcements |
| NIST SP 800-171 / 800-53 | NIST | 2-5 years | NIST CSRC publication notices |
| CMMC | DoD CIO | Evolving | dodcio.defense.gov/CMMC updates |
| MIL-STDs | DoD | Varies | ASSIST (assist.dla.mil) change notices |

**Hybrid: MIL-STDs** — Freely available on EverySpec/ASSIST but published as monolithic PDFs with no change-tracking API. ASSIST offers notification registration for specific document numbers. Treat as Category B for monitoring, but full text is available for verification.

---

## 3. Automated Regulatory Monitoring Architecture

### 3.1 Change Detection Pipeline (Category A)

**Polling Service:** A scheduled job (daily for high-change sources like FAR/DFARS, weekly for slower sources like OSHA) queries the Federal Register API for new final rules affecting monitored CFR parts.

```
Federal Register API query pattern:
GET /api/v1/documents
  ?conditions[type]=RULE
  &conditions[cfr][title]=48        # FAR
  &conditions[cfr][part]=31         # Cost Principles
  &conditions[publication_date][gte]=YYYY-MM-DD  # Since last check
```

Returns: FR document number, affected CFR sections, effective date, summary text, and full amendment text in structured JSON.

**Diff Generation:** When a change is detected, query the eCFR versioner API for the affected section text before and after the effective date. The diff represents the regulatory "commit."

```
eCFR API query pattern:
GET /api/versioner/v1/full/YYYY-MM-DD/title-48.xml
  ?part=31&section=31.205-18

Compare against stored baseline to generate structured diff.
```

**Impact Mapping:** Query the neuron citation index (see Section 4) to identify all neurons referencing the changed regulation. Generate first-order (direct citation) and second-order (semantic similarity via RAG) impact lists.

**Flagging:** Affected neurons receive staleness markers:
- `regulatory_change_detected: true`
- `change_source: "FR-2026-XXXXX"` (Federal Register document number)
- `change_effective_date: "YYYY-MM-DD"`
- `change_summary: "..."` (from FR API response)

**Update Workflow:** A bolster call is generated with the regulatory diff as context, targeting the flagged neurons. The bolster output is reviewed by a human before application. On application, the neuron's provenance updates to reflect the new regulatory version.

### 3.2 Change Monitoring (Category B)

For standards body publications, automated monitoring is limited to detecting that a change has occurred, not what changed.

**Announcement Monitoring:**
- Monitor SAE, ASME, RTCA, ASTM, ISO, and NIST publication pages for revision notices to tracked standard numbers
- Monitor FAA Advisory Circulars for updated acceptances (e.g., new AC accepting a revised DO standard)
- Monitor eAuditNet for NADCAP audit criteria updates
- Register for ASSIST notifications on tracked MIL-STD document numbers

**Manual Trigger:** The system must support a manual "regulatory change detected" input for changes that automated monitoring cannot catch — industry conference announcements, customer notifications, trade publication alerts, LinkedIn posts from auditors. A human enters the standard number, revision identifier, and summary of changes.

**Flagging and Update:** Same workflow as Category A from the flagging step forward, except the diff is either manually provided (after obtaining the new revision) or summarized from publicly available revision summaries.

### 3.3 Monitoring Cadence Summary

| Source Type | Poll Frequency | Detection Method | Update Method |
|---|---|---|---|
| FAR/DFARS (48 CFR) | Daily | Federal Register API | Automated diff + bolster |
| ITAR/EAR (22/15 CFR) | Daily | Federal Register API | Automated diff + bolster |
| OSHA (29 CFR 1910) | Weekly | Federal Register API | Automated diff + bolster |
| CAS (48 CFR 99) | Weekly | Federal Register API | Automated diff + bolster |
| NIST publications | Weekly | NIST CSRC page monitoring | Manual diff + bolster |
| CMMC updates | Weekly | DoD CIO page monitoring | Manual diff + bolster |
| MIL-STDs | Monthly | ASSIST notifications | Manual review + bolster |
| SAE/IAQG standards | Monthly | SAE revision notices | Manual review + bolster |
| ASME standards | Monthly | ASME announcements | Manual review + bolster |
| RTCA standards | Quarterly | RTCA publications page | Manual review + bolster |
| NADCAP criteria | Monthly | eAuditNet notifications | Manual review + bolster |

---

## 4. Neuron Citation Index

A prerequisite for both change detection and propagation is a citation index mapping regulatory references to neurons.

### 4.1 Index Structure

```
regulatory_citations table:
  neuron_id       → integer (FK to neurons)
  citation_type   → enum: "cfr", "far_clause", "mil_std", "sae_standard", "nist_pub", "other"
  citation_key    → string (normalized reference, e.g., "FAR 31.205-18", "MIL-STD-810H", "NIST SP 800-171 3.5.3")
  citation_raw    → string (as it appears in neuron content)
  verified        → boolean (has a human confirmed this citation is accurate?)
  last_checked    → datetime (when was this citation last verified against the source?)
```

### 4.2 Index Population

**Initial build:** Parse all existing neuron `content` fields using regex patterns for known citation formats:
- FAR: `FAR \d+\.\d+(-\d+)?`
- DFARS: `DFARS 252\.\d+-\d+`
- CFR: `\d+ CFR \d+(\.\d+)?`
- MIL-STD: `MIL-STD-\d+[A-Z]?`
- NIST SP: `(NIST )?SP 800-\d+`
- AS/AMS/ARP: `A[SR][PM]?\d+`

**Ongoing maintenance:** Index updated automatically when neurons are created, updated, or bolstered.

### 4.3 Propagation: First-Order and Second-Order

When a regulatory change is detected for citation key X:

**First-order (deterministic):** Query citation index for all neurons where `citation_key = X`. These are direct references. Flag all.

**Second-order (semantic):** Embed the change description (summary + diff) and run RAG similarity search against all neuron content. Neurons with high similarity but no direct citation may describe processes that implement the changed regulation without citing it explicitly. Flag with lower confidence for human triage.

**Example propagation chain:**
```
Regulatory change: NIST SP 800-171 Rev 3 amends Control 3.5.3 (Identifier Management)

First-order hits (citation index):
  → NIST/CMMC role neurons citing "SP 800-171 3.5.3"
  → IT Support neurons citing "NIST SP 800-171"

Second-order hits (semantic similarity):
  → CTO cybersecurity governance neuron (describes identity management architecture)
  → Facilities Mgr CUI physical protection neuron (references access control)
  → Supply Chain Mgr DFARS 252.204-7012 flowdown neuron (implements 800-171 controls)
```

---

## 5. Neuron Provenance Model

Every neuron should carry provenance metadata enabling an auditor to assess the reliability of its content.

### 5.1 Provenance Fields

```
source_type:        "seed-data" | "bolster-unverified" | "bolster-verified" |
                    "human-authored" | "regulation-updated"
source_reference:   string (e.g., "BOLSTER-2026-03-05-f71fce", "FR-2026-04567", "SME: J. Smith")
regulatory_version: string (e.g., "FAR as of FAC 2025-07", "MIL-STD-810H Change 2")
created_at:         datetime
last_verified:      datetime
verified_by:        string (human reviewer or "auto-regulatory-check")
staleness_flag:     boolean
staleness_reason:   string (e.g., "FR-2026-04567 amends FAR 31.205-18")
```

### 5.2 Verification Lifecycle

```
Neuron created via bolster
  → source_type: "bolster-unverified"
  → verified: false

Human SME reviews content
  → source_type: "bolster-verified"
  → verified: true
  → last_verified: now
  → verified_by: "SME name"

Regulatory change detected
  → staleness_flag: true
  → staleness_reason: "FR-2026-XXXXX"
  → verified: false (reverts to unverified)

Update applied via bolster with regulatory diff
  → source_type: "regulation-updated"
  → source_reference: "FR-2026-XXXXX"
  → regulatory_version: updated
  → staleness_flag: false
  → verified: false (awaiting re-verification)

Human confirms updated content
  → verified: true
  → last_verified: now
```

---

## 6. Content Versioning

Every neuron content modification is preserved for auditability.

### 6.1 Version Table Structure

```
neuron_versions table:
  version_id      → integer (auto-increment)
  neuron_id       → integer (FK to neurons)
  content         → text (content at this version)
  summary         → text (summary at this version)
  change_reason   → string (e.g., "bolster", "regulatory update FR-2026-XXXXX", "manual edit")
  changed_by      → string (user, system, or bolster session ID)
  created_at      → datetime
```

### 6.2 Firing-to-Version Linkage

When a neuron fires for a query, the firing record includes the `version_id` that was active at the time. This enables retroactive auditing: "When this neuron informed Decision X on date Y, it contained this specific content, which reflected this specific regulatory version."

---

## 7. Implementation Priorities

### Phase 1 — Foundation (Immediate)
1. Add provenance fields (`source_type`, `verified`, `last_verified`) to neuron schema
2. Build citation index by parsing existing neuron content
3. Implement content versioning table
4. Link firing records to content versions
5. Backfill provenance for existing neurons (all current neurons tagged `bolster-unverified` or `seed-data` as appropriate)

### Phase 2 — Government Regulation Monitoring (Near-Term)
1. Build Federal Register API polling service for monitored CFR parts
2. Build eCFR diff generation for detected changes
3. Implement first-order impact mapping via citation index
4. Build flagging workflow (staleness markers on affected neurons)
5. Build update workflow (bolster with regulatory diff as context)

### Phase 3 — Standards Body Monitoring (Medium-Term)
1. Implement web monitoring for SAE, ASME, NIST, RTCA publication pages
2. Register for ASSIST notifications on tracked MIL-STD numbers
3. Build manual regulatory change input interface
4. Connect to same flagging and update workflow as Phase 2

### Phase 4 — Semantic Propagation (Medium-Term)
1. Implement second-order impact detection via RAG similarity search
2. Build propagation confidence scoring (direct citation = high, semantic match = medium)
3. Build human triage interface for second-order hits
4. Track propagation coverage metrics (% of neurons with verified provenance, % with current regulatory version)

---

## 8. Federal Register & eCFR API Reference

### Federal Register API
- **Base URL:** `https://www.federalregister.gov/api/v1`
- **Authentication:** None required
- **Rate limits:** Reasonable use; no published hard limit
- **Key endpoints:**
  - `GET /documents` — Search published documents by type, CFR citation, date range
  - `GET /documents/{fr_number}` — Full document details including affected CFR sections
- **Documentation:** `https://www.federalregister.gov/developers/documentation/api/v1`

### eCFR API
- **Base URL:** `https://ecfr.gov/api/versioner/v1`
- **Authentication:** None required
- **Key endpoints:**
  - `GET /full/{date}/title-{number}.xml` — Full title text as of a specific date
  - `GET /ancestry/{date}/title-{number}.xml` — Structure/TOC for a title as of a date
- **Version comparison:** Request same section at two different dates and diff the responses
- **Documentation:** `https://ecfr.gov/developer-resources`

### Implementation Note
Both APIs are maintained by the Office of the Federal Register (National Archives) and the Government Publishing Office. They are production-grade, publicly funded infrastructure. Response format is JSON (Federal Register) and XML (eCFR). The eCFR API supports section-level granularity, enabling precise diffs when a single subsection is amended.

---

*This strategy will be updated as monitoring capabilities are implemented and as the regulatory change detection pipeline matures.*
