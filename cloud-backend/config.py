from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    secret_key: str
    admin_secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    white_ip: str = "0.0.0.0"
    http_port: str = "0"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()