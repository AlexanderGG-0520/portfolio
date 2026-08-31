// Stable presentation facts shared by frontend views.
//
// Authority boundaries:
// - Kubernetes desired state lives under k8s/ and the deployment workflow.
// - Live process/release/deployment state comes from GET /api/runtime.
// - This module only names stable topology and ownership relationships that the
//   frontend needs to present in more than one place. Do not put live values,
//   image digests, Pod names, revisions, or uptime here.
export const systemModel = {
  web: {
    publicEdge: 'Cloudflare Tunnel',
    service: 'ClusterIP Service',
    application: 'Astro frontend ↔ Go API',
    exposurePath: 'Cloudflare Tunnel → ClusterIP Service',
  },
  platform: {
    orchestrator: 'Kubernetes',
    delivery: 'Argo CD',
    network: 'Cilium',
    storage: 'Longhorn',
    runtime: 'CRI-O',
  },
  deployment: {
    workload: 'Kubernetes Deployment',
    instanceIdentity: 'Downward API',
    releaseIdentity: 'OCI image build metadata',
  },
} as const;
