# Avatar Platform: Chat API Documentation

This document outlines the API endpoints used for conversation, session management, and Human-in-the-Loop (HIL) interactions.

**Base URL**: `https://avatarinput.onrender.com/api/chat`

---

## 1. Session Management

### Start Session
Starts a new conversation session and generates a unique ID.
- **Endpoint**: `POST /session/start`
- **Body**:
  ```json
  { "avatarId": "string" }
  ```
- **Response**:
  ```json
  { "success": true, "sessionId": "uuid" }
  ```

### End Session
Ends the active session for an avatar.
- **Endpoint**: `POST /session/end`
- **Body**:
  ```json
  { "avatarId": "string" }
  ```
- **Response**:
  ```json
  { "success": true, "message": "Session ended" }
  ```

---

## 2. Core Conversation

### Generate Response (The Brain)
Generates an AI response based on the avatar's personality, recent history, and current visual context.
- **Endpoint**: `POST /generate`
- **Body**:
  ```json
  {
    "avatarId": "string",
    "sessionId": "string",
    "text": "User's spoken text",
    "visualContext": "Optional: Description of current camera view"
  }
  ```
- **Response**:
  ```json
  { "success": true, "response": "Avatar's generated reply" }
  ```

### Log History
Manually add a text entry to the avatar's memory without generating a response.
- **Endpoint**: `POST /history`
- **Body**:
  ```json
  {
    "avatarId": "string",
    "sessionId": "string",
    "role": "user | avatar",
    "content": "Message content"
  }
  ```

---

## 3. Human-in-the-Loop (HIL)
This is a two-step process where a human operator can guide the avatar's response.

### Step 1: Request Guided Response
The client calls this and waits (hangs) for an operator's input.
- **Endpoint**: `POST /generate_with_human`
- **Body**:
  ```json
  {
    "avatarId": "string",
    "sessionId": "string",
    "text": "User's query",
    "visualContext": "Optional context",
    "intervention": 1.0
  }
  ```
- **Behavior**: This connection stays open (Content-Type: `text/plain`) until Step 2 is called.

### Step 2: Operator Input
The operator sends what they want the avatar to say. This triggers the rewriting and streaming back to the Step 1 connection.
- **Endpoint**: `POST /human_response`
- **Body**:
  ```json
  {
    "sessionId": "string",
    "humanResponse": "The core message the operator wants to convey"
  }
  ```
- **Response**: Immediately returns success to the operator. The rewritten/styled response is streamed to the user via the `generate_with_human` connection.

---
