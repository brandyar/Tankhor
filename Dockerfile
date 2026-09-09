# ==========================================
# Stage 1: Single Build Stage (Debian Slim for rock-solid memory & glibc)
# ==========================================
FROM node:22-slim AS builder

WORKDIR /app

# Prevent memory exhaustion & speed up npm
ENV NODE_ENV=development
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Copy dependency manifests and npm network configs
COPY package.json package-lock.json .npmrc* ./

# Configure robust network parameters for environments with unstable/throttled connection
RUN npm config set fetch-retries 6 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    npm config set maxsockets 6

# Install dependencies with retry fallback
RUN npm ci --no-audit --no-fund || (sleep 3 && npm install --no-audit --no-fund)

# Copy all source files
COPY . .

# Build Vite frontend and bundled Node server to dist/
RUN npm run build

# Remove development packages to keep node_modules minimal for runtime
RUN npm prune --omit=dev --no-audit --no-fund

# ==========================================
# Stage 2: Production Runner (Ultra-lightweight & zero compile overhead)
# ==========================================
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy only production node_modules, package.json, and compiled dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
