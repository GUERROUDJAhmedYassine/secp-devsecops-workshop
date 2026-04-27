FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir --timeout 300 --retries 10 -r requirements.txt

COPY app ./app

# Parent of the `app` package so `uvicorn app.main:app` resolves to /app/app/main.py
ENV PYTHONPATH=/app

EXPOSE 8004

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004"]