# Kubernetes deployment

The portfolio is deployed as one stateless Go process serving both the API and the prebuilt Astro frontend.

```text
Internet
  ↓
Cloudflare
  ↓
Cloudflare Tunnel / cloudflared
  ↓
portfolio.portfolio.svc.cluster.local:80
  ↓
Service / portfolio
  ↓
Pod :8080
```

No Kubernetes `Ingress` is required for this deployment. The application owns a `ClusterIP` Service; public hostname and tunnel routing stay at the Cloudflare boundary.

## Layout

```text
k8s/
├─ base/
│  ├─ namespace.yaml
│  ├─ serviceaccount.yaml
│  ├─ deployment.yaml
│  ├─ service.yaml
│  └─ kustomization.yaml
├─ overlays/
│  └─ production/
│     └─ kustomization.yaml
└─ argocd/
   └─ application.yaml
```

The base is a reusable workload definition. The production overlay adds `PORTFOLIO_ENVIRONMENT=production` and pins the container by immutable OCI digest. The Argo CD `Application` is a bootstrap resource and is intentionally kept outside the application Kustomization.

## Render

```bash
kubectl kustomize k8s/base
kubectl kustomize k8s/overlays/production
```

## Deploy directly

```bash
kubectl apply -k k8s/overlays/production
kubectl -n portfolio rollout status deployment/portfolio
```

The intended steady-state operator is Argo CD rather than manual `kubectl apply`.

## Argo CD

Bootstrap once from a cluster that already has Argo CD installed in the `argocd` namespace:

```bash
kubectl apply -f k8s/argocd/application.yaml
```

The Application watches `main` at `k8s/overlays/production` and uses automated prune + self-heal. Argo CD remains the only component that mutates the cluster for application deployment; GitHub Actions only changes Git desired state.

## Cloudflare Tunnel

If `cloudflared` runs inside the cluster, configure the public hostname to use this origin:

```text
http://portfolio.portfolio.svc.cluster.local:80
```

The actual public hostname is deliberately not encoded in these manifests. DNS ownership and the `hostname → tunnel → origin` mapping belong to Cloudflare configuration, while Kubernetes only exposes the application internally.

If an existing tunnel connector runs outside Kubernetes, it cannot reach a ClusterIP by Kubernetes DNS directly. In that case either run a tunnel connector in-cluster or route the existing connector to the cluster over the private network without changing the application Service to a public `NodePort`/`LoadBalancer` solely for the tunnel.

## Runtime truth

Kubernetes supplies only deployment context that is authoritative at runtime:

- `PORTFOLIO_ORCHESTRATOR=kubernetes`
- `PORTFOLIO_INSTANCE` from `metadata.name` via the Downward API
- `PORTFOLIO_ENVIRONMENT=production` in the production overlay

Release version, Git revision and build time remain baked into the image at build time. They are not duplicated into the manifests.

## Security posture

The Pod:

- runs as non-root;
- uses the distroless runtime image;
- has a read-only root filesystem;
- drops all Linux capabilities;
- disables privilege escalation;
- uses `RuntimeDefault` seccomp;
- does not mount a Kubernetes API token;
- disables service-link environment injection;
- exposes only an internal `ClusterIP` Service.

The Deployment uses startup, readiness and liveness probes against `/api/health` and a rolling update strategy with zero unavailable replicas during a normal rollout.

## GHCR access

The manifest intentionally contains no registry credentials. `ghcr.io/alexandergg-0520/portfolio` must either be publicly pullable or the target cluster must provide an `imagePullSecret` through its own secret-management path. Do not commit a PAT or generated Docker config to this repository.

## Automatic production promotion

A merge to `main` now drives the complete deployment chain:

```text
main source commit
  ↓
GitHub Actions / Container
  ↓
build + push immutable OCI image
  ↓
resolve pushed sha256 digest
  ↓
rewrite production Kustomize digest
  ↓
render and verify production manifest
  ↓
chore(deploy): promote <source-sha> [skip ci]
  ↓
main Git desired state
  ↓
Argo CD
  ↓
Kubernetes rollout
```

The `publish` job returns the digest produced by `docker/build-push-action`. The `promote` job runs only for a push to `main`, checks out the latest `main`, replaces exactly one production `digest:` field, validates its format, renders the overlay with `kubectl kustomize`, and commits the result back to Git.

Production therefore remains immutable without requiring a human to copy a digest after every image publish. Git is still the deployment source of truth: GitHub Actions does **not** call `kubectl set image`, the Kubernetes API, or Argo CD directly.

Promotion commits only change `k8s/overlays/production/kustomization.yaml`. The Container workflow ignores `k8s/**`-only pushes, and promotion commits include `[skip ci]`, so a promotion does not recursively build and publish another image. Workflow concurrency also cancels an older in-progress run when a newer commit reaches the same ref, reducing the risk of a stale image being promoted after a newer one.

Tag builds and manual workflow dispatches still publish OCI images, but they do not automatically promote production. Production follows successful source pushes to `main`.
