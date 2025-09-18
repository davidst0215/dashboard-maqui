# Use Node.js 18 LTS
FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install system dependencies for ffmpeg (if needed for audio processing)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Create non-root user
RUN useradd -r -u 1001 -g root appuser && \
    chown -R appuser:root /usr/src/app
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
CMD ["node", "server.js"]