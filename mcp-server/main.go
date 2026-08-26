package main

import (
	"bufio"
	"clinic-mcp/tools"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
)

// ─── JSON-RPC 2.0 Types ─────────────────────────────────────────────────────

type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type JSONRPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id,omitempty"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
}

type RPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// ─── MCP Tool Call Types ─────────────────────────────────────────────────────

type ToolCallParams struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments,omitempty"`
}

type ToolCallResult struct {
	Content []ToolContent `json:"content"`
	IsError bool          `json:"isError,omitempty"`
}

type ToolContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// ─── MCP Resource Types ──────────────────────────────────────────────────────

type ResourceReadParams struct {
	URI string `json:"uri"`
}

type ResourceReadResult struct {
	Contents []ResourceContent `json:"contents"`
}

type ResourceContent struct {
	URI      string `json:"uri"`
	MimeType string `json:"mimeType"`
	Text     string `json:"text"`
}

// ─── MCP Prompt Types ────────────────────────────────────────────────────────

type PromptGetParams struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments,omitempty"`
}

// ─── MCP Logging Types ───────────────────────────────────────────────────────

type LogSetLevelParams struct {
	Level string `json:"level"`
}

// ─── Server State ────────────────────────────────────────────────────────────

var (
	logLevel    = "info"
	logLevelMu  sync.RWMutex
	outputMu    sync.Mutex
)

// Log level priorities (RFC-5424)
var logLevelPriority = map[string]int{
	"debug":     0,
	"info":      1,
	"notice":    2,
	"warning":   3,
	"error":     4,
	"critical":  5,
	"alert":     6,
	"emergency": 7,
}

func main() {
	// Redirect Go log to stderr (CRITICAL: stdout is for JSON-RPC only)
	log.SetOutput(os.Stderr)

	rootDir := ""
	for _, arg := range os.Args[1:] {
		if len(arg) > 7 && arg[:7] == "--root=" {
			rootDir = arg[7:]
		}
	}

	if rootDir == "" {
		cwd, _ := os.Getwd()
		if _, err := os.Stat(filepath.Join(cwd, "golang-backend")); err == nil {
			rootDir = cwd
		} else if _, err := os.Stat(filepath.Join(cwd, "..", "golang-backend")); err == nil {
			rootDir = filepath.Clean(filepath.Join(cwd, ".."))
		} else {
			rootDir = "Z:\\general-clinic"
		}
	}

	registry := tools.NewToolRegistry(rootDir)
	if err := registry.Refresh(); err != nil {
		log.Printf("Warning: initial refresh failed: %v", err)
	}

	scanner := bufio.NewScanner(os.Stdin)
	buf := make([]byte, 1024*1024)
	scanner.Buffer(buf, 10*1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var req JSONRPCRequest
		if err := json.Unmarshal(line, &req); err != nil {
			sendError(nil, -32700, "Parse error: "+err.Error(), os.Stdout)
			continue
		}

		handleRequest(req, registry, os.Stdout)
	}

	if err := scanner.Err(); err != nil && err != io.EOF {
		log.Printf("Scanner error: %v", err)
	}
}

func handleRequest(req JSONRPCRequest, registry *tools.ToolRegistry, out io.Writer) {
	switch req.Method {

	// ─── Lifecycle ───────────────────────────────────────────────────────────
	case "initialize":
		res := map[string]interface{}{
			"protocolVersion": "2024-11-05",
			"capabilities": map[string]interface{}{
				"tools":     map[string]interface{}{"listChanged": true},
				"resources": map[string]interface{}{"subscribe": false, "listChanged": true},
				"prompts":   map[string]interface{}{"listChanged": true},
				"logging":   map[string]interface{}{},
			},
			"serverInfo": map[string]interface{}{
				"name":    "general-clinic-mcp",
				"version": "2.0.0",
			},
			"instructions": "This is the General Clinic Management System MCP server. " +
				"It provides deep introspection into a full-stack clinic application " +
				"(Go/Gin/GORM backend + React/TypeScript frontend + PostgreSQL via Supabase). " +
				"Use 'clinic_get_project_summary' for architecture overview, " +
				"'clinic_get_schema' for database models, " +
				"'clinic_trace_feature' for end-to-end feature tracing, " +
				"'clinic_diagnose_error' for error analysis, " +
				"and 'clinic_check_api_health' to verify backend status. " +
				"Resources provide direct file access to schema, routes, and configuration. " +
				"Prompts offer reusable templates for common clinical development workflows.",
		}
		sendResult(req.ID, res, out)
		sendLogMessage("info", "server", "MCP server initialized (v2.0.0)", out)

	case "notifications/initialized":
		// No response required for notifications
		log.Println("Client acknowledged initialization")

	case "notifications/cancelled":
		// Acknowledge cancellation — log to stderr
		var params struct {
			RequestID interface{} `json:"requestId"`
			Reason    string      `json:"reason"`
		}
		if req.Params != nil {
			_ = json.Unmarshal(req.Params, &params)
		}
		log.Printf("Request cancelled: id=%v reason=%s", params.RequestID, params.Reason)

	case "ping":
		sendResult(req.ID, map[string]interface{}{}, out)

	// ─── Tools ───────────────────────────────────────────────────────────────
	case "tools/list":
		toolDefs := registry.GetToolDefinitions()
		res := map[string]interface{}{
			"tools": toolDefs,
		}
		sendResult(req.ID, res, out)

	case "tools/call":
		var params ToolCallParams
		if err := json.Unmarshal(req.Params, &params); err != nil {
			sendError(req.ID, -32602, "Invalid params: "+err.Error(), out)
			return
		}

		sendLogMessage("info", "tools", fmt.Sprintf("Executing tool: %s", params.Name), out)

		output, err := registry.ExecuteTool(params.Name, params.Arguments)
		if err != nil {
			sendLogMessage("error", "tools", fmt.Sprintf("Tool %s failed: %v", params.Name, err), out)
			result := ToolCallResult{
				Content: []ToolContent{
					{Type: "text", Text: fmt.Sprintf("Error executing tool %s: %v", params.Name, err)},
				},
				IsError: true,
			}
			sendResult(req.ID, result, out)
			return
		}

		sendLogMessage("info", "tools", fmt.Sprintf("Tool %s completed successfully", params.Name), out)
		result := ToolCallResult{
			Content: []ToolContent{
				{Type: "text", Text: output},
			},
			IsError: false,
		}
		sendResult(req.ID, result, out)

	// ─── Resources ───────────────────────────────────────────────────────────
	case "resources/list":
		resources := registry.GetResources()
		sendResult(req.ID, map[string]interface{}{
			"resources": resources,
		}, out)

	case "resources/templates/list":
		templates := registry.GetResourceTemplates()
		sendResult(req.ID, map[string]interface{}{
			"resourceTemplates": templates,
		}, out)

	case "resources/read":
		var params ResourceReadParams
		if err := json.Unmarshal(req.Params, &params); err != nil {
			sendError(req.ID, -32602, "Invalid params: "+err.Error(), out)
			return
		}

		content, mimeType, err := registry.ReadResource(params.URI)
		if err != nil {
			sendError(req.ID, -32602, fmt.Sprintf("Resource not found: %s", params.URI), out)
			return
		}

		sendResult(req.ID, ResourceReadResult{
			Contents: []ResourceContent{
				{URI: params.URI, MimeType: mimeType, Text: content},
			},
		}, out)

	// ─── Prompts ─────────────────────────────────────────────────────────────
	case "prompts/list":
		prompts := registry.GetPrompts()
		sendResult(req.ID, map[string]interface{}{
			"prompts": prompts,
		}, out)

	case "prompts/get":
		var params PromptGetParams
		if err := json.Unmarshal(req.Params, &params); err != nil {
			sendError(req.ID, -32602, "Invalid params: "+err.Error(), out)
			return
		}

		result, err := registry.GetPrompt(params.Name, params.Arguments)
		if err != nil {
			sendError(req.ID, -32602, err.Error(), out)
			return
		}

		sendResult(req.ID, result, out)

	// ─── Logging ─────────────────────────────────────────────────────────────
	case "logging/setLevel":
		var params LogSetLevelParams
		if err := json.Unmarshal(req.Params, &params); err != nil {
			sendError(req.ID, -32602, "Invalid params: "+err.Error(), out)
			return
		}

		if _, valid := logLevelPriority[params.Level]; !valid {
			sendError(req.ID, -32602, fmt.Sprintf("Invalid log level: %s", params.Level), out)
			return
		}

		logLevelMu.Lock()
		logLevel = params.Level
		logLevelMu.Unlock()

		sendResult(req.ID, map[string]interface{}{}, out)
		log.Printf("Log level set to: %s", params.Level)

	// ─── Unknown ─────────────────────────────────────────────────────────────
	default:
		if req.ID != nil {
			sendError(req.ID, -32601, fmt.Sprintf("Method not found: %s", req.Method), out)
		}
	}
}

// ─── JSON-RPC Output Helpers ─────────────────────────────────────────────────

func sendResult(id interface{}, result interface{}, out io.Writer) {
	if id == nil {
		return
	}
	outputMu.Lock()
	defer outputMu.Unlock()

	resp := JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Result:  result,
	}
	data, _ := json.Marshal(resp)
	fmt.Fprintf(out, "%s\n", string(data))
}

func sendError(id interface{}, code int, message string, out io.Writer) {
	if id == nil {
		return
	}
	outputMu.Lock()
	defer outputMu.Unlock()

	resp := JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error: &RPCError{
			Code:    code,
			Message: message,
		},
	}
	data, _ := json.Marshal(resp)
	fmt.Fprintf(out, "%s\n", string(data))
}

// sendNotification sends a JSON-RPC notification (no id, no response expected)
func sendNotification(method string, params interface{}, out io.Writer) {
	outputMu.Lock()
	defer outputMu.Unlock()

	msg := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  method,
		"params":  params,
	}
	data, _ := json.Marshal(msg)
	fmt.Fprintf(out, "%s\n", string(data))
}

// sendLogMessage sends a notifications/message log entry (RFC-5424 severity)
func sendLogMessage(level, logger, message string, out io.Writer) {
	logLevelMu.RLock()
	currentLevel := logLevel
	logLevelMu.RUnlock()

	// Only send if the message level >= configured level
	if logLevelPriority[level] < logLevelPriority[currentLevel] {
		return
	}

	sendNotification("notifications/message", map[string]interface{}{
		"level":  level,
		"logger": logger,
		"data":   message,
	}, out)
}
