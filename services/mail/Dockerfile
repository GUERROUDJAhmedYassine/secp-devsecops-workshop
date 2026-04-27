FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir --timeout 300 --retries 10 -r requirements.txt

COPY app ./app

ENV PYTHONPATH=/app/app

RUN mkdir -p /app/uploads/email_attachments

EXPOSE 8002

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
