package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
)

type OllamaServer struct {
	router *mux.Router
}

func NewOllamaServer() *OllamaServer {
	s := &OllamaServer{
		router: mux.NewRouter(),
	}

	s.setupRoutes()
	return s
}

func (s *OllamaServer) setupRoutes() {
	s.router.HandleFunc("/generate", s.handleGenerate).Methods("POST")
	s.router.HandleFunc("/models", s.handleListModels).Methods("GET")
}

type GenerateRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
}

func (s *OllamaServer) handleGenerate(w http.ResponseWriter, r *http.Request) {
	var req GenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Call Ollama's local API
	client := &http.Client{}
	ollamaReq := map[string]interface{}{
		"model":  req.Model,
		"prompt": req.Prompt,
	}

	reqBody, err := json.Marshal(ollamaReq)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to marshal request: %v", err), http.StatusInternalServerError)
		return
	}

	resp, err := client.Post("http://localhost:11434/api/generate", "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to call Ollama: %v", err), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	// Stream response back to client
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	io.Copy(w, resp.Body)
}

func (s *OllamaServer) handleListModels(w http.ResponseWriter, r *http.Request) {
	// Call Ollama's local API to list models
	client := &http.Client{}
	resp, err := client.Get("http://localhost:11434/api/tags")
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to call Ollama: %v", err), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	// Stream response back to client
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	io.Copy(w, resp.Body)
}

func (s *OllamaServer) Run() error {
	// Start HTTP server
	srv := &http.Server{
		Addr:    ":8080",
		Handler: s.router,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("HTTP server error: %v\n", err)
		}
	}()

	// Wait for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	// Shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return srv.Shutdown(ctx)
}

func main() {
	server := NewOllamaServer()
	if err := server.Run(); err != nil {
		fmt.Printf("Server error: %v\n", err)
		os.Exit(1)
	}
}
