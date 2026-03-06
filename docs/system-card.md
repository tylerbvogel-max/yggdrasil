# Yggdrasil System Card

Model card / system card following NIST AI RMF transparency practices (MEASURE 2.1, 2.9).

---

## System Identity

| Field | Value |
|-------|-------|
| **Name** | Yggdrasil |
| **Version** | 1.0 (development) |
| **Type** | LLM prompt preparation / knowledge retrieval system |
| **Developer** | Tyler B. Vogel |
| **Date** | 2024–2025 |
| **Status** | Active development, single-user |

---

## Purpose

Yggdrasil improves LLM answer quality for domain-specific queries by scoring and assembling relevant knowledge (neurons) into a structured system prompt. It is designed to prove that lightweight models (Claude Haiku) with structured context can match expensive models (Claude Opus) at ~92% cost reduction.

**Primary use case:** Aerospace domain knowledge retrieval for regulated industries.

**Not intended for:** Safety-critical decisions, classified environments, autonomous operation, medical/legal/financial advice.

---

## Architecture

```
User Query
    |
    v
[Stage 1: Classification] — Claude Haiku
    |  Extracts: intent, departments, roles, keywords
    v
[Neuron Scoring Engine] — Deterministic (no LLM)
    |  5 signals: Burst, Impact, Practice, Novelty, Recency
    |  Spread activation: 0.6x decay per layer
    v
[Token-Budgeted Assembly] — Deterministic (no LLM)
    |  Selects top-K neurons within configurable token budget
    v
[Stage 2: Execution] — Claude Haiku/Sonnet/Opus (user choice)
    |  Enriched system prompt + user query
    v
Response + Full Provenance (neuron hits, scores, assembled prompt)
```

### Component Details

| Component | Implementation | LLM-Dependent? |
|-----------|---------------|-----------------|
| Query classification | Anthropic Claude Haiku | Yes |
| Neuron scoring | Python, 5-signal weighted sum | No |
| Spread activation | Python, recursive parent propagation | No |
| Prompt assembly | Python, token-counted concatenation | No |
| Query execution | Anthropic Claude (configurable) | Yes |
| Neuron refinement | Anthropic Claude (configurable) | Yes |
| Blind A/B evaluation | Python, statistical comparison | No |

---

## Data

### Knowledge Graph

| Metric | Value |
|--------|-------|
| Total neurons | ~546 |
| Departments | 8 |
| Layers | 6 (L0 Department → L5 Output/Communication) |
| Largest subtree | Data Engineering (~242 neurons) |

### Data Sources

- Neuron content is authored from **publicly available** aerospace domain knowledge
- No proprietary, classified, CUI, or ITAR-controlled data
- No personally identifiable information (PII)
- No training data from external datasets — all content is manually authored or LLM-assisted with human review

### Data Storage

| Data | Location | Retention |
|------|----------|-----------|
| Neuron graph | SQLite (local) | Persistent, version-controlled |
| Query logs | SQLite (local) | Persistent |
| A/B evaluation results | SQLite (local) | Persistent |
| API calls | Anthropic servers | Per Anthropic data retention policy (not used for training via API) |

---

## Performance

### Validated Claims

| Claim | Method | Result |
|-------|--------|--------|
| Haiku + structured context ≈ Opus quality | Blind A/B evaluation framework | ~92% cost reduction at comparable quality for aerospace domain queries |
| Model-agnostic architecture | No provider-specific code in scoring/graph/assembly | Confirmed — only classification and execution use Anthropic SDK |
| Full audit provenance | Every query logged with intent, scores, neuron hits, assembled prompt | Confirmed |

### Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No production monitoring / drift detection | Quality degradation may go undetected | Manual A/B re-evaluation; planned: automated monitoring |
| Single-model classification | Misclassification routes query to wrong department | Spread activation provides cross-department reach |
| No adversarial testing | Unknown robustness to prompt injection or adversarial queries | Planned: adversarial test suite |
| Coverage gaps in knowledge graph | Some roles have skeletal neurons (<3 per role) | Ongoing neuron bolstering effort |
| No offline/air-gapped mode | Cannot operate without internet | Planned: deterministic classifier fallback (backlog) |
| English only | Non-English queries may classify poorly | No plans for multilingual support currently |

---

## Scoring Methodology

### 5-Signal System

| Signal | What It Measures | Weight Behavior |
|--------|-----------------|-----------------|
| **Burst** | Recent firing frequency spike | Rewards neurons actively relevant to current query patterns |
| **Impact** | Historical importance across all queries | Rewards consistently useful neurons |
| **Practice** | Depth of content (word count, structure) | Rewards well-developed neurons over stubs |
| **Novelty** | How rarely the neuron fires | Rewards bringing in diverse, less-obvious context |
| **Recency** | Time since last firing | Rewards recently-validated neurons |

### Spread Activation

When a neuron fires, its parent chain receives propagated signal:
- Direct parent: 0.6x of child score
- Grandparent: 0.36x (0.6 x 0.6)
- Great-grandparent: 0.216x (0.6^3)
- Continues to root (L0 Department)

This ensures that activating a specific task neuron (L2) also boosts its role (L1) and department (L0), providing hierarchical context.

---

## Ethical Considerations

### Bias Risk

- **Department coverage bias:** Some departments have significantly more neurons than others (Data Engineering: 242 vs. others: <50). Queries in well-covered domains get richer context.
- **Authorship bias:** All neuron content reflects a single author's domain perspective. No external validation of content accuracy.
- **Scoring bias:** Signal weights may inadvertently favor certain query patterns. No formal bias audit conducted.

### Transparency

- Every query produces a full provenance chain visible in the UI
- Neuron scores are decomposed into individual signal contributions
- Radial visualization shows which departments and layers were activated
- Users can inspect the exact assembled prompt sent to the LLM

### Privacy

- No PII in neuron content (enforced by policy, not automated scanning)
- Query text is sent to Anthropic API — users should not include PII in queries
- All data stored locally; no telemetry or analytics sent to third parties

---

## Governance

- **Governance framework:** `docs/governance.md`
- **Risk map:** `docs/risk-map.md`
- **NIST alignment:** AI 100-1 (AI Risk Management Framework 1.0)
- **Incident log:** `docs/incidents.md` (created as needed)

---

## Contact

| Role | Person | Contact |
|------|--------|---------|
| System Owner / Developer | Tyler B. Vogel | tyler.b.vogel@gmail.com |

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2025-03 | Initial system card created | Tyler B. Vogel |
