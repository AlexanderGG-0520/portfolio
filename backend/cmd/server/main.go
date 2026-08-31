package main

import (
	"context"
	"encoding/json"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	pathpkg "path"
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
	CWD     string `json:"cwd"`
}

type terminalEntry struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
}

type terminalResponse struct {
	Command  string          `json:"command"`
	CWD      string          `json:"cwd"`
	Lines    []string        `json:"lines"`
	Entries  []terminalEntry `json:"entries,omitempty"`
	ExitCode int             `json:"exitCode"`
	Clear    bool            `json:"clear,omitempty"`
	Close    bool            `json:"close,omitempty"`
}

type virtualNode struct {
	Dir      bool
	Children []terminalEntry
	Lines    []string
}

var portfolioFS = map[string]virtualNode{
	"/": {
		Dir: true,
		Children: []terminalEntry{
			{Name: "architecture/", Kind: "dir"},
			{Name: "projects/", Kind: "dir"},
			{Name: "infrastructure/", Kind: "dir"},
			{Name: "about/", Kind: "dir"},
			{Name: "README.md", Kind: "file"},
		},
	},
	"/README.md": {
		Lines: []string{
			"Alec's portfolio",
			"",
			"Software is presented as a complete system: code, runtime, network edge, and infrastructure.",
			"Use `ls`, `cd`, and `cat` to explore the virtual portfolio filesystem.",
		},
	},
	"/architecture": {
		Dir: true,
		Children: []terminalEntry{
			{Name: "system.md", Kind: "file"},
			{Name: "boundaries.md", Kind: "file"},
		},
	},
	"/architecture/system.md": {
		Lines: []string{
			"Internet",
			"├─ web        → Portfolio / Astro ↔ Go API",
			"└─ minecraft  → mc-router → Minecraft workloads",
			"                             └─ Minecartainer / stateful runtime",
			"",
			"Both lanes descend through Kubernetes → cp-01 / worker-01 → Proxmox VE → one physical host.",
			"The portfolio follows the same idea: software is designed through the infrastructure that actually runs it.",
		},
	},
	"/architecture/boundaries.md": {
		Lines: []string{
			"Minecartainer: stateful workload lifecycle",
			"mc-router: protocol-aware network edge",
			"Home Kubernetes Platform: infrastructure and operations",
		},
	},
	"/projects": {
		Dir: true,
		Children: []terminalEntry{
			{Name: "minecartainer/", Kind: "dir"},
			{Name: "mc-router/", Kind: "dir"},
			{Name: "yw1-iv-calculator/", Kind: "dir"},
		},
	},
	"/projects/minecartainer": {
		Dir: true,
		Children: []terminalEntry{{Name: "README.md", Kind: "file"}},
	},
	"/projects/minecartainer/README.md": {
		Lines: []string{
			"Minecartainer",
			"Stateful workload / container lifecycle engineering.",
			"Treat the container as disposable. Treat the world as valuable.",
		},
	},
	"/projects/mc-router": {
		Dir: true,
		Children: []terminalEntry{{Name: "README.md", Kind: "file"}},
	},
	"/projects/mc-router/README.md": {
		Lines: []string{
			"mc-router",
			"Protocol-aware network edge engineering for independent Minecraft workloads.",
			"Routing, monitoring, lifecycle, and gameplay state keep explicit responsibility boundaries.",
		},
	},
	"/projects/yw1-iv-calculator": {
		Dir: true,
		Children: []terminalEntry{{Name: "README.md", Kind: "file"}},
	},
	"/projects/yw1-iv-calculator/README.md": {
		Lines: []string{
			"YW1 IV Calculator",
			"A web application for reasoning about Yo-kai Watch 1 individual-value and training outcomes.",
		},
	},
	"/infrastructure": {
		Dir: true,
		Children: []terminalEntry{{Name: "home-kubernetes.md", Kind: "file"}},
	},
	"/infrastructure/home-kubernetes.md": {
		Lines: []string{
			"Home Kubernetes Platform",
			"Proxmox provides the virtualization layer; Kubernetes provides the application platform.",
			"Control Plane and Worker responsibilities stay logically separated even on a single physical host.",
		},
	},
	"/about": {
		Dir: true,
		Children: []terminalEntry{{Name: "profile.md", Kind: "file"}},
	},
	"/about/profile.md": {
		Lines: []string{
			"Alec",
			"Backend / Infrastructure / Systems Engineering",
			"Builds software as complete systems, through the infrastructure that runs them.",
		},
	},
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

	registerRuntimeHandlers(mux)

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

		writeJSON(w, http.StatusOK, runTerminalCommand(command, request.CWD))
	})

	mux.Handle("/", http.FileServer(http.Dir(frontendDir)))
	return securityHeaders(mux)
}

func runTerminalCommand(command, requestedCWD string) terminalResponse {
	cwd := validCWD(requestedCWD)
	fields := strings.Fields(command)
	response := terminalResponse{Command: command, CWD: cwd, Lines: []string{}, ExitCode: 0}
	if len(fields) == 0 {
		return response
	}

	name := strings.ToLower(fields[0])

	switch name {
	case "help":
		response.Lines = []string{
			"fish-like portfolio commands:",
			"  fastfetch       portfolio/system summary",
			"  whoami          engineering identity",
			"  projects        featured systems",
			"  stack           current portfolio stack",
			"  trace --system  trace the running system from public edge to physical host",
			"  runtime         live Go process / release / deployment snapshot",
			"  health          backend health/runtime",
			"  pwd             print virtual portfolio path",
			"  ls [path]       list virtual portfolio entries",
			"  cd [path]       move through portfolio layers",
			"  cat <file>      read a portfolio document",
			"  github          GitHub profile",
			"  clear           clear this terminal",
			"  exit            close this terminal",
			"  help            show this list",
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
			"Shell:            fish-inspired virtual portfolio shell",
			"Terminal:         Ghostty-inspired / Noto Sans Mono CJK JP",
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
	case "trace":
		response.Lines, response.ExitCode = runTraceCommand(fields)
	case "runtime":
		response.Lines = runtimeCommandLines()
	case "health":
		response.Lines = []string{"portfolio-backend: healthy", "runtime: " + runtime.Version()}
	case "pwd":
		response.Lines = []string{displayVirtualPath(cwd)}
	case "ls":
		target := cwd
		if len(fields) > 1 {
			target = normalizeVirtualPath(cwd, fields[1])
		}
		node, ok := portfolioFS[target]
		if !ok {
			response.ExitCode = 2
			response.Lines = []string{"ls: " + fields[len(fields)-1] + ": No such file or directory"}
			break
		}
		if !node.Dir {
			response.Entries = []terminalEntry{{Name: pathpkg.Base(target), Kind: "file"}}
			break
		}
		response.Entries = node.Children
	case "cd":
		target := "/"
		if len(fields) > 1 {
			target = normalizeVirtualPath(cwd, fields[1])
		}
		node, ok := portfolioFS[target]
		if !ok {
			response.ExitCode = 1
			response.Lines = []string{"cd: " + fields[len(fields)-1] + ": No such file or directory"}
			break
		}
		if !node.Dir {
			response.ExitCode = 1
			response.Lines = []string{"cd: " + fields[len(fields)-1] + ": Not a directory"}
			break
		}
		response.CWD = target
	case "cat":
		if len(fields) < 2 {
			response.ExitCode = 1
			response.Lines = []string{"cat: missing operand"}
			break
		}
		target := normalizeVirtualPath(cwd, fields[1])
		node, ok := portfolioFS[target]
		if !ok {
			response.ExitCode = 1
			response.Lines = []string{"cat: " + fields[1] + ": No such file or directory"}
			break
		}
		if node.Dir {
			response.ExitCode = 1
			response.Lines = []string{"cat: " + fields[1] + ": Is a directory"}
			break
		}
		response.Lines = node.Lines
	case "github":
		response.Lines = []string{"https://github.com/AlexanderGG-0520"}
	case "clear":
		response.Clear = true
	case "exit":
		response.Close = true
	default:
		response.ExitCode = 127
		response.Lines = []string{name + ": command not found", "fish: type `help` to list portfolio commands"}
	}

	return response
}

func runTraceCommand(fields []string) ([]string, int) {
	usage := []string{
		"usage: trace --system",
		"       trace --help",
	}

	if len(fields) == 1 {
		return usage, 0
	}
	if len(fields) != 2 {
		return append([]string{"trace: expected one target"}, usage...), 2
	}

	switch strings.ToLower(fields[1]) {
	case "--help", "-h":
		return append([]string{
			"trace the portfolio's running system through its responsibility boundaries",
			"",
		}, usage...), 0
	case "--system":
		return []string{
			"trace: ~/portfolio/system",
			"",
			"PUBLIC",
			"Internet",
			"├─ web        → Portfolio / Astro ↔ Go API",
			"└─ minecraft  → mc-router → Minecraft workloads",
			"                             └─ Minecartainer / stateful runtime",
			"",
			"                    ↓ platform boundary",
			"",
			"PLATFORM",
			"Kubernetes",
			"├─ Cilium     network",
			"├─ Longhorn   storage",
			"├─ Argo CD    delivery",
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
			"  edge      routing / protocol",
			"  runtime   persistent workload lifecycle",
			"  platform  reconciliation / network / storage / delivery",
			"  vm        control-plane and worker lifecycle separation",
			"  physical  current single-host failure domain",
			"",
			"trace complete",
			"hint: cd architecture && ls",
		}, 0
	default:
		return append([]string{"trace: unsupported target: " + fields[1]}, usage...), 2
	}
}

func validCWD(requested string) string {
	if requested == "" {
		return "/"
	}
	cleaned := normalizeVirtualPath("/", requested)
	node, ok := portfolioFS[cleaned]
	if !ok || !node.Dir {
		return "/"
	}
	return cleaned
}

func normalizeVirtualPath(cwd, target string) string {
	target = strings.TrimSpace(target)
	if target == "" || target == "~" || target == "~/portfolio" {
		return "/"
	}
	if strings.HasPrefix(target, "~/portfolio/") {
		target = "/" + strings.TrimPrefix(target, "~/portfolio/")
	}

	var cleaned string
	if strings.HasPrefix(target, "/") {
		cleaned = pathpkg.Clean(target)
	} else {
		cleaned = pathpkg.Clean(pathpkg.Join(cwd, target))
	}
	if cleaned == "." {
		return "/"
	}
	if !strings.HasPrefix(cleaned, "/") {
		cleaned = "/" + cleaned
	}
	return cleaned
}

func displayVirtualPath(cwd string) string {
	if cwd == "/" {
		return "~/portfolio"
	}
	return "~/portfolio" + cwd
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
