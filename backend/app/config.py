from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./orchestrator.db"
    HEALTH_CHECK_INTERVAL: int = 5
    MAX_RESTART_ATTEMPTS: int = 5
    RESTART_BACKOFF_BASE: int = 5
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8088
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
