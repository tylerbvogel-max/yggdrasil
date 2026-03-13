"""Provenance service — tracks source documents, neuron-source links,
staleness detection, authority recomputation, and auto-linking.
"""

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Neuron, NeuronSourceLink, SourceDocument

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Authority hierarchy (higher index = higher authority)
# ---------------------------------------------------------------------------

AUTHORITY_HIERARCHY: list[str] = [
    "informational",
    "organizational",
    "industry_practice",
    "regulatory",
    "binding_standard",
]

AUTHORITY_RANK: dict[str, int] = {level: i for i, level in enumerate(AUTHORITY_HIERARCHY)}


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

SEED_SOURCES: list[dict] = [
    # FAR family
    {"canonical_id": "FAR", "family": "FAR", "authority_level": "regulatory", "issuing_body": "GSA/DoD/NASA", "notes": "Federal Acquisition Regulation"},
    {"canonical_id": "FAR 31", "family": "FAR", "authority_level": "regulatory", "issuing_body": "GSA/DoD/NASA", "notes": "Contract Cost Principles and Procedures"},
    {"canonical_id": "FAR 31.205", "family": "FAR", "authority_level": "regulatory", "issuing_body": "GSA/DoD/NASA", "notes": "Selected Costs"},
    {"canonical_id": "FAR 52", "family": "FAR", "authority_level": "regulatory", "issuing_body": "GSA/DoD/NASA", "notes": "Solicitation Provisions and Contract Clauses"},
    # DFARS
    {"canonical_id": "DFARS", "family": "DFARS", "authority_level": "regulatory", "issuing_body": "DoD", "notes": "Defense Federal Acquisition Regulation Supplement"},
    {"canonical_id": "DFARS 252", "family": "DFARS", "authority_level": "regulatory", "issuing_body": "DoD", "notes": "DFARS Contract Clauses"},
    # AS standards
    {"canonical_id": "AS9100D", "family": "AS", "authority_level": "industry_practice", "issuing_body": "SAE International", "notes": "Quality Management Systems - Requirements for Aviation, Space, and Defense"},
    {"canonical_id": "AS9102", "family": "AS", "authority_level": "industry_practice", "issuing_body": "SAE International", "notes": "First Article Inspection"},
    {"canonical_id": "AS9110", "family": "AS", "authority_level": "industry_practice", "issuing_body": "SAE International", "notes": "Quality Management Systems for Aviation Maintenance"},
    {"canonical_id": "AS6081", "family": "AS", "authority_level": "industry_practice", "issuing_body": "SAE International", "notes": "Counterfeit Parts Prevention"},
    # MIL-STD
    {"canonical_id": "MIL-STD-882E", "family": "MIL-STD", "authority_level": "binding_standard", "issuing_body": "DoD", "notes": "System Safety"},
    {"canonical_id": "MIL-STD-1472", "family": "MIL-STD", "authority_level": "binding_standard", "issuing_body": "DoD", "notes": "Human Engineering"},
    {"canonical_id": "MIL-STD-810G", "family": "MIL-STD", "authority_level": "binding_standard", "issuing_body": "DoD", "notes": "Environmental Engineering Considerations and Laboratory Tests"},
    {"canonical_id": "MIL-STD-461G", "family": "MIL-STD", "authority_level": "binding_standard", "issuing_body": "DoD", "notes": "EMI/EMC Requirements"},
    # DO standards
    {"canonical_id": "DO-178C", "family": "DO", "authority_level": "industry_practice", "issuing_body": "RTCA", "notes": "Software Considerations in Airborne Systems and Equipment Certification"},
    {"canonical_id": "DO-254", "family": "DO", "authority_level": "industry_practice", "issuing_body": "RTCA", "notes": "Design Assurance Guidance for Airborne Electronic Hardware"},
    {"canonical_id": "DO-160G", "family": "DO", "authority_level": "industry_practice", "issuing_body": "RTCA", "notes": "Environmental Conditions and Test Procedures for Airborne Equipment"},
    # ISO
    {"canonical_id": "ISO 9001", "family": "ISO", "authority_level": "industry_practice", "issuing_body": "ISO", "notes": "Quality Management Systems"},
    {"canonical_id": "ISO 14001", "family": "ISO", "authority_level": "industry_practice", "issuing_body": "ISO", "notes": "Environmental Management Systems"},
    {"canonical_id": "ISO 27001", "family": "ISO", "authority_level": "industry_practice", "issuing_body": "ISO", "notes": "Information Security Management"},
    # NIST
    {"canonical_id": "NIST SP 800-171", "family": "NIST", "authority_level": "regulatory", "issuing_body": "NIST", "notes": "Protecting CUI in Nonfederal Systems"},
    {"canonical_id": "NIST SP 800-53", "family": "NIST", "authority_level": "regulatory", "issuing_body": "NIST", "notes": "Security and Privacy Controls"},
    # ITAR/EAR
    {"canonical_id": "ITAR", "family": "ITAR", "authority_level": "regulatory", "issuing_body": "State Department/DDTC", "notes": "International Traffic in Arms Regulations"},
    {"canonical_id": "EAR", "family": "EAR", "authority_level": "regulatory", "issuing_body": "Commerce Department/BIS", "notes": "Export Administration Regulations"},
    # CMMC
    {"canonical_id": "CMMC", "family": "CMMC", "authority_level": "regulatory", "issuing_body": "DoD", "notes": "Cybersecurity Maturity Model Certification"},
    # SAE
    {"canonical_id": "SAE AMS", "family": "SAE", "authority_level": "industry_practice", "issuing_body": "SAE International", "notes": "Aerospace Material Specifications"},
    # NADCAP
    {"canonical_id": "NADCAP", "family": "NADCAP", "authority_level": "industry_practice", "issuing_body": "PRI", "notes": "National Aerospace and Defense Contractors Accreditation Program"},
    # OSHA
    {"canonical_id": "OSHA", "family": "OSHA", "authority_level": "regulatory", "issuing_body": "Department of Labor", "notes": "Occupational Safety and Health Standards"},
    # ASTM
    {"canonical_id": "ASTM", "family": "ASTM", "authority_level": "industry_practice", "issuing_body": "ASTM International", "notes": "Standard Test Methods and Specifications"},
    # CFR
    {"canonical_id": "CFR", "family": "CFR", "authority_level": "regulatory", "issuing_body": "Federal Government", "notes": "Code of Federal Regulations"},
]


# ═══════════════════════════════════════════════════════════════════════════
# CRUD — Source Documents
# ═══════════════════════════════════════════════════════════════════════════


async def create_source_document(
    db: AsyncSession,
    canonical_id: str,
    family: str,
    authority_level: str,
    *,
    version: str | None = None,
    status: str = "active",
    issuing_body: str | None = None,
    effective_date=None,
    url: str | None = None,
    notes: str | None = None,
    superseded_by_id: int | None = None,
) -> SourceDocument:
    doc = SourceDocument(
        canonical_id=canonical_id,
        family=family,
        authority_level=authority_level,
        version=version,
        status=status,
        issuing_body=issuing_body,
        effective_date=effective_date,
        url=url,
        notes=notes,
        superseded_by_id=superseded_by_id,
    )
    db.add(doc)
    await db.flush()
    return doc


async def get_source_document(db: AsyncSession, doc_id: int) -> SourceDocument | None:
    return await db.get(SourceDocument, doc_id)


async def get_source_document_by_canonical(db: AsyncSession, canonical_id: str) -> SourceDocument | None:
    result = await db.execute(
        select(SourceDocument).where(SourceDocument.canonical_id == canonical_id)
    )
    return result.scalar_one_or_none()


async def list_source_documents(
    db: AsyncSession,
    family: str | None = None,
    status: str | None = None,
    authority_level: str | None = None,
) -> list[SourceDocument]:
    stmt = select(SourceDocument)
    if family is not None:
        stmt = stmt.where(SourceDocument.family == family)
    if status is not None:
        stmt = stmt.where(SourceDocument.status == status)
    if authority_level is not None:
        stmt = stmt.where(SourceDocument.authority_level == authority_level)
    stmt = stmt.order_by(SourceDocument.family, SourceDocument.canonical_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_source_document(db: AsyncSession, doc_id: int, **kwargs) -> SourceDocument:
    doc = await db.get(SourceDocument, doc_id)
    if doc is None:
        raise ValueError(f"SourceDocument {doc_id} not found")
    for key, value in kwargs.items():
        if hasattr(doc, key):
            setattr(doc, key, value)
    await db.flush()
    return doc


# ═══════════════════════════════════════════════════════════════════════════
# Supersession cascade
# ═══════════════════════════════════════════════════════════════════════════


async def supersede_source_document(
    db: AsyncSession,
    old_id: int,
    new_canonical_id: str,
    new_version: str | None = None,
    **new_kwargs,
) -> tuple[SourceDocument, int]:
    """Supersede a source document: create (or find) the new version, mark
    the old one as superseded, and flag all linked neurons as stale.

    Returns (new_doc, flagged_count).
    """
    old_doc = await db.get(SourceDocument, old_id)
    if old_doc is None:
        raise ValueError(f"SourceDocument {old_id} not found")

    # Find or create the new document
    new_doc = await get_source_document_by_canonical(db, new_canonical_id)
    if new_doc is None:
        new_doc = await create_source_document(
            db,
            canonical_id=new_canonical_id,
            family=new_kwargs.pop("family", old_doc.family),
            authority_level=new_kwargs.pop("authority_level", old_doc.authority_level),
            version=new_version,
            issuing_body=new_kwargs.pop("issuing_body", old_doc.issuing_body),
            **new_kwargs,
        )

    # Mark old as superseded
    old_doc.status = "superseded"
    old_doc.superseded_by_id = new_doc.id

    # Flag all linked neurons as stale
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(NeuronSourceLink).where(
            NeuronSourceLink.source_document_id == old_id,
            NeuronSourceLink.review_status != "stale",
        )
    )
    links = list(result.scalars().all())
    for link in links:
        link.review_status = "stale"
        link.flagged_at = now

    await db.flush()
    return new_doc, len(links)


# ═══════════════════════════════════════════════════════════════════════════
# Neuron-source linking
# ═══════════════════════════════════════════════════════════════════════════


async def link_neuron_to_source(
    db: AsyncSession,
    neuron_id: int,
    source_document_id: int,
    derivation_type: str = "references",
    section_ref: str | None = None,
    link_origin: str = "manual",
) -> NeuronSourceLink:
    link = NeuronSourceLink(
        neuron_id=neuron_id,
        source_document_id=source_document_id,
        derivation_type=derivation_type,
        section_ref=section_ref,
        link_origin=link_origin,
    )
    db.add(link)
    await db.flush()
    return link


async def unlink_neuron_from_source(db: AsyncSession, link_id: int) -> bool:
    link = await db.get(NeuronSourceLink, link_id)
    if link is None:
        return False
    await db.delete(link)
    await db.flush()
    return True


async def get_neuron_sources(db: AsyncSession, neuron_id: int) -> list[dict]:
    """Return source documents linked to a neuron, with link metadata."""
    stmt = (
        select(SourceDocument, NeuronSourceLink)
        .join(NeuronSourceLink, NeuronSourceLink.source_document_id == SourceDocument.id)
        .where(NeuronSourceLink.neuron_id == neuron_id)
        .order_by(SourceDocument.family, SourceDocument.canonical_id)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "source_document": {
                "id": doc.id,
                "canonical_id": doc.canonical_id,
                "family": doc.family,
                "version": doc.version,
                "status": doc.status,
                "authority_level": doc.authority_level,
                "issuing_body": doc.issuing_body,
                "notes": doc.notes,
            },
            "link": {
                "id": link.id,
                "derivation_type": link.derivation_type,
                "section_ref": link.section_ref,
                "review_status": link.review_status,
                "flagged_at": link.flagged_at.isoformat() if link.flagged_at else None,
                "link_origin": link.link_origin,
                "created_at": link.created_at.isoformat() if link.created_at else None,
            },
        }
        for doc, link in rows
    ]


async def get_source_neurons(db: AsyncSession, source_document_id: int) -> list[dict]:
    """Return neurons linked to a source document, with link metadata."""
    stmt = (
        select(Neuron, NeuronSourceLink)
        .join(NeuronSourceLink, NeuronSourceLink.neuron_id == Neuron.id)
        .where(NeuronSourceLink.source_document_id == source_document_id)
        .order_by(Neuron.layer, Neuron.label)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "neuron": {
                "id": neuron.id,
                "label": neuron.label,
                "layer": neuron.layer,
                "department": neuron.department,
                "role_key": neuron.role_key,
                "authority_level": neuron.authority_level,
            },
            "link": {
                "id": link.id,
                "derivation_type": link.derivation_type,
                "section_ref": link.section_ref,
                "review_status": link.review_status,
                "flagged_at": link.flagged_at.isoformat() if link.flagged_at else None,
                "link_origin": link.link_origin,
                "created_at": link.created_at.isoformat() if link.created_at else None,
            },
        }
        for neuron, link in rows
    ]


# ═══════════════════════════════════════════════════════════════════════════
# Auto-linking from external_references JSON
# ═══════════════════════════════════════════════════════════════════════════


async def auto_link_from_references(db: AsyncSession) -> dict:
    """Bulk scan neurons' external_references JSON, match to source_documents,
    and create NeuronSourceLinks where they don't already exist.

    Match strategy:
    1. Exact canonical_id match on the reference pattern text
    2. Fallback: family-level match (link to the family root source doc)

    Returns {"scanned": N, "linked": N, "links_created": N}.
    """
    # Load all source documents keyed by canonical_id and by family
    all_docs_result = await db.execute(select(SourceDocument).where(SourceDocument.status == "active"))
    all_docs = list(all_docs_result.scalars().all())

    docs_by_canonical: dict[str, SourceDocument] = {doc.canonical_id: doc for doc in all_docs}
    docs_by_family: dict[str, SourceDocument] = {}
    for doc in all_docs:
        # Prefer the shortest canonical_id per family as the family-level root
        if doc.family not in docs_by_family or len(doc.canonical_id) < len(docs_by_family[doc.family].canonical_id):
            docs_by_family[doc.family] = doc

    # Load existing links for dedup: set of (neuron_id, source_document_id, section_ref)
    existing_result = await db.execute(select(NeuronSourceLink))
    existing_links: set[tuple[int, int, str | None]] = {
        (link.neuron_id, link.source_document_id, link.section_ref)
        for link in existing_result.scalars().all()
    }

    # Query neurons with external_references
    neurons_result = await db.execute(
        select(Neuron).where(Neuron.external_references.isnot(None))
    )
    neurons = list(neurons_result.scalars().all())

    scanned = 0
    neurons_linked = set()
    links_created = 0

    for neuron in neurons:
        try:
            refs = json.loads(neuron.external_references)
        except (json.JSONDecodeError, TypeError):
            continue

        if not isinstance(refs, list):
            continue

        scanned += 1

        for ref in refs:
            if not isinstance(ref, dict):
                continue

            pattern = ref.get("pattern", "")
            family = ref.get("family", "")

            # Strategy 1: exact canonical_id match on the pattern text
            matched_doc = docs_by_canonical.get(pattern)

            # Strategy 2: family-level fallback
            if matched_doc is None and family:
                matched_doc = docs_by_family.get(family)

            if matched_doc is None:
                continue

            section_ref = pattern
            dedup_key = (neuron.id, matched_doc.id, section_ref)
            if dedup_key in existing_links:
                continue

            link = NeuronSourceLink(
                neuron_id=neuron.id,
                source_document_id=matched_doc.id,
                derivation_type="references",
                section_ref=section_ref,
                link_origin="auto_detected",
            )
            db.add(link)
            existing_links.add(dedup_key)
            neurons_linked.add(neuron.id)
            links_created += 1

    await db.flush()
    return {"scanned": scanned, "linked": len(neurons_linked), "links_created": links_created}


# ═══════════════════════════════════════════════════════════════════════════
# Staleness detection
# ═══════════════════════════════════════════════════════════════════════════


async def detect_stale_neurons(db: AsyncSession) -> list[dict]:
    """Return neurons where at least one linked source has review_status='stale'."""
    stmt = (
        select(Neuron, NeuronSourceLink, SourceDocument)
        .join(NeuronSourceLink, NeuronSourceLink.neuron_id == Neuron.id)
        .join(SourceDocument, SourceDocument.id == NeuronSourceLink.source_document_id)
        .where(NeuronSourceLink.review_status == "stale")
        .order_by(Neuron.id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    # Group by neuron
    neurons_map: dict[int, dict] = {}
    for neuron, link, doc in rows:
        if neuron.id not in neurons_map:
            neurons_map[neuron.id] = {
                "neuron_id": neuron.id,
                "label": neuron.label,
                "layer": neuron.layer,
                "department": neuron.department,
                "stale_sources": [],
            }
        neurons_map[neuron.id]["stale_sources"].append({
            "link_id": link.id,
            "source_canonical_id": doc.canonical_id,
            "source_family": doc.family,
            "source_status": doc.status,
            "flagged_at": link.flagged_at.isoformat() if link.flagged_at else None,
        })

    return list(neurons_map.values())


# ═══════════════════════════════════════════════════════════════════════════
# Authority recomputation
# ═══════════════════════════════════════════════════════════════════════════


async def recompute_neuron_authority(db: AsyncSession, neuron_id: int) -> str | None:
    """Recompute a neuron's authority_level from its linked source documents.

    Sets it to the highest authority_level among linked active sources.
    Returns the new authority_level (or None if no links).
    """
    neuron = await db.get(Neuron, neuron_id)
    if neuron is None:
        return None

    stmt = (
        select(SourceDocument.authority_level)
        .join(NeuronSourceLink, NeuronSourceLink.source_document_id == SourceDocument.id)
        .where(
            NeuronSourceLink.neuron_id == neuron_id,
            SourceDocument.status == "active",
        )
    )
    result = await db.execute(stmt)
    levels = [row[0] for row in result.all()]

    if not levels:
        neuron.authority_level = None
        await db.flush()
        return None

    best = max(levels, key=lambda lvl: AUTHORITY_RANK.get(lvl, -1))
    neuron.authority_level = best
    await db.flush()
    return best


async def bulk_recompute_authority(db: AsyncSession) -> dict:
    """Recompute authority_level for all neurons that have at least one source link.

    Returns {"updated": N}.
    """
    # Get distinct neuron_ids with links
    stmt = select(NeuronSourceLink.neuron_id).distinct()
    result = await db.execute(stmt)
    neuron_ids = [row[0] for row in result.all()]

    updated = 0
    for neuron_id in neuron_ids:
        neuron = await db.get(Neuron, neuron_id)
        if neuron is None:
            continue

        # Find highest authority from active linked sources
        auth_stmt = (
            select(SourceDocument.authority_level)
            .join(NeuronSourceLink, NeuronSourceLink.source_document_id == SourceDocument.id)
            .where(
                NeuronSourceLink.neuron_id == neuron_id,
                SourceDocument.status == "active",
            )
        )
        auth_result = await db.execute(auth_stmt)
        levels = [row[0] for row in auth_result.all()]

        old_level = neuron.authority_level
        if levels:
            new_level = max(levels, key=lambda lvl: AUTHORITY_RANK.get(lvl, -1))
        else:
            new_level = None

        if old_level != new_level:
            neuron.authority_level = new_level
            updated += 1

    await db.flush()
    return {"updated": updated}


# ═══════════════════════════════════════════════════════════════════════════
# Bootstrap seed data
# ═══════════════════════════════════════════════════════════════════════════


async def seed_source_documents(db: AsyncSession) -> dict:
    """Insert seed source documents, skipping any that already exist by canonical_id.

    Returns {"created": N, "skipped": N}.
    """
    created = 0
    skipped = 0

    for seed in SEED_SOURCES:
        existing = await get_source_document_by_canonical(db, seed["canonical_id"])
        if existing is not None:
            skipped += 1
            continue

        doc = SourceDocument(
            canonical_id=seed["canonical_id"],
            family=seed["family"],
            authority_level=seed["authority_level"],
            issuing_body=seed.get("issuing_body"),
            notes=seed.get("notes"),
        )
        db.add(doc)
        created += 1

    await db.flush()
    logger.info("Seeded source documents: created=%d, skipped=%d", created, skipped)
    return {"created": created, "skipped": skipped}
