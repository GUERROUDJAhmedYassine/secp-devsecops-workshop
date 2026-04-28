import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/secp")
JWT_SECRET = os.getenv("JWT_SECRET", "dev_secret_change_in_production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = 7
SIEM_SERVICE_URL = os.getenv("SIEM_SERVICE_URL", "http://localhost:8005")

# WireGuard VPN Configuration
WG_SERVER_PUBLIC_KEY = os.getenv("WG_SERVER_PUBLIC_KEY")
WG_SERVER_ENDPOINT = os.getenv("WG_SERVER_ENDPOINT")
WG_INTERNAL_SUBNET = os.getenv("WG_INTERNAL_SUBNET", "10.8.0.0/24")
WG_CONFIG_PATH = os.getenv("WG_CONFIG_PATH", "/etc/wireguard/wg0/wg0.conf")
FILES_SERVICE_URL = os.getenv("FILES_SERVICE_URL", "http://files:8004")
