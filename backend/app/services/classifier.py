"""Stage 1: Intent classification via Claude CLI."""

import json

from app.services.claude_cli import claude_chat

CLASSIFY_SYSTEM_PROMPT = """You are a query classifier for an aerospace defense contractor organization.
Given a user query, classify it into:
1. intent: A short label describing the intent (e.g., "compliance_risk_review", "engineering_analysis", "cost_reporting", "procurement_request", "proposal_development")
2. departments: List of relevant departments from: ["Executive Leadership", "Engineering", "Contracts & Compliance", "Manufacturing & Operations", "Business Development", "Administrative & Support", "Finance", "Program Management"]
3. role_keys: List of relevant role keys from: ["ceo", "coo", "cto", "cfo", "vp_engineering", "vp_operations", "vp_bd", "mech_eng", "elec_eng", "sw_eng", "sys_eng", "mfg_eng", "test_eng", "contract_analyst", "export_control", "far_specialist", "quality_auditor", "safety_officer", "prod_mgr", "quality_mgr", "supply_chain_mgr", "facilities_mgr", "bd_director", "proposal_mgr", "capture_mgr", "hr_generalist", "it_support", "procurement", "payroll", "financial_analyst", "cost_accountant", "program_mgr"]
4. keywords: List of 3-8 relevant technical keywords

Respond ONLY with valid JSON, no markdown formatting:
{"intent": "...", "departments": [...], "role_keys": [...], "keywords": [...]}"""


async def classify_query(message: str) -> dict:
    """Call Claude CLI to classify a user query. Returns classification dict and token counts."""
    result = await claude_chat(CLASSIFY_SYSTEM_PROMPT, message, max_tokens=300, model="haiku")

    raw_text = result["text"].strip()
    # Parse JSON response
    try:
        classification = json.loads(raw_text)
    except json.JSONDecodeError:
        # Try to extract JSON from markdown code blocks
        if "```" in raw_text:
            json_str = raw_text.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
            classification = json.loads(json_str.strip())
        else:
            classification = {
                "intent": "general_query",
                "departments": [],
                "role_keys": [],
                "keywords": [],
            }

    return {
        "classification": classification,
        "input_tokens": result["input_tokens"],
        "output_tokens": result["output_tokens"],
        "cost_usd": result.get("cost_usd", 0),
    }
