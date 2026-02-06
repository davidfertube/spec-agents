# SpecVault - Hugging Face Spaces Deployment
# This Dockerfile builds both frontend and backend for HF Spaces

FROM node:20-slim AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the Next.js app
ENV NEXT_PUBLIC_API_URL=http://localhost:8000
RUN npm run build

# Python backend stage
FROM python:3.11-slim

WORKDIR /app

# Install Node.js for serving the frontend
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy frontend build from previous stage
COPY --from=frontend-builder /app/.next ./.next
COPY --from=frontend-builder /app/public ./public
COPY --from=frontend-builder /app/package*.json ./
COPY --from=frontend-builder /app/node_modules ./node_modules

# Create startup script
RUN echo '#!/bin/bash\n\
# Start backend in background\n\
cd /app && python -m uvicorn backend.server:app --host 0.0.0.0 --port 8000 &\n\
\n\
# Wait for backend to start\n\
sleep 3\n\
\n\
# Start frontend\n\
cd /app && npm start\n\
' > /app/start.sh && chmod +x /app/start.sh

# Expose ports
EXPOSE 3000 8000

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=http://localhost:8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Start both services
CMD ["/app/start.sh"]
