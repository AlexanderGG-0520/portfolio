package main

import (
	"net/http"
	"runtime"
	"strings"
	"time"
	"unicode"
)

var (
	buildVersion    = "dev"
	buildRevision   = "dev"
	buildTime       = "unknown"
	processStartedAt = time.Now().UTC()
)

type runtimeInfo struct {
	Language      string `json:"language"`
	Version       string `json:"version"`
	StartedAt     string `json:"startedAt"`
	UptimeSeconds int64  `json:"uptimeSeconds"`
}

type releaseInfo struct {
	Version  string `json:"version"`
	Revision string `json:"revision"`
	BuiltAt  string `json:"builtAt"`
}

type deploymentInfo struct {
	Environment  string `json:"environment"`
	Orchestrator string `json:"orchestrator"`
	Instance     string `json:"instance"`
}

type runtimeSnapshot struct {
	Status       string         `json:"status"`
	Service      string         `json:"service"`
	ServerTime   string         `json:"serverTime"`
	Runtime      runtimeInfo    `json:"runtime"`
	Release      releaseInfo    `json:"release"`
	Deployment   deploymentInfo `json:"deployment"`
	Capabilities []string       `json:"capabilities"`
}

func registerRuntimeHandlers(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/runtime", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusOK, currentRuntimeSnapshot(time.Now().UTC()))
	})
}

func currentRuntimeSnapshot(now time.Time) runtimeSnapshot {
	uptime := now.Sub(processStartedAt)
	if uptime < 0 {
		uptime = 0
	}

	return runtimeSnapshot{
		Status:     "healthy",
		Service:    "portfolio-backend",
		ServerTime: now.Format(time.RFC3339),
		Runtime: runtimeInfo{
			Language:      "Go",
			Version:       runtime.Version(),
			StartedAt:     processStartedAt.Format(time.RFC3339),
			UptimeSeconds: int64(uptime / time.Second),
		},
		Release: releaseInfo{
			Version:  publicMetadataValue("PORTFOLIO_VERSION", buildVersion),
			Revision: publicMetadataValue("PORTFOLIO_REVISION", buildRevision),
			BuiltAt:  publicMetadataValue("PORTFOLIO_BUILD_TIME", buildTime),
		},
		Deployment: deploymentInfo{
			Environment:  publicMetadataValue("PORTFOLIO_ENVIRONMENT", "local"),
			Orchestrator: publicMetadataValue("PORTFOLIO_ORCHESTRATOR", "process"),
			Instance:     publicMetadataValue("PORTFOLIO_INSTANCE", "local"),
		},
		Capabilities: []string{
			"runtime-truth",
			"virtual-shell",
			"static-frontend-delivery",
		},
	}
}

func publicMetadataValue(key, fallback string) string {
	value := strings.TrimSpace(envOr(key, fallback))
	if value == "" || len(value) > 96 {
		return fallback
	}
	for _, r := range value {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || strings.ContainsRune("._:/@+-", r) {
			continue
		}
		return fallback
	}
	return value
}

func runtimeCommandLines() []string {
	snapshot := currentRuntimeSnapshot(time.Now().UTC())
	return []string{
		"portfolio-backend / runtime truth",
		"-------------------------------",
		"status:       " + snapshot.Status,
		"environment:  " + snapshot.Deployment.Environment,
		"orchestrator: " + snapshot.Deployment.Orchestrator,
		"instance:     " + snapshot.Deployment.Instance,
		"go:           " + snapshot.Runtime.Version,
		"version:      " + snapshot.Release.Version,
		"revision:     " + snapshot.Release.Revision,
		"started-at:   " + snapshot.Runtime.StartedAt,
		"uptime:       " + formatUptime(snapshot.Runtime.UptimeSeconds),
		"source:       GET /api/runtime",
	}
}

func formatUptime(seconds int64) string {
	if seconds < 0 {
		seconds = 0
	}
	return (time.Duration(seconds) * time.Second).String()
}
