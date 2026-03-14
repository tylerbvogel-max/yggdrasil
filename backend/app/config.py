from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str  # Required — set via DATABASE_URL env var or .env file
    anthropic_api_key: str = ""
    haiku_model: str = "claude-haiku-4-5-20251001"
    token_budget: int = 4000
    propagation_decay: float = 0.6
    top_k_neurons: int = 30
    # Scoring weights (6 signals, sum = 1.0)
    # Relevance = stimulus specificity (primary driver)
    # Impact = long-term potentiation (proven utility)
    # Burst/Recency = modulatory signals (priming/attention)
    # Precision/Novelty = contextual modifiers
    weight_burst: float = 0.08
    weight_impact: float = 0.15
    weight_precision: float = 0.07
    weight_novelty: float = 0.05
    weight_recency: float = 0.15
    weight_relevance: float = 0.50
    # Relevance gating: modulatory signals attenuated without stimulus
    # relevance_gate_threshold: relevance level for full modulation (soft gate)
    # relevance_gate_floor: minimum gate factor (spontaneous background rate)
    relevance_gate_threshold: float = 0.3
    relevance_gate_floor: float = 0.05
    # Scoring parameters (query-count based)
    burst_window_queries: int = 50
    burst_threshold: int = 15
    novelty_halflife_queries: int = 200
    recency_decay_queries: int = 500
    impact_ema_alpha: float = 0.3
    # Diversity floor: minimum neurons per cross-referenced department
    diversity_floor_min: int = 2
    # Spreading activation via NeuronEdge graph
    spread_enabled: bool = True
    spread_max_neurons: int = 10
    spread_min_edge_weight: float = 0.15
    spread_decay: float = 0.5
    spread_min_activation: float = 0.15
    spread_max_hops: int = 3
    # Candidate selection limits
    candidate_limit: int = 500
    # Co-firing edge management
    min_cofire_score: float = 0.3
    edge_prune_min_cofires: int = 2
    edge_prune_stale_queries: int = 100
    # Semantic pre-filter (replaces org-chart filtering)
    semantic_prefilter_enabled: bool = True
    semantic_prefilter_top_n: int = 250
    semantic_prefilter_min_similarity: float = 0.10
    # Inhibitory regulation (replaces diversity floor)
    inhibition_enabled: bool = True
    inhibition_default_threshold: int = 15
    inhibition_default_max_survivors: int = 8
    inhibition_redundancy_cosine: float = 0.92
    inhibition_learning_alpha: float = 0.2
    # Typed edge spread thresholds
    spread_stellate_decay: float = 0.3
    spread_pyramidal_min_weight: float = 0.20
    # Concept neuron (instantiation edge) spread thresholds
    spread_instantiate_decay: float = 0.6
    spread_instantiate_min_weight: float = 0.10
    concept_activation_boost: float = 1.3
    # Per-project neuron subgraph caching
    project_cache_enabled: bool = True
    project_cache_boost_max: float = 1.3
    project_cache_min_queries: int = 3
    # Session and security headers (AC-12, SC-10, CMMC 3.1.11/3.13.9)
    session_timeout_minutes: int = 30
    # System use notification banner (AC-8, CMMC 3.1.9)
    system_use_banner: str = (
        "This is a U.S. Government-aligned information system. "
        "By accessing and using this system, you acknowledge that usage may be monitored, "
        "recorded, and subject to audit. Unauthorized use is prohibited and may result in "
        "disciplinary action and/or civil and criminal penalties. "
        "This system processes controlled and operationally sensitive information."
    )
    system_use_banner_enabled: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
