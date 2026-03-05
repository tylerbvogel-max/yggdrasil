"""Stage 1: Intent classification via Claude CLI."""

import json
import logging

from app.services.claude_cli import claude_chat

logger = logging.getLogger(__name__)

CLASSIFY_SYSTEM_PROMPT = """You are a query classifier for an aerospace defense contractor organization.
Given a user query, classify it into:
1. intent: A short label describing the intent (e.g., "compliance_risk_review", "engineering_analysis", "data_pipeline_design", "cost_reporting", "procurement_request", "proposal_development")
2. departments: List of relevant departments from: ["Executive Leadership", "Engineering", "Contracts & Compliance", "Manufacturing & Operations", "Business Development", "Administrative & Support", "Finance", "Program Management", "Regulatory"]
3. role_keys: List of relevant role keys from: ["ceo", "coo", "cto", "cfo", "vp_engineering", "vp_operations", "vp_bd", "mech_eng", "elec_eng", "sw_eng", "sys_eng", "mfg_eng", "test_eng", "data_engineer", "contract_analyst", "export_control", "far_specialist", "quality_auditor", "safety_officer", "prod_mgr", "quality_mgr", "supply_chain_mgr", "facilities_mgr", "bd_director", "proposal_mgr", "capture_mgr", "hr_generalist", "it_support", "procurement", "payroll", "financial_analyst", "cost_accountant", "program_mgr", "as9100d", "far_dfars", "itar_ear", "nadcap", "mil_std", "iso_standards", "osha", "nist_cmmc", "do_standards", "astm", "asme_y14", "nas410", "sae_as6500"]
4. keywords: List of 3-8 relevant technical keywords

IMPORTANT: The role_key determines the department. Match departments to the roles you select:
- data_engineer, sw_eng, sys_eng, mech_eng, elec_eng, mfg_eng, test_eng → "Engineering"
- cost_accountant, financial_analyst, payroll → "Finance"
- contract_analyst, export_control, far_specialist → "Contracts & Compliance"
- program_mgr → "Program Management"
- as9100d, far_dfars, itar_ear, nadcap, mil_std, iso_standards, osha, nist_cmmc, do_standards, astm, asme_y14, nas410, sae_as6500 → "Regulatory"
Topics like Databricks, Spark, Delta Lake, ETL, data pipelines, dimensional modeling, SQL → data_engineer + "Engineering".
When query mentions specific standards, regulations, or compliance frameworks (AS9100, FAR, DFARS, ITAR, NADCAP, MIL-STD, NIST, CMMC, DO-178C, ASTM, ASME Y14.5, NAS 410, OSHA, ISO 9001/14001/45001), include "Regulatory" in departments and the matching regulatory role_key.

Respond ONLY with valid JSON, no markdown formatting:
{"intent": "...", "departments": [...], "role_keys": [...], "keywords": [...]}"""


async def classify_query(message: str) -> dict:
    """Call Claude CLI to classify a user query. Returns classification dict and token counts."""
    result = await claude_chat(CLASSIFY_SYSTEM_PROMPT, message, max_tokens=300, model="haiku")

    raw_text = result["text"].strip()
    logger.info(f"Classifier raw response ({len(raw_text)} chars): {raw_text[:300]}")
    # Parse JSON response
    try:
        classification = json.loads(raw_text)
    except (json.JSONDecodeError, ValueError):
        # Try to extract JSON from markdown code blocks
        try:
            if "```" in raw_text:
                json_str = raw_text.split("```")[1]
                if json_str.startswith("json"):
                    json_str = json_str[4:]
                classification = json.loads(json_str.strip())
            else:
                raise ValueError("No JSON found")
        except (json.JSONDecodeError, ValueError, IndexError):
            logger.warning(f"Classifier fallback: could not parse response: {raw_text[:200]}")
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
