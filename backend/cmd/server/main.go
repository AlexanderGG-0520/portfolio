package main

import (
	"context"
	"encoding/json"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"
)

type profile struct {
	Name     string   `json:"name"`
	Role     string   `json:"role"`
	Thesis   string   `json:"thesis"`
	Focus    []string `json:"focus"`
	Projects []string `json:"projects"`
}

type design struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type terminalRequest struct {
	Command string `json:"command"`
}

type terminalResponse struct {
	Command  string   `json:"command"`
	Lines    []string `json:"lines"`
	ExitCode int      `json:"exitCode"`
	Clear    bool     `json:"clear,omitempty"`
}

func main() {
	addr := flag.String("addr", envOr("PORTFOLIO_ADDR", "127.0.0.1:8080"), "listen address")
	frontend := flag.String("frontend", envOr("PORTFOLIO_FRONTEND_DIR", "../frontend/dist"), "Astro build directory")
	flag.Parse()

	server := &http.Server{
		Addr:              *addr,
		Handler:           newHandler(*frontend),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		slog.Info("portfolio backend listening", "addr", *addr, "frontend", *frontend)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown failed", "error", err)
	}
}

func newHandler(frontendDir string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":  "healthy",
			"service": "portfolio-backend",
			"runtime": runtime.Version(),
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("GET /api/profile", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, profile{
			Name:   "Alec",
			Role:   "Backend / Infrastructure / Systems Engineering",
			Thesis: "I build software as complete systems, through the infrastructure that runs them.",
			Focus:  []string{"Backend", "Infrastructure", "Systems", "Operations"},
			Projects: []string{
				"Minecartainer",
				"mc-router",
				"Home Kubernetes Platform",
			},
		})
	})

	mux.HandleFunc("GET /api/designs", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, []design{
			{ID: "a", Name: "Focus Pane", Description: "Typography and whitespace first."},
			{ID: "b", Name: "Tiled Systems", Description: "Hyprland-like panes and topology first."},
			{ID: "c", Name: "Signal Field", Description: "GPU atmosphere and network flow first."},
		})
	})

	mux.HandleFunc("POST /api/terminal", func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1024)
		var request terminalRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
			return
		}

		command := strings.TrimSpace(request.Command)
		if len(command) > 128 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "command too long"})
			return
		}

		writeJSON(w, http.StatusOK, runTerminalCommand(command))
	})

	mux.Handle("/", http.FileServer(http.Dir(frontendDir)))
	return securityHeaders(mux)
}

func runTerminalCommand(command string) terminalResponse {
	fields := strings.Fields(command)
	if len(fields) == 0 {
		return terminalResponse{Command: command, Lines: []string{}, ExitCode: 0}
	}

	name := strings.ToLower(fields[0])
	response := terminalResponse{Command: command, Lines: []string{}, ExitCode: 0}

	switch name {
	case "help":
		response.Lines = []string{
			"available commands:",
			"  fastfetch   portfolio/system summary",
			"  whoami      engineering identity",
			"  projects    featured systems",
			"  stack       current portfolio stack",
			"  health      backend health/runtime",
			"  pwd         current portfolio path",
			"  ls          visible portfolio layers",
			"  github      GitHub profile",
			"  clear       clear this terminal",
			"  help        show this list",
		}
	case "fastfetch", "neofetch":
		response.Lines = []string{
			"Alec@portfolio",
			"--------------",
			"Role:             Backend / Infrastructure / Systems Engineering",
			"Focus:            software -> runtime -> infrastructure",
			"Frontend:         Astro + TypeScript",
			"Backend:          Go",
			"Target runtime:   Kubernetes",
			"Edge:             mc-router",
			"Stateful runtime: Minecartainer",
			"Theme:            Catppuccin Mocha",
			"TTY:              portfolio / allowlisted API",
		}
	case "whoami":
		response.Lines = []string{"Alec — Backend / Infrastructure / Systems Engineering", "Builds software through the infrastructure that actually runs it."}
	case "projects":
		response.Lines = []string{
			"Minecartainer              stateful workload lifecycle",
			"mc-router                  protocol-aware network edge",
			"Home Kubernetes Platform   infrastructure / operations",
		}
	case "stack":
		response.Lines = []string{
			"browser -> Astro -> Go API",
			"internet -> mc-router -> workloads",
			"workloads -> Kubernetes -> Proxmox / physical infrastructure",
		}
	case "health":
		response.Lines = []string{"portfolio-backend: healthy", "runtime: " + runtime.Version()}
	case "pwd":
		response.Lines = []string{"/home/alec/portfolio"}
	case "ls":
		response.Lines = []string{"architecture/  projects/  infrastructure/  about/"}
	case "github":
		response.Lines = []string{"https://github.com/AlexanderGG-0520"}
	case "clear":
		response.Clear = true
	default:
		response.ExitCode = 127
		response.Lines = []string{name + ": command not found", "try: help"}
	}

	return response
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		slog.Error("encode response", "error", err)
	}
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		next.ServeHTTP(w, r)
	})
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func init() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{})))
}
