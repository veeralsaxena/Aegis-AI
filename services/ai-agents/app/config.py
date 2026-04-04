from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str
    google_api_key: str

    class Config:
        env_file = ".env"

settings = Settings()
