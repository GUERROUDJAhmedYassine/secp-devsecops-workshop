import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/secp")
JWT_SECRET = os.getenv("JWT_SECRET", "dev_secret_change_in_production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = 7
SIEM_SERVICE_URL = os.getenv("SIEM_SERVICE_URL", "http://localhost:8005")
