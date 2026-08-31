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
	response := runTerminalCommand("fastfetch")
	if response.ExitCode != 0 {
		t.Fatalf("expected exit code 0, got %d", response.ExitCode)
	}
	if len(response.Lines) < 5 {
		t.Fatalf("expected fastfetch output, got %v", response.Lines)
	}
}

func TestRunTerminalCommandUnknownFailsClosed(t *testing.T) {
	response := runTerminalCommand("rm -rf /")
	if response.ExitCode != 127 {
		t.Fatalf("expected unknown command exit code 127, got %d", response.ExitCode)
	}
	if len(response.Lines) == 0 || response.Lines[0] != "rm: command not found" {
		t.Fatalf("unexpected unknown command response: %v", response.Lines)
	}
}

func TestRunTerminalCommandClear(t *testing.T) {
	response := runTerminalCommand("clear")
	if !response.Clear {
		t.Fatal("expected clear response")
	}
}

func TestTerminalEndpoint(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/terminal", strings.NewReader(`{"command":"projects"}`))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	newHandler(t.TempDir()).ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if body := recorder.Body.String(); !strings.Contains(body, "Minecartainer") || !strings.Contains(body, `"exitCode":0`) {
		t.Fatalf("terminal response missing expected output: %s", body)
	}
}
