FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN apt-get update \
    && apt-get install -y --no-install-recommends wireguard-tools util-linux \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --timeout 300 --retries 10 -r requirements.txt

COPY app ./app

# Include both project root and app package root:
# - /app for `uvicorn app.main:app`
# - /app/app for legacy absolute imports like `from routers import ...`
ENV PYTHONPATH=/app:/app/app
CMD python app/create_superuser.py && uvicorn app.main:app --host 0.0.0.0 --port 8001