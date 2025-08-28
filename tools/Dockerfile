# Use slim Node 20 image
FROM node:20-slim

# Install OS deps + Chromium
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 \
    libfontconfig1 libgbm1 libglib2.0-0 libgcc1 libgdk-pixbuf2.0-0 \
    libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libx11-6 libx11-xcb1 \
    libxau6 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
    libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    xdg-utils wget curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency files first (better layer caching)
COPY package*.json ./

# Install deps (force fresh install to avoid cache issues)
RUN rm -rf node_modules package-lock.json \
    && npm install --omit=dev --legacy-peer-deps

# Puppeteer + Lighthouse should use system Chromium
ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy app source
COPY src ./src

# Expose port
EXPOSE 4000

# Start app
CMD ["npm", "start"]