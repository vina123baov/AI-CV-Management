FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (dynamic from Railway)
ENV PORT=8000
EXPOSE $PORT

# ✅ ĐÚNG - Đọc port từ biến môi trường
CMD uvicorn main:app --host 0.0.0.0 --port $PORT