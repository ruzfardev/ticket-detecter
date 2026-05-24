"""
Application settings loaded from environment variables.

All env var names are prefixed-free (POSTGRES_*, BOT_TOKEN, etc.) to keep the
.env file readable. Settings are validated at import time.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- App
    mode: Literal["dev", "prod"] = "dev"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    version: str = "0.1.0"

    # ---- Postgres
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "ticketbot"
    postgres_user: str = "ticketbot"
    postgres_password: str = "dev"

    # ---- Telegram
    bot_token: str = Field(default="", description="Telegram bot token from BotFather")
    webhook_secret: str = Field(default="", description="X-Telegram-Bot-Api-Secret-Token")
    webhook_url: str = Field(default="", description="Public URL Telegram POSTs to")

    # ---- Internal auth (bot ↔ backend)
    internal_jwt_secret: str = Field(default="change-me-internal-jwt-secret")

    # ---- Encryption for railway credentials
    railway_cred_key: str = Field(
        default="",
        description="Fernet key (44 chars base64). Generate: "
                    "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"",
    )

    # ---- Railway.uz (initial seed only — credentials are stored in DB after first run)
    railway_username: str = ""
    railway_password: str = ""

    # ---- Worker
    watcher_tick_seconds: int = 10
    watcher_premium_interval_s: int = 10
    watcher_free_interval_s: int = 30
    watcher_dedup_minutes: int = 30
    watcher_rate_per_second: float = 2.0
    watcher_detail_jitter: float = 0.5
    watcher_list_cache_ttl: int = 5
    railway_cooldown_429: int = 300
    notif_log_retention_days: int = 30
    watch_groups_refresh_seconds: int = 60

    # ---- Admin alerts
    admin_chat_id: str = ""
    # Comma-separated TG user ids with admin rights, e.g. "970956519,123456".
    admin_ids: str = ""

    # ---- Misc
    sentry_dsn: str = ""

    @field_validator("railway_cred_key")
    @classmethod
    def _validate_fernet_key(cls, v: str) -> str:
        if not v:
            return v
        if len(v) != 44:
            raise ValueError(
                "railway_cred_key must be a 44-char base64 Fernet key. "
                "Generate with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
            )
        return v

    @property
    def admin_id_set(self) -> set[int]:
        """TG user ids with admin rights, parsed from ADMIN_IDS."""
        return {
            int(x) for x in self.admin_ids.replace(" ", "").split(",") if x.strip()
        }

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_asyncpg(self) -> str:
        # asyncpg.connect() doesn't accept the +asyncpg dialect prefix
        return self.database_url


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
