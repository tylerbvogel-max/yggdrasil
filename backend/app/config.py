from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./yggdrasil.db"
    anthropic_api_key: str = ""
    haiku_model: str = "claude-haiku-4-5-20251001"
    token_budget: int = 4000
    propagation_decay: float = 0.6
    top_k_neurons: int = 30
    # Scoring weights
    weight_burst: float = 0.15
    weight_impact: float = 0.30
    weight_practice: float = 0.15
    weight_novelty: float = 0.15
    weight_recency: float = 0.25
    # Scoring parameters
    burst_window_tokens: int = 10000
    burst_threshold: int = 5
    novelty_halflife_tokens: int = 50000
    recency_decay_tokens: int = 100000
    impact_ema_alpha: float = 0.3

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
