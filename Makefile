.PHONY: install build dev test

install:
	npm --prefix frontend ci --no-audit --no-fund

build:
	npm --prefix frontend run build

dev: build
	cd backend && go run ./cmd/server -frontend ../frontend/dist

test:
	cd backend && go test ./...
	npm --prefix frontend run build
