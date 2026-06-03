FROM node:24-slim

# openssl needed by Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies inside the container so the correct Linux Prisma binary
# is downloaded, regardless of the host OS or whether node_modules exists locally.
COPY package*.json ./
RUN npm install --omit=dev

# Copy prisma schema and generate the Linux engine binary
COPY prisma ./prisma
RUN node_modules/.bin/prisma generate

# Copy application source (node_modules excluded via .dockerignore)
COPY . .

RUN mkdir -p uploads archives

EXPOSE 5001

CMD ["node", "server.js"]
