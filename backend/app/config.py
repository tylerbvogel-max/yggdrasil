from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./yggdrasil.db"
    anthropic_api_key: str = ""
    haiku_model: str = "claude-haiku-4-5-20251001"
    token_budget: int = 4000
    propagation_decay: float = 0.6
    top_k_neurons: int = 30
    # Scoring weights (6 signals, sum = 1.0)
    weight_burst: float = 0.10
    weight_impact: float = 0.30
    weight_precision: float = 0.10
    weight_novelty: float = 0.10
    weight_recency: float = 0.20
    weight_relevance: float = 0.20
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

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
