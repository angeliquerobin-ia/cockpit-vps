# --- build ---
FROM oven/bun:1.2-alpine AS build
WORKDIR /app

# Install deps (cache-friendly)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Build
COPY . .
# Build-time public envs (VITE_*) must be provided at build, not at runtime.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
RUN bun run build

# --- runtime ---
FROM oven/bun:1.2-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# TanStack Start (Nitro) produces a self-contained server in .output/
COPY --from=build /app/.output ./.output

EXPOSE 3000
CMD ["bun", "run", ".output/server/index.mjs"]
