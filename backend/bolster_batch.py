#!/usr/bin/env python3
"""Batch bolster script - sends a bolster message and immediately applies all results."""
import sys
import json
import requests

API = "http://localhost:8002"

def bolster_and_apply(message: str, department: str, model: str = "sonnet"):
    """Send a bolster message and apply all results immediately."""
    # Send bolster
    resp = requests.post(f"{API}/admin/bolster", json={
        "message": message,
        "model": model,
        "department": department,
    }, timeout=300)
    resp.raise_for_status()
    data = resp.json()

    session_id = data["session_id"]
    updates = data.get("updates", [])
    new_neurons = data.get("new_neurons", [])

    print(f"  Bolster returned: {len(updates)} updates, {len(new_neurons)} new neurons")

    if not updates and not new_neurons:
        print("  Nothing to apply.")
        return 0

    # Apply all
    apply_resp = requests.post(f"{API}/admin/bolster/apply", json={
        "session_id": session_id,
        "update_ids": list(range(len(updates))),
        "new_neuron_ids": list(range(len(new_neurons))),
    }, timeout=60)
    apply_resp.raise_for_status()
    result = apply_resp.json()

    created = result.get("neurons_created", 0)
    updated = result.get("neurons_updated", 0)
    print(f"  Applied: {created} created, {updated} updated")
    return created + updated


def run_bolsters(bolsters: list[dict]):
    """Run a list of bolster dicts with 'message' and 'department' keys."""
    total = 0
    for i, b in enumerate(bolsters):
        print(f"\n[{i+1}/{len(bolsters)}] {b.get('label', 'Bolster')} ({b['department']})")
        try:
            n = bolster_and_apply(b["message"], b["department"], b.get("model", "sonnet"))
            total += n
        except Exception as e:
            print(f"  ERROR: {e}")
    print(f"\nTotal neurons added/updated: {total}")
    return total


if __name__ == "__main__":
    # Read bolster list from stdin as JSON
    bolsters = json.load(sys.stdin)
    run_bolsters(bolsters)
