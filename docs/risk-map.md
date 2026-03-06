# Yggdrasil Risk Map

Aligned with NIST AI 100-1 MAP function (MAP 1–4).

---

## 1. System Boundary

### 1.1 What Yggdrasil Controls

| Component | Description | Risk Level |
|-----------|-------------|------------|
| Neuron graph | 6-layer hierarchy (~546 neurons, 8 departments) | Medium — errors propagate to all queries |
| 5-signal scoring | Burst, Impact, Practice, Novelty, Recency | Medium — miscalibration degrades relevance |
| Spread activation | Child firing propagates up at 0.6x per layer | Low — amplifies signal, doesn't create it |
| Token-budgeted assembly | Selects top-K neurons within token limit | Low — truncation possible but configurable |
| Blind A/B evaluation | Compares model/context configurations | Low — measurement tool, not decision system |

### 1.2 What Yggdrasil Does NOT Control

| Component | Owner | Risk to Yggdrasil |
|-----------|-------|-------------------|
| LLM answer generation | Anthropic (Claude API) | **High** — hallucination, refusal, quality drift |
| LLM classification accuracy | Anthropic (Claude Haiku) | **Medium** — misclassification routes to wrong neurons |
| Network availability | ISP / Cloud provider | **Medium** — no offline fallback |
| User interpretation of answers | End user | **High** — Yggdrasil cannot enforce human review |

---

## 2. Failure Mode Analysis

### 2.1 Scoring Failures

| Failure Mode | Cause | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| **Zero-hit query** | Query topic has no matching neurons | LLM answers from general knowledge only (no context enrichment) | Medium | Neuron coverage monitoring; expand graph for uncovered topics |
| **Wrong-department routing** | Haiku misclassifies intent | Top neurons come from irrelevant department | Low-Medium | Classification accuracy tracked in query logs; spread activation provides cross-department reach |
| **Signal dominance** | One signal (e.g., Burst) overwhelms others | Recently-fired neurons always win regardless of relevance | Low | 5-signal design prevents single-signal dominance; weight calibration via A/B testing |
| **Spread amplification of bad neuron** | Incorrect neuron fires, children propagate | Error amplified across related neurons | Low | Spread decay (0.6x per layer) limits blast radius; neuron content review on refine |
| **Stale neurons** | Content not updated as domain evolves | Outdated information presented as current | Medium | Recency signal partially addresses this; manual content audits needed |

### 2.2 Assembly Failures

| Failure Mode | Cause | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| **Token truncation** | Top-K neurons exceed token budget | Critical context cut; less relevant neurons included instead | Low | Configurable budget (1K–32K); user can increase if answers seem incomplete |
| **Context dilution** | Too many low-relevance neurons included | LLM distracted by irrelevant context, answer quality drops | Medium | Score threshold filtering; token budget forces prioritization |
| **Prompt injection via neuron** | Malicious content in neuron body | Neuron content could manipulate LLM behavior | Very Low (content is author-controlled) | Content review on creation/refine; no external neuron sources |

### 2.3 Execution Failures

| Failure Mode | Cause | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| **LLM hallucination** | Model generates plausible but incorrect answer despite good context | User receives wrong information | Medium | Neuron provenance shows which sources informed the answer; human review required |
| **LLM refusal** | Model refuses to answer due to safety filters | No answer returned | Low | Aerospace domain queries rarely trigger safety filters |
| **Model quality drift** | Anthropic updates model weights | Answer quality changes without system change | Low-Medium | Blind A/B framework detects drift; pin model version if available |
| **API rate limiting / outage** | Provider-side issue | System unavailable | Low | No current fallback; future: cache recent queries, offline classification |

### 2.4 Human Factors Failures

| Failure Mode | Cause | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| **Over-reliance on answers** | User treats LLM output as authoritative | Incorrect decisions based on AI output | Medium | UI shows neuron provenance to encourage verification; system is advisory only |
| **Automation bias** | User skips review when system is usually right | Errors missed when system is wrong | Medium | A/B quality scores visible to user; confidence indicators planned |
| **Refine without review** | User applies LLM-generated neuron refinements without reading them | Bad content enters knowledge graph | Low | Refine output displayed for review before commit; no auto-apply |

---

## 3. Knowledge Boundaries

### 3.1 Covered Domains

The neuron graph currently covers:
- Aerospace manufacturing processes and terminology
- Defense program management (FAR/DFARS, contract types)
- Quality systems (AS9100, AS9145, ISO 9001)
- Regulatory compliance (ITAR/EAR, CMMC, NIST 800-171)
- ERP and business systems (SAP)
- Data engineering (Databricks ELT)
- Executive leadership and business development
- Finance and cost accounting

### 3.2 Known Coverage Gaps

| Topic | Status | Impact |
|-------|--------|--------|
| Software engineering (beyond data engineering) | Minimal neurons | Queries about software dev get generic answers |
| Supply chain management | Sparse | Limited context for procurement/logistics queries |
| Human resources | No neurons | Zero enrichment for HR-related queries |
| International programs (non-US defense) | No neurons | US-only regulatory knowledge |
| Advanced manufacturing (additive, composites) | Partial | Some process neurons but limited depth |

### 3.3 Out-of-Scope Topics

The system should **not** be used for:
- Medical or health-related decisions
- Legal advice (despite author's J.D., system is not a legal tool)
- Classified program details (system has no classified data)
- Real-time operational decisions (system is for knowledge retrieval, not operations)
- Financial investment decisions

---

## 4. Deployment Constraints

### 4.1 Environment Requirements

| Constraint | Specification |
|------------|--------------|
| Network | Requires internet access for Anthropic API |
| Data classification | Unclassified only. No CUI, no classified |
| Users | Currently single-user (developer). Multi-user requires auth and access control |
| Hosting | Local development server. No production hardening |
| Availability | Best-effort. No SLA |

### 4.2 Human Oversight Requirements

| Activity | Oversight Level |
|----------|----------------|
| Query execution | **None required** — advisory output, user reviews |
| Neuron refinement | **Required** — human must review LLM suggestions before applying |
| Scoring weight changes | **Required** — must be documented and A/B validated |
| New neuron bulk import | **Required** — content review and parent chain verification |
| A/B evaluation interpretation | **Required** — human judges quality metrics |

### 4.3 Scaling Risks

| If Yggdrasil scales to... | New risks introduced |
|---------------------------|---------------------|
| Multiple users | Access control needed; query logs become multi-tenant; concurrent scoring load |
| Production deployment | Uptime requirements; need monitoring/alerting; backup/recovery for neuron DB |
| Classified environments | Air-gapped deployment; no API access; need local model or deterministic classification |
| Safety-critical use | Full TEVV required; independent V&V; cannot rely on LLM for authoritative answers |

---

## 5. Third-Party Risk Map

### 5.1 Anthropic API

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API deprecation | Low | High — all LLM functions break | Model-agnostic architecture allows swap; need testing |
| Pricing increase | Medium | Medium — cost-quality optimization exists | A/B framework can evaluate cheaper alternatives |
| Data handling policy change | Low | Medium — query data sent to API | Monitor Anthropic ToS; API data not used for training (current policy) |
| Model behavior change | Medium | Medium — quality drift | Blind A/B detects; version pinning if available |

### 5.2 Python Dependencies

| Package | Risk | Mitigation |
|---------|------|------------|
| FastAPI | Low — stable, well-maintained | Pin version |
| SQLAlchemy + aiosqlite | Low | Pin version; SQLite is zero-dependency |
| Anthropic SDK | Medium — tied to API changes | Pin version; abstract API calls |

---

## 6. Trustworthiness Assessment

Mapped to NIST AI RMF Section 3 trustworthiness characteristics.

| Characteristic | Current State | Gap |
|---|---|---|
| **Valid & Reliable** | Blind A/B framework validates quality. No ongoing production monitoring. | Add drift detection, scoring distribution monitoring |
| **Safe** | System is advisory only, no autonomous actions. No stress testing. | Add adversarial query test suite |
| **Secure & Resilient** | No red-teaming. No prompt injection testing. Single-user so attack surface is minimal. | Add security test suite before multi-user deployment |
| **Accountable & Transparent** | Full neuron provenance. Every query logged with scores, hits, assembled prompt. | Strong. Add user-facing explanation of scoring methodology |
| **Explainable & Interpretable** | Radial visualization shows neuron activation. 5 named signals are interpretable. | Strong. Could add natural-language explanations of "why these neurons" |
| **Privacy-Enhanced** | No PII in neuron content (policy). Queries logged locally only. | Formal PII audit needed. No anonymization if multi-user |
| **Fair (Bias Managed)** | No formal bias assessment. Department coverage may be uneven. | Add department coverage analysis; evaluate if scoring favors certain roles |

---

## References

- NIST AI 100-1: Artificial Intelligence Risk Management Framework 1.0 (January 2023)
- Relevant MAP subcategories: 1.1–1.6, 2.1–2.3, 3.1–3.5, 4.1–4.2
