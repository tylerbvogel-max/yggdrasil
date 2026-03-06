# Yggdrasil: Strategic Capability Memo

**System:** Yggdrasil — Biomimetic Neuron Graph for Prompt Preparation
**Date:** March 5, 2026
**Classification:** Internal / Pre-Decisional
**Version:** 1.0

---

## 1. Problem Statement

Organizations adopting large language models (LLMs) for knowledge work in regulated industries face three converging risks that current deployment approaches do not adequately address.

### 1.1 Cost Exposure from Model Pricing Dependency

Current LLM pricing follows a blitzscaling model. API providers (Anthropic, OpenAI, Google) are operating below cost to acquire market share and establish workflow dependency. Historical precedent — ride-sharing, cloud infrastructure, enterprise SaaS — indicates that once market consolidation occurs and switching costs are established, pricing will increase substantially.

For organizations deploying AI at scale across non-developer roles (program managers, engineers, contract specialists, quality auditors), per-query cost at frontier model pricing ($15-75/M output tokens) creates a direct and growing operating expense with no structural cost ceiling. An organization running 500 daily queries across 50 users at frontier model rates faces annualized costs that will increase without organizational control as providers adjust pricing.

The risk is compounded in defense/aerospace by procurement cycle constraints. Once a model provider is qualified within a system security plan, Authority to Operate (ATO), or CMMC boundary, switching providers requires re-qualification — a process measured in months, not days. Price increases during a contract period of performance cannot be mitigated by switching.

### 1.2 Auditability Gap in AI-Assisted Decision-Making

Federal contractors operating under FAR/DFARS, AS9100, and MIL-STD frameworks are subject to audit on the basis for engineering decisions, cost estimates, quality dispositions, and safety determinations. Current AI deployment methods — direct model queries, fine-tuned models, or basic retrieval-augmented generation (RAG) — do not provide an auditable chain from organizational knowledge through AI processing to decision output.

This gap will become a compliance exposure as AI adoption increases. The trajectory of federal oversight suggests that contracting officers, DCAA auditors, and DCMA quality representatives will begin asking not only "what decision did you make?" but "what role did AI play in that decision, and on what basis did the AI provide its input?"

The three common deployment approaches each fail the auditability requirement differently:

- **Direct model queries** — No organizational knowledge injection, no reproducibility, no documentation of what the model "knew" when it answered. The same question asked twice may produce different answers with no explanation for the variance.

- **Fine-tuning** — Organizational knowledge is embedded in model weights. The knowledge pathway from training data to specific output cannot be traced. An auditor asking "why did the model recommend this disposition?" receives no actionable answer. Additionally, fine-tuning creates vendor lock-in to a specific model architecture, directly amplifying the cost exposure from Problem 1.1.

- **Basic RAG** — Retrieved documents provide some traceability, but the retrieval mechanism (typically cosine similarity against embeddings) is itself a black box. "The system retrieved these three documents because their vector representations were mathematically similar to the query" is not an auditable basis for a regulated decision.

### 1.3 Knowledge Portability and Organizational Continuity

Organizational knowledge embedded in LLM fine-tuning or proprietary prompt libraries is neither portable nor inspectable. When personnel transition, when model providers change API terms, or when regulatory requirements mandate transparency into AI-assisted processes, organizations need knowledge assets that exist independently of any specific model, vendor, or platform.

Current approaches tie organizational knowledge to specific model architectures (fine-tuning), specific vendor ecosystems (prompt templates in proprietary platforms), or individual expertise (ad-hoc prompt engineering by skilled users). None of these survive a vendor transition, a model deprecation, or a personnel change without significant reconstruction effort.

---

## 2. Solution Architecture

Yggdrasil addresses these three problems through a structured, model-agnostic knowledge graph that separates organizational knowledge from model execution. The system enriches low-cost model queries with scored, traceable domain knowledge to produce answers competitive with frontier models at a fraction of the cost, while maintaining a complete audit trail from knowledge source through scoring to assembled prompt.

### 2.1 Core Concept: Two-Stage Prompt Preparation

Rather than sending raw queries to an expensive model and hoping it has relevant knowledge, Yggdrasil interposes a knowledge preparation layer:

**Stage 1 — Classification:** A low-cost model (Haiku) analyzes the incoming query to extract intent, relevant departments, roles, and keywords. This classification is deterministic in its output structure and logged.

**Stage 2 — Knowledge Assembly and Execution:** The classification drives a deterministic scoring engine that selects the most relevant knowledge units ("neurons") from a structured graph. These neurons are assembled into an enriched system prompt. The query is then executed by a low-cost model operating with the full benefit of curated organizational knowledge.

The result: a model that costs 1/60th of the frontier tier produces answers informed by the same depth of domain knowledge that would otherwise require the most expensive model — or a human subject matter expert.

### 2.2 The Neuron Graph

Organizational knowledge is stored in a six-layer hierarchy modeled on the functional structure of a defense/aerospace manufacturing organization:

| Layer | Type | Function | Example |
|-------|------|----------|---------|
| L0 | Department | Organizational division | Engineering, Contracts & Compliance |
| L1 | Role | Functional role | Systems Engineer, Export Control Officer |
| L2 | Task | Core responsibility domain | Requirements engineering and traceability |
| L3 | System | Operational process or methodology | Bidirectional RTM maintenance per NASA SE Handbook |
| L4 | Decision | Governed decision framework with criteria | Rebaseline trigger: CPI < 0.85 for 3 consecutive months |
| L5 | Output | Deliverable template or artifact | Monthly Program Status Review briefing (12-slide format) |

Each neuron contains structured content referencing specific standards (MIL-STD, FAR/DFARS, AS9100, ITAR, NIST SP 800-171, etc.), providing the model with authoritative domain context rather than relying on the model's training data.

### 2.3 Deterministic Scoring Engine

Neurons are scored against each query using five signals:

| Signal | Measures | Characteristic |
|--------|----------|---------------|
| Burst | Keyword and intent match to the current query | Stateless, query-dependent |
| Impact | Historical utility ratings from prior queries | Cumulative, quality-weighted |
| Practice | Firing frequency across all queries | Cumulative, usage-weighted |
| Novelty | Recency of neuron creation | Decaying, time-based |
| Recency | Recency of last firing | Decaying, time-based |

The scoring is deterministic and reproducible: given the same query classification and the same neuron state, the same neurons will be selected. Every scoring event is logged with the specific signal values and weights that produced the selection.

### 2.4 How This Addresses Each Problem

**Cost exposure (1.1):** The knowledge graph is model-agnostic. It enriches whatever model executes the query. If pricing changes, the execution model can be swapped (Haiku to an open-source alternative, Sonnet to a competitor's mid-tier) without losing the knowledge layer. The organizational investment is in the neurons, not the model.

**Auditability (1.2):** For any query, the system can produce: (a) the exact classification output, (b) the exact neurons that were scored and selected with their individual signal values, (c) the exact assembled prompt delivered to the model, and (d) the model's response. Every step except the final model generation is deterministic and reproducible. This provides a documented chain from organizational knowledge to AI-assisted output that can be presented to an auditor.

**Knowledge portability (1.3):** The neuron graph is stored in a standard SQLite database with JSON-exportable content. It is not embedded in model weights, not tied to a vendor API, and not dependent on any specific model architecture. It can be versioned, backed up, transferred, and inspected by non-technical stakeholders.

---

## 3. Current System Capabilities

### 3.1 Operational Components (Built)

| Component | Status | Description |
|-----------|--------|-------------|
| Neuron graph | Operational | 1,769 neurons across 51 roles in 9 departments, organized in 6-layer hierarchy |
| Two-stage pipeline | Operational | Haiku classification → 5-signal scoring → prompt assembly → model execution |
| Query Lab | Operational | Interactive query interface with full pipeline visibility |
| Scoring engine | Operational | Deterministic 5-signal neuron scoring with firing history logging |
| Bolster API | Operational | LLM-assisted bulk neuron creation and expansion using reference materials |
| Autopilot | Operational | Autonomous training loop: generate queries, evaluate, refine, apply |
| Explorer | Operational | Full neuron tree browser with scoring detail inspection |
| Dashboard | Operational | Neuron health visualization, firing patterns, and role coverage metrics |
| Pipeline view | Operational | Step-through visualization of classification and scoring stages |
| Evaluation system | Operational | Response quality rating with utility feedback loop into Impact signal |
| Backup system | Operational | Automated SQLite backup to Google Drive (rotating) and GitHub (JSON checkpoints) |
| RAG layer | Operational | Semantic retrieval complement using ChromaDB embeddings to address cold-neuron discovery |
| Tiered model routing | Operational | Query complexity classification routes simple queries to Haiku, complex queries to Sonnet/Opus |

### 3.2 Knowledge Coverage

The neuron graph currently provides deep coverage (60-100+ neurons with full L2→L5 hierarchy) for 11 roles, partial coverage (L2 skeleton with limited depth) for 16 roles, and skeletal coverage (under 20 neurons) for approximately 24 roles. Priority roles for expansion include all Engineering disciplines, Contracts & Compliance, Finance, Administrative & Support, and Regulatory standards.

A comprehensive reference library of freely available government publications, professional standards, and regulatory sources has been compiled to guide continued neuron development across all roles.

---

## 4. Development Roadmap: Closing Functional Gaps

The following development priorities are organized by their relationship to the three core problems and ranked by implementation urgency.

### 4.1 Auditability Hardening (Addresses Problem 1.2)

**4.1.1 Neuron Content Verification Tags**
*Priority: Immediate | Effort: Low*

Add `verified` status and `source` provenance fields to every neuron. Source categories: `seed-data` (manually authored), `bolster-unverified` (LLM-generated, not human-reviewed), `human-verified` (reviewed and confirmed by SME). Downstream consumers can weight neuron confidence accordingly. Unverified neurons that inform regulated decisions should be flagged in the audit trail.

**4.1.2 Content Versioning**
*Priority: High | Effort: Medium*

Implement a `neuron_versions` table that captures neuron content at each modification with timestamps. When a query fires a neuron, the firing record should reference the specific content version active at the time. This closes the gap where a neuron's content changes between the time it informed Decision A and Decision B — both decisions can be traced to the exact content that was active.

**4.1.3 Full Prompt Logging**
*Priority: High | Effort: Low*

Store the complete assembled system prompt for every production query alongside the existing classification and firing logs. Currently, the system logs which neurons fired but not the exact text delivered to the model. For full auditability, the complete prompt-response pair must be retrievable for any historical query.

**4.1.4 Query Classification: Advisory vs. Decisional**
*Priority: Medium | Effort: Low*

Add a classification dimension distinguishing informational queries ("summarize AS9100 clause 8.3") from decision-support queries ("should we accept this nonconforming material as use-as-is?"). Decisional queries trigger enhanced logging, mandatory verified-neuron preference in scoring, and a disclaimer in the response indicating that the output is AI-assisted and should be reviewed by authorized personnel before action.

### 4.2 Scoring and Retrieval Improvements (Addresses Problems 1.1 and 1.2)

**4.2.1 Cross-Reference Traversal**
*Priority: High | Effort: Medium*

Enable the scoring engine to follow `cross_ref_departments` links at query time. When neurons fire in one department, related neurons in cross-referenced departments are pulled into the scoring pool. This addresses the multi-domain query blind spot where critical knowledge exists in the graph but is invisible because the classifier only identified a subset of relevant departments.

**4.2.2 Cold-Start Mitigation**
*Priority: High | Effort: Medium*

Three of five scoring signals (Impact, Practice, Recency) reward neurons with prior firing history, creating a structural disadvantage for newly created neurons. As the graph grows beyond 2,000 neurons, large portions of bolstered content may never surface because it cannot overcome the scoring advantage of established neurons. Implement a minimum-exposure mechanism ensuring new neurons receive a baseline number of scoring opportunities before the cumulative signals dominate.

**4.2.3 Classifier Confidence Scoring**
*Priority: Medium | Effort: Low*

Add a confidence score to the stage-1 classification output. When confidence falls below a threshold (indicating ambiguous or cross-domain queries), route the classification to Sonnet for reclassification before proceeding to scoring. This addresses the single-point-of-failure risk where Haiku misclassifies a query and the entire downstream pipeline operates on incorrect department/role targeting.

**4.2.4 Query Decomposition for Complex Queries**
*Priority: Medium | Effort: Medium*

Complex queries spanning multiple domains are decomposed into 2-3 sub-queries, each scored and assembled independently. A final synthesis pass combines sub-answers. This increases cost by 2-3x per query but remains significantly cheaper than frontier model pricing and produces more complete answers for cross-domain questions.

### 4.3 Knowledge Quality and Integrity (Addresses Problems 1.2 and 1.3)

**4.3.1 Contradiction Detection**
*Priority: Medium | Effort: High*

As the neuron graph scales, neurons in different departments may provide contradictory guidance on the same regulation or process. Implement periodic cross-neuron consistency scanning that identifies content conflicts (e.g., two neurons citing different thresholds for the same FAR clause) and flags them for human resolution. This is essential for maintaining trust in the knowledge base as it grows.

**4.3.2 Regulatory Staleness Detection**
*Priority: Medium | Effort: Medium*

Regulations change. FAR is amended, MIL-STDs are revised, CMMC 2.0 replaced 1.0. Implement a staleness risk score based on the regulatory references within neuron content and known amendment cycles. Neurons referencing regulations with recent amendments are flagged for review. High-firing neurons with stale content are the highest-risk category — they are actively informing decisions with potentially outdated information.

**4.3.3 Bolster Quality Gate**
*Priority: Medium | Effort: Medium*

Add an intermediate evaluation step to the bolster pipeline. Before applying LLM-generated neurons, run a validation pass that checks: (a) cited regulatory references exist and are correctly attributed, (b) threshold values and criteria are internally consistent with existing neurons, and (c) parent-chain placement is correct (L4 decisions parent to L3 systems, not L2 tasks). Persist bolster sessions to the database rather than in-memory storage to prevent loss of API-generated content on process restart.

### 4.4 Neuron Graph Completion (Addresses All Problems)

**4.4.1 Role Depth Expansion**
*Priority: Ongoing | Effort: High*

Continue bolstering all 51 roles to target depth (60-100+ neurons for complex roles, 30-50 for administrative roles) using compiled reference materials from government publications, professional standards bodies, and regulatory sources. Current graph: 1,769 neurons. Target: 3,000+. Each role requires full L2→L5 hierarchy with specific standards citations.

**4.4.2 Parent Chain Integrity Verification**
*Priority: Ongoing | Effort: Low*

After each bolster cycle, validate that all neurons maintain correct parent-chain relationships (L5→L4→L3→L2→L1→L0). The bolster API occasionally misparents neurons (e.g., L4 decisions pointing to L2 tasks instead of L3 systems). Automated detection and correction ensures graph structural integrity.

### 4.5 Infrastructure Resilience (Addresses Problem 1.3)

**4.5.1 Session Persistence**
*Priority: Immediate | Effort: Trivial*

Move the bolster session store from in-memory to SQLite. Current implementation loses all pending bolster sessions on process restart, wasting API spend on content that was generated but could not be applied.

**4.5.2 Model Version Pinning**
*Priority: Low | Effort: Low*

Log the exact model ID and temperature parameter for every query execution. As model providers update their offerings, the same model name may refer to different underlying capabilities. Pinning and logging the specific version used bounds the non-deterministic space and supports reproducibility claims.

---

## 5. Strategic Position

Yggdrasil is not an AI product. It is a knowledge management architecture that happens to use AI models as an execution layer. The organizational value resides in the neuron graph — a structured, inspectable, version-controllable, model-agnostic knowledge asset that appreciates with use.

This distinction is strategically important. Organizations that invest in fine-tuning or proprietary model platforms are building on rented infrastructure. When pricing changes, when models are deprecated, or when regulatory scrutiny demands transparency, those investments are either stranded or require costly migration.

Yggdrasil's neuron graph is owned infrastructure. It can be exported, audited, transferred between model providers, and presented to regulators as the documented basis for AI-assisted decisions. As AI governance requirements mature across federal contracting, this architectural choice positions the organization to meet compliance requirements that competitors relying on opaque model deployments will struggle to satisfy.

---

*This document will be updated as development progresses and as the regulatory landscape for AI in federal contracting continues to evolve.*
