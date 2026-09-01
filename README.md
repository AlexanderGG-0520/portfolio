# Portfolio

**Backend / Infrastructure / Systems Engineering**

> From code to running system.

This repository contains my personal engineering portfolio and the production system that serves it. The site is intentionally more than a static profile: it presents selected systems work while exposing the architecture, deployment model, and live runtime information behind the portfolio itself.

- **Live site:** https://portfolio.alec-ofc.com/
- **English:** https://portfolio.alec-ofc.com/en/
- **日本語:** https://portfolio.alec-ofc.com/ja/

## What this repository demonstrates

The central idea of the portfolio is simple:

> I build software as complete systems, through the infrastructure that runs them.

That principle is reflected in the repository itself:

- an Astro frontend for the presentation layer;
- a small Go backend that serves both the generated frontend and runtime APIs;
- one production container artifact;
- Kubernetes manifests built with Kustomize;
- GitOps reconciliation through Argo CD;
- immutable OCI image promotion through GitHub Actions;
- Cloudflare Tunnel as the public routing boundary;
- explicit ownership for topology, deployment desired state, and runtime truth.

The website also contains case studies for systems such as **Minecartainer** and **mc-router**, with an emphasis on design constraints, failure modes, state ownership, and operation rather than screenshots alone.

## Architecture

### Request path

```text
Internet
  ↓
Cloudflare
  ↓
Cloudflare Tunnel / cloudflared
  ↓
ClusterIP Service / portfolio
  ↓
Go process :8080
  ├─ prebuilt Astro frontend
  └─ /api/*
```

The application does not require a Kubernetes `Ingress`, `NodePort`, or public `LoadBalancer`. Kubernetes exposes the portfolio only through an internal `ClusterIP` Service; public hostname and tunnel routing remain owned by Cloudflare.

### Deployment path

```text
main source commit
  ↓
GitHub Actions
  ↓
build + push OCI image to GHCR
  ↓
resolve immutable sha256 digest
  ↓
promote digest into Git desired state
  ↓
Argo CD
  ↓
Kubernetes Deployment
```

GitHub Actions does not mutate the cluster directly. It builds the artifact and updates Git. Argo CD is the component responsible for reconciling that desired state into Kubernetes.

## Sources of truth

The same system appears in the website, terminal, manifests, workflows, and live runtime views. Those surfaces are deliberately not independent authorities.

| Concern | Authority |
| --- | --- |
| Stable system topology | `frontend/src/data/system-model.ts` and architecture views |
| Deployment desired state | `.github/workflows/**`, `k8s/base/**`, `k8s/overlays/production/**` |
| Runtime process identity | `GET /api/runtime` from the Go server |

Mutable values such as Pod identity, release revision, build time, and uptime are not hard-coded into presentation copy. See [System fact ownership](docs/system-truth.md) for the full maintenance contract.

## Application stack

### Frontend

- Astro 7.2.9
- TypeScript client scripts
- English and Japanese routes
- WebGL background rendered as an atmospheric layer, not as the interaction model
- terminal-inspired visual language with conventional web navigation
- responsive touch layouts, keyboard interaction, reduced-motion handling, and browser-specific stability fixes where required

### Backend

- Go 1.24
- standard-library HTTP server
- serves the built Astro output and API routes from the same origin
- no framework dependency in `go.mod`
- process-owned runtime metadata

The public runtime-oriented endpoints include:

```text
GET  /api/health
GET  /api/runtime
POST /api/terminal
```

The terminal endpoint backs a strict virtual shell used by the portfolio UI. It is an allowlisted application interface, not access to the host shell.

### Production

- multi-stage Docker build
- distroless non-root runtime image
- Kubernetes + Kustomize
- Argo CD
- GHCR
- GitHub Actions
- Cloudflare Tunnel

The production Pod uses a read-only root filesystem, drops Linux capabilities, disables privilege escalation, uses `RuntimeDefault` seccomp, and does not mount a Kubernetes API token.

## Local development

### Requirements

- Node.js 22+
- npm
- Go 1.24+

Install the locked frontend dependency graph and start the real Go serving path:

```bash
git clone https://github.com/AlexanderGG-0520/portfolio.git
cd portfolio
make install
make dev
```

Then open:

```text
http://127.0.0.1:8080
```

`make dev` builds the Astro frontend first, then starts the Go backend with the generated frontend directory. This keeps local integration close to the actual application boundary instead of requiring a separate frontend server and API origin.

Run the local checks with:

```bash
make test
```

For more detail, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Container

Build and run the production-style image locally:

```bash
docker build -t portfolio:local .
docker run --rm -p 8080:8080 portfolio:local
```

The published image is:

```text
ghcr.io/alexandergg-0520/portfolio
```

Frontend dependencies are locked with `frontend/package-lock.json`, and local installation, CI, and Docker builds all use `npm ci`. The Node, Go, and distroless Docker bases are pinned by OCI digest as well as readable tags.

See [CONTAINER.md](CONTAINER.md) for the image contract and runtime metadata model.

## Kubernetes and GitOps

Render the manifests without applying them:

```bash
kubectl kustomize k8s/base
kubectl kustomize k8s/overlays/production
```

The intended steady-state operator is Argo CD. A direct apply is useful for inspection or recovery, but production normally follows the GitOps path.

```bash
kubectl apply -k k8s/overlays/production
kubectl -n portfolio rollout status deployment/portfolio
```

See [k8s/README.md](k8s/README.md) for the deployment topology, Argo CD bootstrap, Cloudflare Tunnel boundary, security posture, and automatic digest-promotion flow.

## CI and reproducibility

CI verifies more than compilation. The repository currently checks the following contracts:

- committed frontend lockfile and `npm ci` dependency resolution;
- Astro production build;
- Go tests;
- backend and static-frontend smoke tests;
- production container build and container-level smoke test;
- stable content/source-of-truth assertions;
- Kubernetes base and production Kustomize rendering;
- production image digest format;
- workload security settings;
- absence of a Kubernetes `Ingress` in the Cloudflare Tunnel path;
- Argo CD prune/self-heal bootstrap contract.

These controls are intended to make an incorrect deployment model fail during review instead of becoming documentation drift or a runtime surprise.

## Repository layout

```text
.
├─ frontend/                  Astro frontend and client-side interactions
├─ backend/                   Go server and API implementation
├─ k8s/
│  ├─ base/                   reusable Kubernetes workload
│  ├─ overlays/production/    production desired state
│  └─ argocd/                 Argo CD bootstrap resource
├─ docs/
│  └─ system-truth.md         fact ownership / source-of-truth contract
├─ .github/workflows/         CI, container publication, Kubernetes validation
├─ Dockerfile                 production image
├─ DEVELOPMENT.md             local development notes
├─ CONTAINER.md               image and runtime contract
└─ Makefile                   common local commands
```

## Design constraint

The terminal aesthetic is a visual language, not the site's interaction model.

The normal page remains the primary interface. The virtual terminal is an optional inspection surface for users who want to explore the same system through a CLI-shaped view. This keeps the portfolio expressive without requiring visitors to learn a fake shell just to navigate it.

## License

[MIT](LICENSE)
