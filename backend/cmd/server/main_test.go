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
