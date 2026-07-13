# ----------------------------------------------------
# 1. Build Phase
# ----------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ----------------------------------------------------
# 2. Production Runtime Phase
# ----------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Expose server port
EXPOSE 3000

# Start compiled server
CMD ["node", "dist/server.cjs"]
