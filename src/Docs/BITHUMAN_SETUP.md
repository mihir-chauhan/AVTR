# BitHuman Avatar Setup

This project uses **bitHuman** for realistic avatar rendering with the LiveKit Agents framework.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  LiveKit    │────▶│   Agent     │────▶│  bitHuman   │
│  (Frontend) │◀────│   Cloud     │◀────│  (Python)   │◀────│   Avatar    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                              │
                         ┌────────────────────┼────────────────────┐
                         │                    │                    │
                         ▼                    ▼                    ▼
                   ┌──────────┐        ┌──────────┐        ┌──────────┐
                   │ Deepgram │        │  Claude  │        │ Deepgram │
                   │   STT    │        │   LLM    │        │   TTS    │
                   └──────────┘        └──────────┘        └──────────┘
```

## Components

| Component | Provider | Purpose |
|-----------|----------|---------|
| **STT** | Deepgram | Converts your speech to text |
| **LLM** | Claude (Anthropic) | Generates intelligent responses |
| **TTS** | Deepgram | Converts response to speech audio |
| **Avatar** | bitHuman | Renders realistic video of avatar speaking |
| **Transport** | LiveKit | Real-time audio/video streaming |

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Start the Web Server

```bash
python app.py
```

This starts the web interface at http://localhost:8000

### 3. Start the Agent (in a separate terminal)

```bash
python agent.py dev
```

This starts the LiveKit agent that handles the avatar pipeline.

### 4. Connect

Open http://localhost:8000 in your browser and click "Start Conversation"!

## Configuration

All credentials are in `config.py`:

```python
# BitHuman
BITHUMAN_API_SECRET = "your-key"
BITHUMAN_AVATAR_ID = "A18GMR3664"  # Your character ID

# Deepgram (STT + TTS)
DEEPGRAM_API_KEY = "your-key"

# Anthropic (LLM)
ANTHROPIC_API_KEY = "your-key"

# LiveKit
LIVEKIT_URL = "wss://your-project.livekit.cloud"
LIVEKIT_API_KEY = "your-key"
LIVEKIT_API_SECRET = "your-secret"
```

## Files

| File | Purpose |
|------|---------|
| `agent.py` | LiveKit Agent with bitHuman avatar pipeline |
| `app.py` | Web server for frontend and token generation |
| `config.py` | All API credentials and settings |
| `static/index.html` | Browser frontend |
| `requirements.txt` | Python dependencies |

## Avatar Character

Using bitHuman character: **A18GMR3664**
- High fidelity mode with dynamic expressions
- Model type: `expression` (provides emotional responses)

## How It Works

1. **You speak** → Your audio is sent to LiveKit room
2. **Deepgram STT** → Converts your speech to text
3. **Claude LLM** → Generates a thoughtful response
4. **Deepgram TTS** → Converts response to audio
5. **bitHuman** → Renders the avatar speaking with lip-sync
6. **LiveKit** → Streams avatar video back to your browser

All of this happens in real-time with low latency!
