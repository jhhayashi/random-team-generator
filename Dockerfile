FROM node:lts-alpine AS base
RUN npm i -g npm@7
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS builder

WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM base AS server

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY server /app/server
COPY types.ts ./
COPY tsconfig.json ./

COPY --from=builder /app/next.config.js /app/next.config.js
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/dist /app/dist

RUN addgroup -g 1001 -S somegroup
RUN adduser -S someuser -u 1001
RUN chown -R someuser:somegroup /app/.next
USER someuser

EXPOSE 3000
ENV NODE_ENV=production

CMD ["npm", "start"]
