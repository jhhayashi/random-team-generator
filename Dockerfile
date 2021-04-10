#################################
# base
#################################
FROM node:lts-alpine AS base
RUN npm i -g npm@7
ENV NEXT_TELEMETRY_DISABLED=1

#################################
# builder
#################################
FROM base AS builder

WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

#################################
# server
#################################
FROM base AS server

WORKDIR /app
RUN addgroup -g 1001 -S somegroup
RUN adduser -S someuser -u 1001

COPY package*.json ./

ENV NODE_ENV=production
RUN npm ci

COPY --from=builder /app/next.config.js /app/next.config.js
COPY --from=builder --chown=someuser:somegroup /app/.next /app/.next
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/server-dist /app/server-dist

USER someuser
EXPOSE 8080

CMD ["npm", "start"]
