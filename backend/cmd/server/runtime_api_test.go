package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestRuntimeEndpoint(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/runtime", nil)
	recorder := httptest.NewRecorder()
	newHandler(t.TempDir()).ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if got := recorder.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("Cache-Control = %q, want no-store", got)
	}

	var snapshot runtimeSnapshot
	if err := json.Unmarshal(recorder.Body.Bytes(), &snapshot); err != nil {
		t.Fatalf("decode runtime response: %v", err)
	}
	if snapshot.Status != "healthy" || snapshot.Service != "portfolio-backend" {
		t.Fatalf("unexpected runtime identity: %#v", snapshot)
	}
	if snapshot.Runtime.Language != "Go" || snapshot.Runtime.Version == "" {
		t.Fatalf("runtime metadata missing: %#v", snapshot.Runtime)
	}
	if snapshot.Runtime.StartedAt == "" || snapshot.ServerTime == "" {
		t.Fatalf("runtime timestamps missing: %#v", snapshot)
	}
}

func TestRuntimeMetadataUsesExplicitPublicEnvironment(t *testing.T) {
	t.Setenv("PORTFOLIO_ENVIRONMENT", "development")
	t.Setenv("PORTFOLIO_ORCHESTRATOR", "process")
	t.Setenv("PORTFOLIO_INSTANCE", "local-dev")
	t.Setenv("PORTFOLIO_REVISION", "abc1234")

	snapshot := currentRuntimeSnapshot(processStartedAt)
	if snapshot.Deployment.Environment != "development" {
		t.Fatalf("environment = %q", snapshot.Deployment.Environment)
	}
	if snapshot.Deployment.Instance != "local-dev" {
		t.Fatalf("instance = %q", snapshot.Deployment.Instance)
	}
	if snapshot.Release.Revision != "abc1234" {
		t.Fatalf("revision = %q", snapshot.Release.Revision)
	}
}

func TestRuntimeMetadataRejectsUnsafeValues(t *testing.T) {
	old := os.Getenv("PORTFOLIO_INSTANCE")
	t.Cleanup(func() { _ = os.Setenv("PORTFOLIO_INSTANCE", old) })
	if err := os.Setenv("PORTFOLIO_INSTANCE", "secret value with spaces"); err != nil {
		t.Fatal(err)
	}

	snapshot := currentRuntimeSnapshot(processStartedAt)
	if snapshot.Deployment.Instance != "local" {
		t.Fatalf("unsafe instance leaked into public snapshot: %q", snapshot.Deployment.Instance)
	}
}

func TestRuntimeTerminalCommand(t *testing.T) {
	response := runTerminalCommand("runtime", "/")
	if response.ExitCode != 0 {
		t.Fatalf("exit code = %d", response.ExitCode)
	}
	joined := strings.Join(response.Lines, "\n")
	if !strings.Contains(joined, "GET /api/runtime") || !strings.Contains(joined, "portfolio-backend") {
		t.Fatalf("unexpected runtime command output: %s", joined)
	}
}
