"""Konfigurasi aplikasi SUBAKO (Phase 1)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="SUBAKO_", extra="ignore"
    )

    app_name: str = "SUBAKO API"
    version: str = "0.1.0-phase1"
    env: str = "development"

    database_url: str = "sqlite:///./subako.db"
    jwt_secret: str = "dev-only-change-me"
    jwt_algorithm: str = "HS256"
    access_ttl_s: int = 1800
    refresh_ttl_s: int = 604800

    simulation_enabled: bool = True
    simulation_interval_s: int = 5
    seed_demo: bool = True

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.env.lower() in {"production", "prod"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
