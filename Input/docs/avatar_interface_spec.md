# Avatar Interface Specification

## Overview
This document describes the interface between the **Input Processing Pipeline** (this project) and the **Real-time Avatar System**. The pipeline consumes daily video/audio logs and produces a structured "Memory & Style" database.

## Data Schema (`db.json`)

The output is stored as a collection of sessions. Each session contains:

```json
{
  "sessionId": "uuid",
  "date": "ISO8601",
  "personalityProfile": {
    "traits": ["string"],
    "commonPhrases": ["string"],
    "fillerWordFrequency": 0.5,
    "speechRate": "Moderate",
    "dialect": "General American"
  },
  "transcript": [
    {
      "timestamp": "ISO8601",
      "text": "Extracted speech text...",
      "fillerWords": ["um", "like"]
    }
  ],
  "visualContext": [
     {
       "timestamp": "ISO8601",
       "description": "User is sitting at a desk typing..."
     }
  ]
}
```

## Integration Strategy

### 1. Style Loading (Initialization)
When the Avatar system initializes for a specific user:
1.  Query the latest `personalityProfile`.
2.  **System Prompting**: Inject the `traits`, `dialect`, and `speechRate` into the LLM system prompt responsible for generating Avatar dialogue.
3.  **Synthesizer Config**: Use `fillerWordFrequency` to adjust the Text-to-Speech (TTS) settings (or insert "um"s into the LLM stream).

### 2. RAG / Memory Retrieval (During Conversation)
When the user asks "What did you do today?" or similar:
1.  The Avatar System queries the `visualContext` and `transcript` from the *Input Pipeline's* output.
2.  **Search**: Use vector similarity on `visualContext.description` and `transcript.text`.
3.  **Context Construction**: Retrieve the relevant segments and feed them to the Avatar LLM.
    *   *Input*: "What were you doing at 2 PM?"
    *   *Context*: `[14:00] User is walking the dog. [14:01] User talks to neighbor about the weather.`
    *   *Response*: "I was walking the dog and chatted with the neighbor about how sunny it is."

### 3. Gesture Synchronization
The `visualContext` provides timestamps for actions.
*   **Training**: Future iterations can train a movement model on `(transcript_segment, visual_action)` pairs.
*   **Runtime**: IF the Avatar LLM decides to say a phrase found in `commonPhrases`, it can trigger the associated gesture observed in the logs.

## API Endpoints (Future)
We recommend exposing this data via a REST API:
*   `GET /api/profile/{userId}/latest` -> Returns merged personality profile.
*   `GET /api/memory/search?q=...` -> Returns relevant context chunks.
