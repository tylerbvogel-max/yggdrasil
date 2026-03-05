import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Neuron(Base):
    __tablename__ = "neurons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("neurons.id"), nullable=True, index=True)
    layer: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    node_type: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    role_key: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    invocations: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    avg_utility: Mapped[float] = mapped_column(Float, default=0.5, server_default="0.5")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    cross_ref_departments: Mapped[str | None] = mapped_column(Text, nullable=True)
    standard_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at_query_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    parent: Mapped["Neuron | None"] = relationship("Neuron", remote_side=[id], lazy="selectin")
    firings: Mapped[list["NeuronFiring"]] = relationship("NeuronFiring", back_populates="neuron", lazy="select")


class NeuronFiring(Base):
    __tablename__ = "neuron_firings"
    __table_args__ = (
        Index("ix_neuron_firings_neuron_offset", "neuron_id", "global_query_offset"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    neuron_id: Mapped[int] = mapped_column(Integer, ForeignKey("neurons.id"), nullable=False, index=True)
    query_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("queries.id"), nullable=True, index=True)
    context_type: Mapped[str] = mapped_column(String(50), default="direct")
    outcome: Mapped[str | None] = mapped_column(String(50), nullable=True)
    global_token_offset: Mapped[int] = mapped_column(Integer, default=0)
    global_query_offset: Mapped[int] = mapped_column(Integer, default=0, index=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    neuron: Mapped["Neuron"] = relationship("Neuron", back_populates="firings")


class NeuronEdge(Base):
    __tablename__ = "neuron_edges"

    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("neurons.id"), primary_key=True)
    target_id: Mapped[int] = mapped_column(Integer, ForeignKey("neurons.id"), primary_key=True)
    co_fire_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    weight: Mapped[float] = mapped_column(Float, default=0.0, server_default="0.0")


class Query(Base):
    __tablename__ = "queries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_message: Mapped[str] = mapped_column(Text, nullable=False)
    classified_intent: Mapped[str | None] = mapped_column(String(100), nullable=True)
    classified_departments: Mapped[str | None] = mapped_column(Text, nullable=True)
    classified_role_keys: Mapped[str | None] = mapped_column(Text, nullable=True)
    classified_keywords: Mapped[str | None] = mapped_column(Text, nullable=True)
    selected_neuron_ids: Mapped[str | None] = mapped_column(Text, nullable=True)
    assembled_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    opus_response_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    opus_input_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    opus_output_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    run_neuron: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    run_opus: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    results_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array of slot results
    eval_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    eval_model: Mapped[str | None] = mapped_column(String(50), nullable=True)
    eval_input_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    eval_output_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    user_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    classify_input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    classify_output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    execute_input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    execute_output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    refine_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    neuron_scores_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )


class SystemState(Base):
    __tablename__ = "system_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    global_token_counter: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_consolidation_at: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    total_queries: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class IntentNeuronMap(Base):
    __tablename__ = "intent_neuron_map"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    intent_label: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    neuron_id: Mapped[int] = mapped_column(Integer, ForeignKey("neurons.id"), nullable=False)
    hit_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    avg_score: Mapped[float] = mapped_column(Float, default=0.0, server_default="0.0")


class EvalScore(Base):
    __tablename__ = "eval_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    query_id: Mapped[int] = mapped_column(Integer, ForeignKey("queries.id"), nullable=False, index=True)
    eval_model: Mapped[str] = mapped_column(String(50), nullable=False)
    answer_mode: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. "haiku_neuron"
    answer_label: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. "A"
    accuracy: Mapped[int] = mapped_column(Integer, nullable=False)      # 1-5
    completeness: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    clarity: Mapped[int] = mapped_column(Integer, nullable=False)       # 1-5
    faithfulness: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5 (5 = no hallucinations)
    overall: Mapped[int] = mapped_column(Integer, nullable=False)       # 1-5
    verdict: Mapped[str | None] = mapped_column(Text, nullable=True)    # free-text verdict
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )


class NeuronRefinement(Base):
    __tablename__ = "neuron_refinements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    query_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("queries.id"), nullable=True, index=True)
    neuron_id: Mapped[int] = mapped_column(Integer, ForeignKey("neurons.id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(20), nullable=False)  # "update" | "create"
    field: Mapped[str | None] = mapped_column(String(50), nullable=True)  # for updates: content/summary/label/is_active
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )


class AutopilotConfig(Base):
    __tablename__ = "autopilot_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    directive: Mapped[str] = mapped_column(Text, default="", server_default="")
    interval_minutes: Mapped[int] = mapped_column(Integer, default=30, server_default="30")
    focus_neuron_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("neurons.id"), nullable=True)
    max_layer: Mapped[int] = mapped_column(Integer, default=5, server_default="5")
    eval_model: Mapped[str] = mapped_column(String(20), default="haiku", server_default="haiku")
    last_tick_at: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)


class AutopilotRun(Base):
    __tablename__ = "autopilot_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    query_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("queries.id"), nullable=True)
    generated_query: Mapped[str] = mapped_column(Text, nullable=False)
    directive: Mapped[str] = mapped_column(Text, nullable=False)
    focus_neuron_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    neurons_activated: Mapped[int] = mapped_column(Integer, default=0)
    updates_applied: Mapped[int] = mapped_column(Integer, default=0)
    neurons_created: Mapped[int] = mapped_column(Integer, default=0)
    eval_overall: Mapped[int] = mapped_column(Integer, default=3)
    eval_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    refine_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="completed")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )


class PropagationLog(Base):
    __tablename__ = "propagation_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    query_id: Mapped[int] = mapped_column(Integer, ForeignKey("queries.id"), nullable=False)
    source_neuron_id: Mapped[int] = mapped_column(Integer, ForeignKey("neurons.id"), nullable=False)
    target_neuron_id: Mapped[int] = mapped_column(Integer, ForeignKey("neurons.id"), nullable=False)
    activation_value: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
