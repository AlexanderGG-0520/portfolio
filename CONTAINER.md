# Container image

The production image contains the built Astro frontend and the Go backend in one runtime artifact.

## Local build

```bash
docker build -t portfolio:local .
docker run --rm -p 8080:8080 portfolio:local
```

Open `http://127.0.0.1:8080/` and select English or Japanese.

## Runtime metadata

The image bakes release metadata into the Go binary at build time through `VERSION`, `REVISION`, and `BUILD_TIME` build arguments. The public runtime endpoint exposes that identity at `/api/runtime`.

Deployment context remains runtime-configurable through the explicitly public `PORTFOLIO_*` variables, for example:

```bash
docker run --rm -p 8080:8080 \
  -e PORTFOLIO_ENVIRONMENT=production \
  -e PORTFOLIO_ORCHESTRATOR=docker \
  -e PORTFOLIO_INSTANCE=portfolio-01 \
  portfolio:local
```

The server listens on `0.0.0.0:8080` inside the image and serves the prebuilt Astro files from `/app/frontend`.

## Published image

GitHub Actions publishes `linux/amd64` images to:

```text
ghcr.io/alexandergg-0520/portfolio
```

`main` publishes `latest`, `main`, and `sha-*` tags. Tags matching `v*` additionally publish the Git tag and semantic-version aliases.
