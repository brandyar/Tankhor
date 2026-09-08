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

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install dependencies (Single run, fast and memory-safe)
RUN npm ci --no-audit --no-fund

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
