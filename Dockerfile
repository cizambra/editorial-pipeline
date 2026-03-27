# Editorial app Dockerfile (development)
FROM python:3.11-slim

WORKDIR /usr/src/app

# system deps
RUN apt-get update && apt-get install -y build-essential git curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# default env for dev
ENV APP_ENV=development
ENV APP_HOST=0.0.0.0
ENV APP_PORT=8000

# mount the source code at runtime for development
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"]
