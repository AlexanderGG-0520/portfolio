package main

import (
	"strings"
	"testing"
)

func TestTraceHelpListsAllTargets(t *testing.T) {
	response := runTerminalCommand("trace --help", "/")
	if response.ExitCode != 0 {
		t.Fatalf("expected exit code 0, got %d", response.ExitCode)
	}

	output := strings.Join(response.Lines, "\n")
	for _, expected := range []string{
		"trace --system",
		"trace --network",
		"trace --deployment",
		"trace --runtime",
		"trace --state",
	} {
		if !strings.Contains(output, expected) {
			t.Fatalf("trace help missing %q:\n%s", expected, output)
		}
	}
}

func TestTraceNetworkUsesRuntimeContext(t *testing.T) {
	t.Setenv("PORTFOLIO_ENVIRONMENT", "production")
	t.Setenv("PORTFOLIO_ORCHESTRATOR", "kubernetes")
	t.Setenv("PORTFOLIO_INSTANCE", "portfolio-test-123")

	response := runTerminalCommand("trace --network", "/")
	if response.ExitCode != 0 {
		t.Fatalf("expected exit code 0, got %d", response.ExitCode)
	}

	output := strings.Join(response.Lines, "\n")
	for _, expected := range []string{
		"ACTIVE PRODUCTION PATH",
		"Cloudflare Tunnel",
		"portfolio.portfolio.svc.cluster.local:80",
		"Pod portfolio-test-123:8080",
		"ClusterIP only",
		"Ingress          none",
	} {
		if !strings.Contains(output, expected) {
			t.Fatalf("network trace missing %q:\n%s", expected, output)
		}
	}
}

func TestTraceDeploymentUsesReleaseAndInstanceTruth(t *testing.T) {
	t.Setenv("PORTFOLIO_VERSION", "test-release")
	t.Setenv("PORTFOLIO_REVISION", "abc123def")
	t.Setenv("PORTFOLIO_BUILD_TIME", "2026-08-31T12:00:00Z")
	t.Setenv("PORTFOLIO_ENVIRONMENT", "production")
	t.Setenv("PORTFOLIO_ORCHESTRATOR", "kubernetes")
	t.Setenv("PORTFOLIO_INSTANCE", "portfolio-test-456")

	response := runTerminalCommand("trace --deployment", "/")
	if response.ExitCode != 0 {
		t.Fatalf("expected exit code 0, got %d", response.ExitCode)
	}

	output := strings.Join(response.Lines, "\n")
	for _, expected := range []string{
		"GitHub Actions",
		"ghcr.io/alexandergg-0520/portfolio",
		"immutable digest promotion",
		"Argo CD",
		"Kustomize",
		"portfolio-test-456",
		"test-release",
		"abc123def",
		"2026-08-31T12:00:00Z",
	} {
		if !strings.Contains(output, expected) {
			t.Fatalf("deployment trace missing %q:\n%s", expected, output)
		}
	}
}

func TestTraceRuntimeShowsBackendOwnership(t *testing.T) {
	t.Setenv("PORTFOLIO_ENVIRONMENT", "production")
	t.Setenv("PORTFOLIO_ORCHESTRATOR", "kubernetes")
	t.Setenv("PORTFOLIO_INSTANCE", "portfolio-runtime-test")

	response := runTerminalCommand("trace --runtime", "/")
	if response.ExitCode != 0 {
		t.Fatalf("expected exit code 0, got %d", response.ExitCode)
	}

	output := strings.Join(response.Lines, "\n")
	for _, expected := range []string{
		"portfolio-backend",
		"portfolio-runtime-test",
		"/api/runtime",
		"/api/terminal",
		"runtime truth Go process",
		"host internals not exposed implicitly",
	} {
		if !strings.Contains(output, expected) {
			t.Fatalf("runtime trace missing %q:\n%s", expected, output)
		}
	}
}

func TestTraceStateShowsStatelessAndPersistentBoundary(t *testing.T) {
	response := runTerminalCommand("trace --state", "/")
	if response.ExitCode != 0 {
		t.Fatalf("expected exit code 0, got %d", response.ExitCode)
	}

	output := strings.Join(response.Lines, "\n")
	for _, expected := range []string{
		"stateless workload",
		"none / no PVC",
		"MINECARTAINER WORKLOAD MODEL",
		"Minecraft world",
		"Longhorn",
		"Treat the container as disposable. Treat the world as valuable.",
	} {
		if !strings.Contains(output, expected) {
			t.Fatalf("state trace missing %q:\n%s", expected, output)
		}
	}
}

func TestTraceRejectsMultipleTargets(t *testing.T) {
	response := runTerminalCommand("trace --network --runtime", "/")
	if response.ExitCode != 2 {
		t.Fatalf("expected exit code 2, got %d", response.ExitCode)
	}
	if output := strings.Join(response.Lines, "\n"); !strings.Contains(output, "expected one target") {
		t.Fatalf("unexpected response:\n%s", output)
	}
}
