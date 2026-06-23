FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Copy full node_modules so external packages (bullmq, ioredis, better-sqlite3) are available
COPY --from=builder /app/node_modules ./node_modules
RUN mkdir -p /app/data /app/exports
USER node
EXPOSE 3009
CMD ["node", "server.js"]
