# System fact ownership

The portfolio presents the same system through several interfaces, but those interfaces must not become independent sources of truth.

## 1. System topology

Stable topology belongs to the architecture model.

Frontend presentation uses `frontend/src/data/system-model.ts` for relationships that legitimately appear in more than one frontend view, such as:

```text
Cloudflare Tunnel → ClusterIP Service → Go / Astro
Kubernetes → Cilium / Longhorn / Argo CD / CRI-O
```

The Architecture layer is the primary visual representation of that model. The Hero should stay conceptual and avoid deployment-specific detail unless it is essential to the thesis.

The terminal `trace` views and virtual filesystem are derived inspection views. They may restate the topology for a CLI representation, but they are not allowed to invent a different deployment model.

## 2. Deployment desired state

Deployment facts are owned by Git, not by marketing copy.

Authoritative files are:

- `.github/workflows/container.yml` — image build, publication and digest promotion;
- `k8s/base/**` — workload and Service contract;
- `k8s/overlays/production/**` — production image and environment desired state;
- `k8s/argocd/application.yaml` — reconciliation boundary.

The current production chain is:

```text
main source commit
→ GitHub Actions
→ GHCR OCI image
→ immutable digest promotion in Git
→ Argo CD
→ Kubernetes Deployment
```

Static frontend copy should describe ownership or architecture, not duplicate mutable digests, revisions or Pod names.

## 3. Runtime truth

Facts that only the serving process can authoritatively know belong to the Go runtime snapshot exposed by `GET /api/runtime`.

Examples:

- environment;
- orchestrator;
- instance / Pod identity;
- release version;
- Git revision;
- build time;
- process start time;
- uptime.

`Live Runtime`, `runtime`, and runtime-aware `trace` targets consume this source instead of maintaining their own values.

## Maintenance rule

When the deployment changes, update the authoritative implementation first, then update derived presentation only where the user-facing model actually changes.

Avoid temporal copy such as “Kubernetes later” or “target runtime” for facts that can instead be observed from runtime truth. CI should reject known stale claims so a completed migration cannot remain described as future work.
