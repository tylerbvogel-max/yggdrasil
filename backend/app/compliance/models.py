"""SQLAlchemy models for the Compliance Audit Suite."""

import datetime

from sqlalchemy import Float, Integer, String, Text, func, Boolean, ForeignKey, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class ComplianceSuiteRun(Base):
    __tablename__ = "compliance_suite_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    started_at: Mapped[datetime.datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    completed_at: Mapped[datetime.datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    framework_filter: Mapped[str | None] = mapped_column(String(50), nullable=True)
    provider_filter: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list of provider IDs, null = full run
    total_providers: Mapped[int] = mapped_column(Integer, default=0)
    passed: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    skipped: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    triggered_by: Mapped[str] = mapped_column(String(50), default="manual", server_default="manual")
    created_at: Mapped[datetime.datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())


class ComplianceProviderResult(Base):
    __tablename__ = "compliance_provider_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(Integer, ForeignKey("compliance_suite_runs.id"), nullable=False, index=True)
    provider_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    collected_at: Mapped[datetime.datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())


class ComplianceAttestation(Base):
    __tablename__ = "compliance_attestations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    attested_by: Mapped[str] = mapped_column(String(200), nullable=False)
    attested_at: Mapped[datetime.datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    re_attestation_due: Mapped[datetime.datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    superseded_at: Mapped[datetime.datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
