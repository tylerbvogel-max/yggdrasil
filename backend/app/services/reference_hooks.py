"""Hooks for detecting and storing external references on neuron create/update."""

import json
from app.services.reference_detector import detect_neuron_references


def populate_external_references(neuron) -> None:
    """Detect external references in neuron content/summary and store as JSON.

    Call this after setting content/summary on a Neuron object, before commit.
    Mutates the neuron in place.
    """
    refs = detect_neuron_references(neuron.content, neuron.summary)
    neuron.external_references = json.dumps(refs) if refs else None


async def auto_link_neuron_sources(db, neuron) -> int:
    """Best-effort auto-link a single neuron to source_documents after reference detection.

    Call after populate_external_references and flush (neuron needs an id).
    Returns count of links created. Silently returns 0 on any error.
    """
    if not neuron.external_references or not neuron.id:
        return 0

    try:
        from sqlalchemy import select
        from app.models import SourceDocument, NeuronSourceLink

        refs = json.loads(neuron.external_references)
        if not refs:
            return 0

        # Load source documents (cached per-session)
        result = await db.execute(select(SourceDocument).where(SourceDocument.status == "active"))
        source_docs = result.scalars().all()
        if not source_docs:
            return 0

        # Build lookup maps
        by_canonical = {sd.canonical_id.upper(): sd for sd in source_docs}
        by_family = {}
        for sd in source_docs:
            if sd.family not in by_family:
                by_family[sd.family] = sd

        created = 0
        for ref in refs:
            pattern = ref.get("pattern", "")
            family = ref.get("family", "")

            # Try exact canonical match first, then family fallback
            matched_doc = by_canonical.get(pattern.upper()) or by_family.get(family)
            if not matched_doc:
                continue

            # Check for existing link
            existing = await db.execute(
                select(NeuronSourceLink).where(
                    NeuronSourceLink.neuron_id == neuron.id,
                    NeuronSourceLink.source_document_id == matched_doc.id,
                    NeuronSourceLink.section_ref == pattern,
                )
            )
            if existing.scalar_one_or_none():
                continue

            link = NeuronSourceLink(
                neuron_id=neuron.id,
                source_document_id=matched_doc.id,
                derivation_type="references",
                section_ref=pattern,
                link_origin="auto_detected",
            )
            db.add(link)
            created += 1

        return created
    except Exception:
        return 0
