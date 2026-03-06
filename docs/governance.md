# Yggdrasil Governance Framework

Aligned with NIST AI 100-1 (AI Risk Management Framework 1.0).

---

## 1. System Purpose & Scope

Yggdrasil is a **prompt preparation system** for LLM queries in regulated industries. It does not make autonomous decisions — it assembles context to improve LLM answer quality while reducing cost.

**What it does:**
- Classifies user queries by intent, department, and role
- Scores neurons (knowledge nodes) across a hierarchical graph using 5 weighted signals
- Assembles scored neurons into a token-budgeted system prompt
- Passes the enriched prompt to an LLM for execution

**What it does NOT do:**
- Make safety-critical decisions
- Operate autonomously without human review
- Access classified or controlled systems
- Modify its own scoring weights without human initiation

**Deployment context:** Aerospace domain knowledge retrieval. Not approved for safety-of-flight, weapon system, or personnel decisions.

---

## 2. Risk Tolerance

### 2.1 Acceptable Risks

| Risk | Tolerance | Rationale |
|------|-----------|-----------|
| Wrong neuron selection (irrelevant context) | **Medium** | LLM can still answer from general knowledge; user sees which neurons fired and can re-query |
| Suboptimal scoring (good neurons ranked low) | **Medium** | Token budget provides margin; blind A/B framework catches systemic quality drops |
| Token budget truncation (critical context cut) | **Low** | Configurable 1K–32K window mitigates this; user controls tradeoff |
| Hallucination pass-through | **Low** | Yggdrasil enriches context but cannot prevent LLM hallucination; human review required |
| Neuron content containing errors | **Low** | Errors propagate into every query that activates the neuron; refine process must include review |

### 2.2 Unacceptable Risks

| Risk | Policy |
|------|--------|
| System used for safety-of-flight decisions without human review | **Prohibited** |
| PII or ITAR-controlled data stored in neuron content | **Prohibited** — see Section 6 |
| Automated modification of neuron content without human approval | **Prohibited** — refine requires human initiation and review |
| Scoring weights changed without documentation | **Prohibited** — all weight changes must be versioned |

### 2.3 Risk Escalation Thresholds

| Metric | Yellow (Investigate) | Red (Stop Serving) |
|--------|---------------------|-------------------|
| Blind A/B quality score | Drops >15% from baseline | Drops >30% from baseline |
| Neuron coverage | >20% of queries hit zero neurons | >40% of queries hit zero neurons |
| User-reported bad answers | >10% of queries in a rolling week | >25% of queries in a rolling week |
| Token budget utilization | Consistently <20% (under-scoring) | N/A |

---

## 3. Roles & Responsibilities

### 3.1 System Owner
**Currently:** Tyler Vogel (sole developer)

Responsibilities:
- Neuron graph maintenance (adding, refining, retiring neurons)
- Scoring weight calibration
- Model selection and API key management
- Reviewing refine outputs before committing changes
- Monitoring query quality via blind A/B framework

### 3.2 Neuron Content Author
**Currently:** System Owner + LLM-assisted refine process

Responsibilities:
- Ensuring neuron content is factually accurate
- Ensuring no PII, ITAR, or proprietary data is embedded in neurons
- Maintaining parent chain integrity (every neuron traces to a department root)
- Flagging neurons for retirement when content becomes stale

### 3.3 Query Reviewer (Future Role)
For production deployment, queries and responses should be reviewable by domain experts who:
- Validate answer quality on a sampling basis
- Flag systematic errors for neuron correction
- Provide feedback that feeds into scoring weight calibration

### 3.4 Separation of Concerns

| Function | Responsible Party |
|----------|------------------|
| Neuron content creation | Author (human-initiated, LLM-assisted) |
| Neuron content approval | System Owner (reviews refine output) |
| Scoring weight changes | System Owner (documented in version control) |
| Query execution | Automated (no human approval per-query) |
| Quality monitoring | System Owner via A/B framework |

---

## 4. Incident Response

### 4.1 Incident Categories

| Severity | Description | Example | Response Time |
|----------|-------------|---------|---------------|
| **P1 — Critical** | System produces dangerous or legally problematic output | Answer recommends bypassing safety procedures; ITAR-controlled content surfaces | Immediate: disable system |
| **P2 — High** | Systematic quality degradation | A/B scores drop >15%; multiple users report wrong answers on same topic | Within 24 hours: investigate root cause |
| **P3 — Medium** | Individual bad answer | Single query returns irrelevant context; one neuron scores anomalously | Next maintenance cycle: review neuron |
| **P4 — Low** | Cosmetic or UX issue | Token budget display incorrect; UI rendering glitch | Backlog |

### 4.2 Response Procedures

**P1 — Critical:**
1. Disable query execution endpoint
2. Preserve query log (query text, neuron scores, assembled prompt, LLM response)
3. Identify offending neuron(s) or scoring behavior
4. Fix or quarantine neuron content
5. Re-enable with monitoring
6. Document incident in `docs/incidents.md`

**P2 — High:**
1. Pull A/B evaluation data for affected time period
2. Compare neuron score distributions against baseline
3. Identify if cause is neuron content, scoring weights, or model behavior change
4. Apply fix and re-run A/B validation
5. Document in `docs/incidents.md`

**P3/P4:**
1. Log in issue tracker
2. Address in next maintenance cycle

### 4.3 Incident Log

All incidents are recorded in `docs/incidents.md` with:
- Date and time
- Query that triggered the incident (if applicable)
- Root cause analysis
- Corrective action taken
- Verification that fix resolved the issue

---

## 5. Model Dependency Management

### 5.1 Current Dependencies

| Component | Model | Provider | Purpose |
|-----------|-------|----------|---------|
| Query classification | Claude Haiku | Anthropic | Intent extraction, department/role tagging |
| Query execution | Claude Haiku (default) | Anthropic | Answer generation with enriched context |
| Query execution (optional) | Claude Sonnet / Opus | Anthropic | Higher-quality execution for complex queries |
| Neuron refinement | Claude Haiku / Sonnet / Opus | Anthropic | Content improvement suggestions |

### 5.2 Vendor Lock-in Mitigation

- Scoring engine has **zero** provider-specific dependencies
- Knowledge graph is stored in SQLite, not a vendor service
- Prompt assembly is model-agnostic (plain text, no function calling)
- Only the LLM execution and classification stages depend on Anthropic API

### 5.3 Contingency Plan

| Scenario | Response |
|----------|----------|
| Anthropic deprecates Haiku | Switch classification to Sonnet or alternative lightweight model; scoring/assembly unaffected |
| Anthropic API outage | System cannot serve queries; no fallback currently implemented |
| Pricing change makes Haiku uneconomical | Evaluate OpenAI/Google alternatives for classification; A/B test before switching |
| Model behavior change degrades quality | Detect via A/B framework; pin to specific model version if available |

**Future consideration:** Add a local/offline classification fallback (TF-IDF or keyword-based) for air-gapped deployments. Documented in NextSteps UI as backlog item.

---

## 6. Data Governance

### 6.1 Neuron Content Policy

Neuron content **must not** contain:
- Personally Identifiable Information (PII)
- ITAR-controlled technical data
- Export-controlled information (EAR)
- Proprietary data belonging to any employer or client
- Classified or CUI-marked information

Neuron content **should** contain:
- General domain knowledge (publicly available aerospace concepts)
- Process descriptions at a non-proprietary level
- Regulatory framework references (AS9100, CMMC, FAR/DFARS)
- Role and task descriptions generic to the industry

### 6.2 Query Data Retention

- All queries are logged with: timestamp, query text, intent classification, neuron scores, assembled prompt, LLM response
- Query logs are stored locally in SQLite
- No query data is transmitted to third parties beyond the Anthropic API call
- Anthropic's data retention policy applies to API calls (currently: not used for training with API)

### 6.3 Review Cadence

| Activity | Frequency |
|----------|-----------|
| Neuron content audit for PII/ITAR | Before each major neuron expansion |
| Query log review for anomalies | Weekly during active development |
| A/B quality baseline recalibration | Monthly or after scoring weight changes |
| Full governance doc review | Quarterly |

---

## 7. Change Management

### 7.1 Changes Requiring Documentation

| Change Type | Documentation Required |
|-------------|----------------------|
| Scoring weight modification | Git commit with rationale; A/B re-validation |
| New neuron addition (>10 neurons) | Parent chain verification; content review |
| Model swap (classification or execution) | A/B comparison against previous model; documented in this file |
| Deployment context change | Risk map update; governance review |

### 7.2 Version Control

All configuration changes (scoring weights, signal parameters, token budgets) are tracked in git. No configuration is stored outside version control.

---

## References

- NIST AI 100-1: Artificial Intelligence Risk Management Framework 1.0 (January 2023)
- NIST AI RMF Playbook (https://airc.nist.gov/AI_RMF_Knowledge_Base/Playbook)
- Relevant GOVERN subcategories: 1.1–1.7, 2.1–2.3, 4.1–4.3, 5.1–5.2, 6.1–6.2
