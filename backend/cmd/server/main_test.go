package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	recorder := httptest.NewRecorder()
	newHandler(t.TempDir()).ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if body := recorder.Body.String(); !strings.Contains(body, `"status":"healthy"`) {
		t.Fatalf("health response missing status: %s", body)
	}
}

func TestProfile(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/profile", nil)
	recorder := httptest.NewRecorder()
	newHandler(t.TempDir()).ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if body := recorder.Body.String(); !strings.Contains(body, "Minecartainer") || !strings.Contains(body, "mc-router") {
		t.Fatalf("profile response missing featured projects: %s", body)
	}
}

func TestRunTerminalCommandFastfetch(t *testing.T) {
	response := runTerminalCommand("fastfetch", "/")
	if response.ExitCode != 0 {
		t.Fatalf("expected exit code 0, got %d", response.ExitCode)
	}
	if len(response.Lines) < 5 || !strings.Contains(strings.Join(response.Lines, "\n"), "fish-inspired") {
		t.Fatalf("expected fish-like fastfetch output, got %v", response.Lines)
	}
}

func TestRunTerminalCommandTraceSystem(t *testing.T) {
	response := runTerminalCommand("trace --system", "/")
	if response.ExitCode != 0 {
		t.Fatalf("expected trace exit code 0, got %d", response.ExitCode)
	}

	output := strings.Join(response.Lines, "\n")
	for _, expected := range []string{
		"Internet",
		"web        → Portfolio / Astro ↔ Go API",
		"minecraft  → mc-router",
		"Kubernetes",
		"cp-01",
		"worker-01",
		"Proxmox VE",
		"PHYSICAL FAILURE DOMAIN",
		"1 host",
		"trace complete",
	} {
		if !strings.Contains(output, expected) {
			t.Fatalf("trace output missing %q:\n%s", expected, output)
		}
	}
}

func TestRunTerminalCommandTraceRejectsUnknownTarget(t *testing.T) {
	response := runTerminalCommand("trace --internet", "/")
	if response.ExitCode != 2 {
		t.Fatalf("expected trace usage error 2, got %d", response.ExitCode)
	}
	if output := strings.Join(response.Lines, "\n"); !strings.Contains(output, "unsupported target") || !strings.Contains(output, "trace --system") {
		t.Fatalf("unexpected trace usage response: %s", output)
	}
}

func TestRunTerminalCommandUnknownFailsClosed(t *testing.T) {
	response := runTerminalCommand("rm -rf /", "/")
	if response.ExitCode != 127 {
		t.Fatalf("expected unknown command exit code 127, got %d", response.ExitCode)
	}
	if len(response.Lines) == 0 || response.Lines[0] != "rm: command not found" {
		t.Fatalf("unexpected unknown command response: %v", response.Lines)
	}
}

func TestRunTerminalCommandClear(t *testing.T) {
	response := runTerminalCommand("clear", "/")
	if !response.Clear {
		t.Fatal("expected clear response")
	}
}

func TestVirtualFilesystemNavigation(t *testing.T) {
	cd := runTerminalCommand("cd projects", "/")
	if cd.ExitCode != 0 || cd.CWD != "/projects" {
		t.Fatalf("cd response = %#v", cd)
	}

	listing := runTerminalCommand("ls", cd.CWD)
	if len(listing.Entries) < 2 || listing.Entries[0].Kind != "dir" {
		t.Fatalf("unexpected project listing: %#v", listing.Entries)
	}

	readme := runTerminalCommand("cat minecartainer/README.md", cd.CWD)
	if readme.ExitCode != 0 || !strings.Contains(strings.Join(readme.Lines, "\n"), "Treat the container as disposable") {
		t.Fatalf("unexpected README output: %#v", readme)
	}
}

func TestVirtualFilesystemCannotEscapeRoot(t *testing.T) {
	response := runTerminalCommand("cd ../../../../", "/projects")
	if response.ExitCode != 0 || response.CWD != "/" {
		t.Fatalf("expected traversal to clamp to virtual root, got %#v", response)
	}
}

func TestTerminalEndpointCarriesCWD(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/terminal", strings.NewReader(`{"command":"pwd","cwd":"/projects"}`))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	newHandler(t.TempDir()).ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body = %s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	body := recorder.Body.String()
	if !strings.Contains(body, `"cwd":"/projects"`) || !strings.Contains(body, "~/portfolio/projects") {
		t.Fatalf("terminal response missing cwd: %s", body)
	}
}
