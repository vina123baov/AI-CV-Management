FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Allow environment variable PORT (Railway provides this)
ENV PORT=8000

EXPOSE 8000

CMD ["bash", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
