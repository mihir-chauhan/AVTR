# BitHuman Avatar Agent - Architecture & Implementation Guide

## Project Goal
Build a **unified avatar agent** that supports two modes with **seamless live switching**:
1. **AI Mode**: User speaks → Avatar responds as AI (Einstein personality)
2. **Human Mode**: User speaks → Avatar lip-syncs user's voice directly (digital puppet)

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED PIPELINE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Mic ──┬── [STT] ── [LLM] ── [TTS] ───┐                               │
│  (Browser)  │                               │                               │
│             │   ▲ TRANSPARENT               │                               │
│             │   (bypassed in Human Mode)    │                               │
│             │                               │                               │
│             └──────────────────────────────►├──► Audio Router               │
│                                             │         │                     │
│                                             │         ▼                     │
│                                             │    BitHuman SDK               │
│                                             │    (lip-sync engine)          │
│                                             │         │                     │
│                                             │         ▼                     │
│                                             │    Video Frames               │
│                                             │         │                     │
│                                             │         ▼                     │
│                                             │    LiveKit Stream             │
│                                             │    (WebRTC to browser)        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Mode Behavior

### AI Mode (Agent)
```
User speaks → GPT-4o Realtime (STT+LLM) → Deepgram TTS → BitHuman → Avatar video
User types  → GPT-4o (LLM only)         → Deepgram TTS → BitHuman → Avatar video
```
- Full AI pipeline active
- Avatar responds with Einstein personality
- TTS audio drives avatar lip-sync

### Human Mode (Puppet)
```
User speaks → [BYPASS ALL] → BitHuman directly → Avatar video
```
- STT, LLM, TTS layers are TRANSPARENT (bypassed)
- User's raw mic audio goes directly to BitHuman
- Avatar lip-syncs to user's actual voice
- User "becomes" the avatar

## Key Technical Decisions

### Decision 1: LiveKit Plugin vs Standalone SDK

| Aspect | LiveKit Plugin (`bithuman.AvatarSession`) | Standalone SDK (`AsyncBithuman`) |
|--------|-------------------------------------------|----------------------------------|
| Avatar source | `avatar_id` (cloud) | `model_path` (.imx file, local) |
| Audio input | Receives from `AgentSession` TTS | Direct `push_audio()` method |
| Video output | Automatic via LiveKit | Manual frame capture |
| Human mode | ❌ Cannot push raw mic audio | ✅ Can push any audio |
| AI mode | ✅ Integrated with AgentSession | ✅ But need manual TTS routing |

**CRITICAL FINDING**:
- For `avatar_id` (cloud mode), you MUST use the LiveKit plugin
- The plugin sends audio via `DataStreamAudioOutput` to a remote BitHuman agent
- The remote agent processes audio and returns video
- In theory, we can send EITHER TTS audio OR mic audio through this channel

### Decision 2: Audio Routing Strategy

The LiveKit BitHuman plugin sets:
```python
agent_session.output.audio = DataStreamAudioOutput(...)
```

Our strategy: **Intercept and route**
```python
# After avatar.start():
original_output = agent_session.output.audio  # DataStreamAudioOutput
router = AudioRouter()
router.set_destination(original_output)
agent_session.output.audio = router  # Our router

# Router forwards based on mode:
# - AI Mode: forward TTS frames from AgentSession
# - Human Mode: forward mic frames from participant
```

## Current Codebase Structure

```
/Users/davidchen/nexhacks/
├── agent.py          # Main agent (currently has split AI/Human modes)
├── app.py            # FastAPI server (token endpoint, agent dispatch)
├── config.py         # API keys (BitHuman, Deepgram, OpenAI, LiveKit)
├── static/
│   └── index.html    # Frontend UI with mode toggle
└── requirements.txt  # Dependencies
```

## Current Implementation Issues

### Issue 1: Split Architecture
The current `agent.py` has TWO SEPARATE entrypoints:
- `ai_mode_entrypoint()` - Uses LiveKit plugin
- `human_mode_entrypoint()` - Uses standalone SDK

This prevents live mode switching because they're completely different code paths.

### Issue 2: Human Mode Uses Wrong SDK
Human mode currently uses `AsyncBithuman` with `model_path`, but we want `avatar_id` (cloud mode).

### Issue 3: No Text Input Support
AI mode doesn't handle text input from the frontend for testing.

### Issue 4: No Live Mode Switching
Mode is determined at room join time. Cannot switch mid-session.

## Required Implementation

### 1. Unified Agent Class
```python
class UnifiedAvatarAgent:
    def __init__(self, ctx: JobContext):
        self._mode = AgentMode.AI
        self._router = AudioRouter()
        self._session: AgentSession = None

    async def start(self):
        # Create AgentSession with GPT-4o + Deepgram TTS
        self._session = AgentSession(
            llm=openai.realtime.RealtimeModel(modalities=["text"]),
            tts=deepgram.TTS(sample_rate=24000),
        )

        # Create BitHuman avatar (cloud mode)
        avatar = bithuman.AvatarSession(avatar_id=AVATAR_ID)
        await avatar.start(self._session, room=self._ctx.room)

        # Intercept audio output
        self._router.set_destination(self._session.output.audio)
        self._session.output.audio = self._router

        # Start session
        await self._session.start(agent, room=self._ctx.room)

        # Start mic passthrough loop (always running, only forwards in HUMAN mode)
        self._mic_task = asyncio.create_task(self._mic_loop())

        # Listen for data channel commands
        self._setup_data_listener()
```

### 2. Audio Router
```python
class AudioRouter:
    def __init__(self):
        self._mode = AgentMode.AI
        self._destination = None  # DataStreamAudioOutput

    async def capture_frame(self, frame):
        """Called by TTS - only forward in AI mode"""
        if self._mode == AgentMode.AI:
            await self._destination.capture_frame(frame)

    async def send_mic_frame(self, frame):
        """Called by mic loop - only forward in HUMAN mode"""
        if self._mode == AgentMode.HUMAN:
            await self._destination.capture_frame(frame)
```

### 3. Mic Passthrough Loop
```python
async def _mic_loop(self, track):
    stream = rtc.AudioStream(track, sample_rate=24000, num_channels=1)
    async for event in stream:
        await self._router.send_mic_frame(event.frame)
```

### 4. Data Channel Protocol
```python
# Frontend -> Agent
{"type": "mode_switch", "mode": "human"}
{"type": "text_input", "text": "Hello Einstein"}

# Agent -> Frontend
{"type": "mode_changed", "mode": "human"}
```

### 5. Text Input Handler
```python
async def _handle_text(self, text):
    if self._mode != AgentMode.AI:
        return
    # Generate AI response to text input
    await self._session.generate_reply(user_input=text)
```

## API Keys Required (in config.py)
- `BITHUMAN_API_SECRET` - BitHuman authentication
- `BITHUMAN_AVATAR_ID` - Avatar identifier (e.g., "A02BPM5716")
- `DEEPGRAM_API_KEY` - TTS
- `OPENAI_API_KEY` - GPT-4o Realtime
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` - LiveKit cloud

## Documentation References
- LiveKit BitHuman Plugin: https://docs.livekit.io/agents/integrations/avatar/bithuman/
- BitHuman SDK Docs: https://docs.bithuman.ai/
- Mic-to-Avatar Example: https://docs.bithuman.ai/#/examples/avatar-with-microphone
- Example Source Code: https://github.com/bithuman-prod/public-docs/blob/main/examples/avatar-with-microphone.py

## LiveKit Plugin Source (for reference)
The BitHuman plugin source is at:
`/opt/anaconda3/lib/python3.13/site-packages/livekit/plugins/bithuman/avatar.py`

Key methods:
- `AvatarSession.start()` - Sets up `DataStreamAudioOutput` for cloud mode
- `DataStreamAudioOutput.capture_frame(frame)` - Sends audio to remote BitHuman agent

## Testing Checklist

### AI Mode
- [ ] Greeting plays on connect
- [ ] Speaking triggers AI response
- [ ] Text input triggers AI response
- [ ] Avatar lip-syncs to TTS audio

### Human Mode
- [ ] Mic audio passes through to avatar
- [ ] Avatar lip-syncs to user's voice
- [ ] No AI responses generated

### Mode Switching
- [ ] Can switch AI → Human mid-session
- [ ] Can switch Human → AI mid-session
- [ ] No reconnection required
- [ ] UI updates reflect current mode

## Run Commands
```bash
# Terminal 1: Web server
python app.py

# Terminal 2: Agent
python agent.py dev

# Browser
http://localhost:8000
```
