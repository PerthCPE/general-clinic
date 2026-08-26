package ws

import (
	"encoding/json"
	"log"
	"sync"
)

// WSEvent defines the payload format sent over WebSocket
type WSEvent struct {
	Type      string      `json:"type"`
	Timestamp int64       `json:"timestamp"`
	Data      interface{} `json:"data,omitempty"`
}

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

// GlobalHub is the singleton instance for broadcasting across all controllers
var GlobalHub *Hub

func init() {
	GlobalHub = NewHub()
}

func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

func (h *Hub) Run() {
	log.Println("WebSocket Hub started and listening for client events...")
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("WebSocket: Client connected (Total active: %d)", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("WebSocket: Client disconnected (Total active: %d)", len(h.clients))

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// BroadcastEvent sends a structured real-time event to all connected clients
func BroadcastEvent(eventType string, data interface{}) {
	if GlobalHub == nil {
		return
	}

	event := WSEvent{
		Type:      eventType,
		Timestamp: 0, // can be time.Now().Unix()
		Data:      data,
	}

	jsonBytes, err := json.Marshal(event)
	if err != nil {
		log.Printf("Error marshaling WS event [%s]: %v", eventType, err)
		return
	}

	GlobalHub.broadcast <- jsonBytes
}
