package main

import (
	"strings"
	"time"
)

func runTrace(fields []string) ([]string, int) {
	usage := traceUsage()

	if len(fields) == 1 {
		return usage, 0
	}
	if len(fields) != 2 {
		return append([]string{"trace: expected one target"}, usage...), 2
	}

	switch strings.ToLower(fields[1]) {
	case "--help", "-h":
		return append([]string{
			"trace one layer of the portfolio system through explicit responsibility boundaries",
			"",
		}, usage...), 0
	case "--system":
		return traceSystemLines(), 0
	case "--network":
		return traceNetworkLines(), 0
	case "--deployment":
		return traceDeploymentLines(), 0
	case "--runtime":
		return traceRuntimeLines(), 0
	case "--state":
		return traceStateLines(), 0
	default:
		return append([]string{"trace: unsupported target: " + fields[1]}, usage...), 2
	}
}

func traceUsage() []string {
	return []string{
		"usage: trace <target>",
		"",
		"targets:",
		"  trace --system       complete system / responsibility boundaries",
		"  trace --network      public web path from Cloudflare to the Go process",
		"  trace --deployment   OCI image promotion and Kubernetes reconciliation",
		"  trace --runtime      live Go process, release, routes, and ownership",
		"  trace --state        stateless portfolio vs persistent workload boundary",
		"  trace --help         show trace targets",
	}
}

func traceSystemLines() []string {
	return []string{
		"trace: ~/portfolio/system",
		"",
		"PUBLIC",
		"Internet",
		"├─ web        → Portfolio / Astro ↔ Go API  via Cloudflare Tunnel / ClusterIP Service",
		"└─ minecraft  → mc-router → Minecraft workloads",
		"                             └─ Minecartainer / stateful runtime",
		"",
		"                    ↓ platform boundary",
		"",
		"PLATFORM",
		"Kubernetes",
		"├─ Cilium     network",
		"├─ Longhorn   storage",
		"├─ Argo CD    delivery / reconciliation",
		"└─ CRI-O      runtime",
		"",
		"                    ↓ VM boundary",
		"",
		"VIRTUAL MACHINES",
		"├─ cp-01      control plane / etcd",
		"└─ worker-01  application workloads",
		"",
		"                    ↓ virtualization boundary",
		"",
		"Proxmox VE",
		"",
		"                    ↓ physical boundary",
		"",
		"PHYSICAL FAILURE DOMAIN",
		"1 host",
		"",
		"responsibility boundaries:",
		"  public    Cloudflare / tunnel exposure",
		"  edge      protocol-aware Minecraft routing",
		"  runtime   process and persistent workload lifecycle",
		"  platform  reconciliation / network / storage / delivery",
		"  vm        control-plane and worker lifecycle separation",
		"  physical  current single-host failure domain",
		"",
		"trace complete",
		"hint: trace --network | --deployment | --runtime | --state",
	}
}

func traceNetworkLines() []string {
	snapshot := currentRuntimeSnapshot(time.Now().UTC())
	pathLabel := "PRODUCTION PATH"
	if snapshot.Deployment.Environment == "production" && snapshot.Deployment.Orchestrator == "kubernetes" {
		pathLabel = "ACTIVE PRODUCTION PATH"
	}

	return []string{
		"trace: ~/portfolio/network",
		"",
		pathLabel,
		"Internet",
		"  ↓ HTTPS / public edge",
		"Cloudflare",
		"  ↓ Cloudflare Tunnel",
		"cloudflared",
		"  ↓ cluster-private HTTP",
		"portfolio.portfolio.svc.cluster.local:80",
		"  ↓ ClusterIP Service",
		"Pod " + snapshot.Deployment.Instance + ":8080",
		"  ↓",
		"Go HTTP server",
		"├─ /, /en/, /ja/  → prebuilt Astro frontend",
		"└─ /api/*          → Go handlers / runtime truth / terminal",
		"",
		"exposure boundary:",
		"  public endpoint  Cloudflare",
		"  cluster service  ClusterIP only",
		"  Ingress          none",
		"  NodePort         none",
		"  LoadBalancer     none",
		"",
		"current runtime:",
		"  environment   " + snapshot.Deployment.Environment,
		"  orchestrator  " + snapshot.Deployment.Orchestrator,
		"  instance      " + snapshot.Deployment.Instance,
		"",
		"trace complete",
	}
}

func traceDeploymentLines() []string {
	snapshot := currentRuntimeSnapshot(time.Now().UTC())

	return []string{
		"trace: ~/portfolio/deployment",
		"",
		"SOURCE",
		"Git / main",
		"  ↓ GitHub Actions",
		"OCI image / ghcr.io/alexandergg-0520/portfolio",
		"  ↓ immutable digest promotion in Git",
		"k8s/overlays/production",
		"  ↓ Argo CD sync / self-heal / prune",
		"Kustomize",
		"  ↓",
		"Deployment / portfolio",
		"  ↓ ReplicaSet",
		"Pod / " + snapshot.Deployment.Instance,
		"  ↓",
		"Service / portfolio :80 → :8080",
		"",
		"identity boundary:",
		"  release version  " + snapshot.Release.Version,
		"  Git revision     " + snapshot.Release.Revision,
		"  built at         " + snapshot.Release.BuiltAt,
		"  environment      " + snapshot.Deployment.Environment,
		"  orchestrator     " + snapshot.Deployment.Orchestrator,
		"  instance         " + snapshot.Deployment.Instance,
		"",
		"ownership:",
		"  build identity    baked into the OCI image",
		"  desired state     Git / Kustomize",
		"  reconciliation    Argo CD / Kubernetes",
		"  instance identity Downward API",
		"",
		"trace complete",
	}
}

func traceRuntimeLines() []string {
	snapshot := currentRuntimeSnapshot(time.Now().UTC())

	return []string{
		"trace: ~/portfolio/runtime",
		"",
		"REQUEST",
		"browser / virtual terminal",
		"  ↓ HTTP",
		"portfolio-backend",
		"├─ language      Go",
		"├─ runtime       " + snapshot.Runtime.Version,
		"├─ instance      " + snapshot.Deployment.Instance,
		"├─ environment   " + snapshot.Deployment.Environment,
		"├─ orchestrator  " + snapshot.Deployment.Orchestrator,
		"├─ release       " + snapshot.Release.Version,
		"├─ revision      " + snapshot.Release.Revision,
		"└─ uptime        " + formatUptime(snapshot.Runtime.UptimeSeconds),
		"",
		"ROUTES",
		"├─ /, /en/, /ja/  static Astro build",
		"├─ /api/health     health boundary",
		"├─ /api/runtime    process / release / deployment truth",
		"└─ /api/terminal   allowlisted virtual shell",
		"",
		"ownership:",
		"  presentation  Astro build artifact",
		"  runtime truth Go process",
		"  deploy context explicit env / Downward API",
		"  host internals not exposed implicitly",
		"",
		"trace complete",
	}
}

func traceStateLines() []string {
	return []string{
		"trace: ~/portfolio/state",
		"",
		"PORTFOLIO",
		"stateless workload",
		"├─ Go binary       immutable image content",
		"├─ Astro frontend  immutable image content",
		"├─ runtime truth   process + explicit deployment metadata",
		"└─ persistent data none / no PVC",
		"",
		"                    ↓ state ownership boundary",
		"",
		"MINECARTAINER WORKLOAD MODEL",
		"Pod / container    disposable compute",
		"  ↓",
		"Minecraft world    long-lived state",
		"  ↓",
		"PVC / storage      survives Pod replacement",
		"",
		"PLATFORM",
		"Longhorn           persistent volume responsibility",
		"S3-compatible      explicit asset / backup workflows where configured",
		"",
		"invariant:",
		"  Treat the container as disposable. Treat the world as valuable.",
		"",
		"trace complete",
	}
}
