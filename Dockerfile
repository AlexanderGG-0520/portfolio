# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS frontend-build
WORKDIR /src/frontend

COPY frontend/package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

FROM golang:1.24-bookworm@sha256:1a6d4452c65dea36aac2e2d606b01b4a029ec90cc1ae53890540ce6173ea77ac AS backend-build
WORKDIR /src/backend

COPY backend/go.mod ./
RUN go mod download

COPY backend/ ./

ARG VERSION=dev
ARG REVISION=dev
ARG BUILD_TIME=unknown

RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build \
      -trimpath \
      -ldflags="-s -w -X main.buildVersion=${VERSION} -X main.buildRevision=${REVISION} -X main.buildTime=${BUILD_TIME}" \
      -o /out/portfolio \
      ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab AS runtime
WORKDIR /app

ARG VERSION=dev
ARG REVISION=dev
ARG BUILD_TIME=unknown

LABEL org.opencontainers.image.title="Alec Portfolio" \
      org.opencontainers.image.description="Backend / Infrastructure / Systems Engineering portfolio" \
      org.opencontainers.image.source="https://github.com/AlexanderGG-0520/portfolio" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${BUILD_TIME}"

COPY --from=backend-build /out/portfolio /app/portfolio
COPY --from=frontend-build /src/frontend/dist /app/frontend

ENV PORTFOLIO_ADDR="0.0.0.0:8080" \
    PORTFOLIO_FRONTEND_DIR="/app/frontend"

EXPOSE 8080

ENTRYPOINT ["/app/portfolio"]
