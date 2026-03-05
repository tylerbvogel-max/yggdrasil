"""Token-budgeted prompt assembly from top-K scored neurons.

Groups neurons by department > role for structural coherence.
Score-ordered packing with fallback to summary-only if content doesn't fit.
"""

from app.config import settings
from app.models import Neuron
from app.services.scoring_engine import NeuronScoreBreakdown

# Rough token estimation: ~4 chars per token
CHARS_PER_TOKEN = 4

INTENT_VOICE_MAP = {
    "compliance": "You are a compliance and regulatory expert. Respond with precision, cite specific regulations (FAR, DFARS, CAS), and flag any risk areas.",
    "engineering": "You are a senior aerospace engineer. Provide technically rigorous analysis, reference applicable standards (MIL-STD, DO-178C, AS9100), and include specific methods.",
    "data_engineer": "You are a senior data engineer specializing in Databricks and Apache Spark. Provide concrete code examples, reference specific APIs and configurations, and explain when to use each pattern.",
    "elt": "You are a senior data engineer specializing in Databricks and Apache Spark. Provide concrete code examples, reference specific APIs and configurations, and explain when to use each pattern.",
    "databricks": "You are a senior data engineer specializing in Databricks and Apache Spark. Provide concrete code examples, reference specific APIs and configurations, and explain when to use each pattern.",
    "pipeline": "You are a senior data engineer specializing in Databricks and Apache Spark. Provide concrete code examples, reference specific APIs and configurations, and explain when to use each pattern.",
    "finance": "You are a defense contractor financial analyst. Focus on cost accounting, EVM metrics, indirect rates, and DCAA compliance. Be precise with numbers.",
    "procurement": "You are a procurement and supply chain specialist. Reference FAR acquisition procedures, supplier qualification requirements, and material management practices.",
    "proposal": "You are a proposal management expert following Shipley methodology. Focus on win strategy, compliance with Section L/M, and competitive positioning.",
    "program_management": "You are a program manager for DoD aerospace programs. Focus on EVM, IMS, risk management, and CDRL deliverables.",
    "hr": "You are an HR specialist in a defense contractor environment. Focus on security clearances, NISPOM compliance, and workforce planning.",
    "safety": "You are a system safety engineer. Apply MIL-STD-882E hazard analysis framework. Focus on risk classification and mitigation.",
    "it_security": "You are a cybersecurity specialist focused on CMMC/NIST 800-171 compliance. Reference specific control families and implementation guidance.",
    "executive": "You are a senior aerospace executive. Provide strategic analysis with actionable recommendations, balancing program priorities, risk, and resource constraints.",
    "regulatory": "You are an aerospace regulatory compliance expert. Reference specific standard clauses, cite exact requirements, and explain applicability across affected departments.",
    "general_query": "You are a knowledgeable aerospace defense contractor expert. Provide clear, actionable guidance drawing on organizational expertise.",
}


def _estimate_tokens(text: str) -> int:
    return len(text) // CHARS_PER_TOKEN


def _get_voice(intent: str) -> str:
    """Match intent to behavioral voice framing."""
    intent_lower = intent.lower()
    for key, voice in INTENT_VOICE_MAP.items():
        if key in intent_lower:
            return voice
    return INTENT_VOICE_MAP["general_query"]


def assemble_prompt(
    intent: str,
    scored_neurons: list[NeuronScoreBreakdown],
    neuron_map: dict[int, Neuron],
    budget_tokens: int | None = None,
) -> str:
    """Pack top-K neurons into a system prompt within token budget.

    Groups by department > role for structural coherence.
    Falls back to summary-only if full content exceeds budget.
    """
    budget = budget_tokens or settings.token_budget

    # Header: intent-based voice framing
    header = _get_voice(intent)
    parts = [header, "", "## Reference Knowledge", ""]

    used_tokens = _estimate_tokens("\n".join(parts))

    # Partition neurons into functional vs regulatory
    functional: list[tuple[NeuronScoreBreakdown, Neuron]] = []
    regulatory: list[tuple[NeuronScoreBreakdown, Neuron]] = []
    for score in scored_neurons:
        neuron = neuron_map.get(score.neuron_id)
        if not neuron:
            continue
        if neuron.department == "Regulatory":
            regulatory.append((score, neuron))
        else:
            functional.append((score, neuron))

    # Group functional neurons by department > role_key
    grouped: dict[str, dict[str, list[tuple[NeuronScoreBreakdown, Neuron]]]] = {}
    for score, neuron in functional:
        dept = neuron.department or "General"
        role = neuron.role_key or "general"
        grouped.setdefault(dept, {}).setdefault(role, []).append((score, neuron))

    # Pack functional neurons score-ordered within groups
    for dept, roles in grouped.items():
        dept_header = f"### {dept}"
        dept_tokens = _estimate_tokens(dept_header)
        if used_tokens + dept_tokens > budget:
            break
        parts.append(dept_header)
        used_tokens += dept_tokens

        for role_key, items in roles.items():
            # Sort by score descending within role
            items.sort(key=lambda x: x[0].combined, reverse=True)

            for score, neuron in items:
                used_tokens = _pack_neuron(parts, score, neuron, used_tokens, budget)

    # Pack regulatory neurons in separate section
    if regulatory:
        reg_header = "\n## Regulatory Context"
        reg_tokens = _estimate_tokens(reg_header)
        if used_tokens + reg_tokens <= budget:
            parts.append(reg_header)
            used_tokens += reg_tokens

            # Group regulatory by role_key (standard family)
            reg_grouped: dict[str, list[tuple[NeuronScoreBreakdown, Neuron]]] = {}
            for score, neuron in regulatory:
                rk = neuron.role_key or "general"
                reg_grouped.setdefault(rk, []).append((score, neuron))

            for role_key, items in reg_grouped.items():
                items.sort(key=lambda x: x[0].combined, reverse=True)
                for score, neuron in items:
                    used_tokens = _pack_neuron(parts, score, neuron, used_tokens, budget)

    parts.append("")
    parts.append("Use the above knowledge to directly answer the user's question. Provide specific, actionable guidance with concrete examples and code where applicable.")

    return "\n".join(parts)


def _pack_neuron(
    parts: list[str],
    score: NeuronScoreBreakdown,
    neuron: Neuron,
    used_tokens: int,
    budget: int,
) -> int:
    """Try to pack a neuron into parts. Returns updated used_tokens."""
    if neuron.content:
        full_entry = f"**{neuron.label}** (L{neuron.layer}, score: {score.combined:.2f})\n{neuron.content}"
        full_tokens = _estimate_tokens(full_entry)
        if used_tokens + full_tokens <= budget:
            parts.append(full_entry)
            return used_tokens + full_tokens

    if neuron.summary:
        summary_entry = f"- {neuron.summary} (score: {score.combined:.2f})"
        summary_tokens = _estimate_tokens(summary_entry)
        if used_tokens + summary_tokens <= budget:
            parts.append(summary_entry)
            return used_tokens + summary_tokens

    return used_tokens
