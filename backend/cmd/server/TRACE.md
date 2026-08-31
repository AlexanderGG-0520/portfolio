# `trace` command

The portfolio terminal exposes several read-only views of the same system model.

```text
trace --system
trace --network
trace --deployment
trace --runtime
trace --state
trace --help
```

`trace --system` remains the broad architecture view used by the hero. The additional targets progressively narrow that model instead of inventing separate diagrams.

- `--network` follows the production web request path through Cloudflare Tunnel, the cluster-private Service and the Go HTTP process.
- `--deployment` follows source → GitHub Actions → OCI image → immutable digest promotion → Argo CD → Kubernetes and includes live release/deployment identity.
- `--runtime` inspects the currently running Go process and the ownership boundary between the Astro build, runtime truth and deployment metadata.
- `--state` contrasts this portfolio's stateless workload with the persistent-state boundary demonstrated by Minecartainer.

## Authority boundaries

`trace` is an inspection surface, not an independent source of truth.

- Kubernetes desired state is defined by `.github/workflows/container.yml` and `k8s/**`.
- Runtime identity comes from the same `currentRuntimeSnapshot` source as `GET /api/runtime`.
- Static trace topology must follow the deployed architecture rather than carrying migration plans or future-tense deployment claims.
- Runtime-aware targets do not scrape Kubernetes or expose arbitrary host/process environment data.

Repository-wide ownership rules are documented in `docs/system-truth.md`.
