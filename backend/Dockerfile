FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY pytest.ini .

ENV PYTHONPATH=/app
ENV API_HOST=0.0.0.0
ENV API_PORT=8088

EXPOSE 8088

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8088"]
