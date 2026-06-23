FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY tsconfig.json .
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package.json .
RUN npm install --omit=dev && npm cache clean --force
RUN mkdir -p /app/exports /app/.logs
USER node
CMD ["node", "dist/index.js"]
