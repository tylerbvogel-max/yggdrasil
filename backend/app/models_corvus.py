"""Corvus screen-watcher models — integrated into Yggdrasil's PostgreSQL database."""

import datetime
from sqlalchemy import (
    Integer, String, Text, Float, Boolean, DateTime, ForeignKey, Index, CheckConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.models import Base


class CorvusCapture(Base):
    __tablename__ = "corvus_captures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[str] = mapped_column(String(50), nullable=False)
    app_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    frame_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("ix_corvus_captures_timestamp", "timestamp"),
        Index("ix_corvus_captures_app_id", "app_id"),
    )


class CorvusInterpretation(Base):
    __tablename__ = "corvus_interpretations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[str] = mapped_column(String(50), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    capture_ids: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    session_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("corvus_sessions.id"), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("ix_corvus_interpretations_timestamp", "timestamp"),
    )


class CorvusKnownApp(Base):
    __tablename__ = "corvus_known_apps"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    detection_rules: Mapped[str | None] = mapped_column(Text, nullable=True)


class CorvusSession(Base):
    __tablename__ = "corvus_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    started_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    ended_at: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    brief: Mapped[str | None] = mapped_column(Text, nullable=True)
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)


class CorvusAlertRule(Base):
    __tablename__ = "corvus_alert_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pattern: Mapped[str] = mapped_column(Text, nullable=False)
    app_filter: Mapped[str | None] = mapped_column(String(100), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())


class CorvusEntity(Base):
    __tablename__ = "corvus_entities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    app_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    timestamp: Mapped[str] = mapped_column(String(50), nullable=False)
    capture_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("ix_corvus_entities_value", "value"),
        Index("ix_corvus_entities_timestamp", "timestamp"),
    )


class CorvusCustomApp(Base):
    __tablename__ = "corvus_custom_apps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    label: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    url_patterns: Mapped[str] = mapped_column(Text, default="[]", server_default="[]")
    text_patterns: Mapped[str] = mapped_column(Text, default="[]", server_default="[]")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())


class CorvusAttentionItem(Base):
    __tablename__ = "corvus_attention_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    list_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'watch' or 'ignore'
    value: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        CheckConstraint("list_type IN ('watch', 'ignore')", name="ck_attention_list_type"),
    )
