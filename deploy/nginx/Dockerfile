# Build context must be repository root so both frontend/ and deploy/nginx/ are available
FROM node:22-alpine AS builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_SITE_URL=https://thedgym.com
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_API_BASE_URL=

ENV VITE_SITE_URL=$VITE_SITE_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache openssl \
    && rm -f /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html
COPY deploy/nginx/00-tuning.conf /etc/nginx/conf.d/00-tuning.conf
COPY deploy/nginx/snippets/ /etc/nginx/snippets/
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/nginx/15-tls-bootstrap.sh /docker-entrypoint.d/15-tls-bootstrap.sh

RUN chmod +x /docker-entrypoint.d/15-tls-bootstrap.sh

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["wget", "-qO-", "http://127.0.0.1/nginx-health"]
