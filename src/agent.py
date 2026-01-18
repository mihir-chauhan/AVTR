"""
BitHuman Unified Avatar Agent
=============================
Single agent supporting seamless live switching between:
- AI Mode: GPT-4o STT+LLM -> Deepgram TTS -> BitHuman avatar
- Human Mode: Deepgram STT -> Deepgram TTS -> BitHuman (LLM bypassed)

Run with: python agent.py dev
"""

import os
import json
import logging
import asyncio
import time
from enum import Enum
from dotenv import load_dotenv

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    Agent,
    AgentSession,
)
from livekit.agents.stt import SpeechEventType
from livekit import rtc
from livekit.plugins import openai, deepgram, bithuman

load_dotenv()
import config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("unified-agent")

# =============================================================================
# Configuration
# =============================================================================
BITHUMAN_API_SECRET = os.getenv("BITHUMAN_API_SECRET", config.BITHUMAN_API_SECRET)
BITHUMAN_AVATAR_ID = os.getenv("BITHUMAN_AVATAR_ID", config.BITHUMAN_AVATAR_ID)
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", config.DEEPGRAM_API_KEY)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", config.OPENAI_API_KEY)
LIVEKIT_URL = os.getenv("LIVEKIT_URL", config.LIVEKIT_URL)
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", config.LIVEKIT_API_KEY)
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", config.LIVEKIT_API_SECRET)
API_AVATAR_ID = "d34498af-061e-4c40-b02a-620530081ba9"

os.environ["BITHUMAN_API_SECRET"] = BITHUMAN_API_SECRET
os.environ["DEEPGRAM_API_KEY"] = DEEPGRAM_API_KEY
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY
os.environ["LIVEKIT_URL"] = LIVEKIT_URL
os.environ["LIVEKIT_API_KEY"] = LIVEKIT_API_KEY
os.environ["LIVEKIT_API_SECRET"] = LIVEKIT_API_SECRET


class AgentMode(Enum):
    AI = "ai"
    HUMAN = "human"


# =============================================================================
# UnifiedAvatarAgent - Single agent supporting both modes
# =============================================================================
class UnifiedAvatarAgent:
    API_BASE_URL = "https://avatarinput.onrender.com/api/chat"

    def __init__(self, ctx: JobContext):
        self._ctx = ctx
        self._mode = AgentMode.AI
        self._session: AgentSession = None
        self._avatar = None
        self._participant = None
        self._running = True
        self._api_session_id = None
        self._latest_vision_context = ""
        self._stt_task = None

    async def start(self):
        """Initialize and start the unified agent"""
        start_time = time.time()

        # Connect to room
        await self._ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        self._setup_room_monitors()

        self._participant = await self._ctx.wait_for_participant()
        logger.info(f"⏱️ INIT: Agent startup took {(time.time() - start_time)*1000:.1f}ms")

        # Start API Session
        await self._start_api_session()

        # Create Agent with JUST TTS (no LLM, we drive it manually)
        self._session = AgentSession(
            tts=deepgram.TTS(model="aura-angus-en"),
        )

        # Create BitHuman avatar
        self._avatar = bithuman.AvatarSession(
            avatar_id=BITHUMAN_AVATAR_ID,
        )

        # Start avatar
        avatar_start = time.time()
        try:
            await self._avatar.start(self._session, room=self._ctx.room)
            logger.info(f"⏱️ INIT: Avatar start took {(time.time() - avatar_start)*1000:.1f}ms")
        except Exception as e:
            logger.error(f"❌ BitHuman avatar failed to start: {e}")
            return

        # Start the session
        session_start = time.time()
        try:
            # We pass a distinct Agent, but logic is driven by us
            await self._session.start(Agent(instructions=""), room=self._ctx.room)
            logger.info(f"⏱️ INIT: Session start took {(time.time() - session_start)*1000:.1f}ms")
        except Exception as e:
            logger.error(f"❌ Agent session failed to start: {e}")
            return

        self._setup_data_listener()
        logger.info(f"⏱️ INIT: Total initialization took {(time.time() - start_time)*1000:.1f}ms")

        # Initial Greeting
        if self._mode == AgentMode.AI:
            await self._session.say("Hello! I am ready to chat.", allow_interruptions=True)

        # Start the Main Interaction Loop (STT -> Logic -> TTS)
        self._stt_task = asyncio.create_task(self._main_interaction_loop())

        # Keep running
        while self._running and self._ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
            await asyncio.sleep(1)

        await self._cleanup()

    async def _start_api_session(self):
        """Start a session with the external API"""
        import requests
        try:
            payload = {"avatarId": API_AVATAR_ID}
            response = requests.post(f"{self.API_BASE_URL}/session/start", json=payload, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self._api_session_id = data.get("sessionId")
                    logger.info(f"✅ API Session Started: {self._api_session_id}")
                else:
                    logger.error(f"❌ API Session failed: {data}")
            else:
                logger.error(f"❌ API Error: {response.text}")
        except Exception as e:
            logger.error(f"❌ Failed to start API session: {e}")

    async def _generate_response(self, text: str) -> str:
        """Generate response from external API"""
        import requests
        if not self._api_session_id:
            logger.warning("⚠️ No API Session ID, skipping generation")
            return "I am having trouble connecting to my brain."
        
        try:
            payload = {
                "avatarId": API_AVATAR_ID,
                "sessionId": self._api_session_id,
                "text": text,
                "visualContext": self._latest_vision_context
            }
            logger.info(f"📤 Sending to API: {text} (Vision: {len(self._latest_vision_context)} chars)")
            
            # Use asyncio.to_thread for blocking request
            response = await asyncio.to_thread(requests.post, f"{self.API_BASE_URL}/generate", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    reply = data.get("response", "")
                    logger.info(f"📥 API Reply: {reply}")
                    return reply
                else:
                    logger.error(f"❌ API Logic failed: {data}")
                    return "I didn't quite understand that."
            else:
                logger.error(f"❌ API Request failed: {response.status_code} - {response.text}")
                return "I am experiencing a network error."
        except Exception as e:
            logger.error(f"❌ Generative error: {e}")
            return "Something went wrong processing your request."

    async def _main_interaction_loop(self):
        """
        Main loop handling:
        Audio Input -> Deepgram STT -> (Mode Logic) -> TTS Output
        """
        logger.info("🎤 Starting STT Interaction Loop")

        # Wait for audio track
        audio_track = await self._wait_for_audio_track()
        if not audio_track:
            await self._report_error("No audio track found")
            return

        # Create Deepgram STT
        try:
            stt_instance = deepgram.STT(model="nova-2")
        except Exception as e:
            await self._report_error(f"Deepgram STT init failed: {e}")
            return

        audio_stream = rtc.AudioStream(audio_track)
        stt_stream = None

        try:
            stt_stream = stt_instance.stream()

            async def push_audio():
                async for event in audio_stream:
                    if not self._running:
                        break
                    stt_stream.push_frame(event.frame)

            async def process_transcripts():
                async for event in stt_stream:
                    if not self._running:
                        break
                    
                    if hasattr(event, 'alternatives') and event.alternatives:
                        text = event.alternatives[0].text
                        if event.type == SpeechEventType.FINAL_TRANSCRIPT and text.strip():
                            text = text.strip()
                            logger.info(f"🗣️ User said: {text}")
                            
                            # Decide what to do based on mode
                            if self._mode == AgentMode.AI:
                                # AI Mode: Send to API -> Get Reply -> Speak
                                reply = await self._generate_response(text)
                                if reply:
                                    try:
                                        await self._session.say(reply, allow_interruptions=True)
                                    except Exception as e:
                                        logger.error(f"TTS Error: {e}")

                            elif self._mode == AgentMode.HUMAN:
                                # Human Mode: Echo directly -> Speak
                                try:
                                    await self._session.say(text, allow_interruptions=True)
                                except Exception as e:
                                    logger.error(f"TTS Error: {e}")

            audio_task = asyncio.create_task(push_audio())
            transcript_task = asyncio.create_task(process_transcripts())

            done, pending = await asyncio.wait(
                [audio_task, transcript_task],
                return_when=asyncio.FIRST_COMPLETED
            )
            for task in pending:
                task.cancel()

        except asyncio.CancelledError:
            pass
        except Exception as e:
            await self._report_error(f"STT Loop error: {e}")
        finally:
            if stt_stream:
                await stt_stream.aclose()
            logger.info("🎤 STT Loop ended")

    def _setup_room_monitors(self):
        """Monitor room events"""
        @self._ctx.room.on("disconnected")
        def on_disconnected(reason):
             # End logic handled by main loop check
             pass

        @self._ctx.room.on("participant_disconnected")
        def on_participant_left(participant):
            if participant.identity == self._participant.identity:
                logger.info(f"👤 User {participant.identity} disconnected, ending session")
                self._running = False
                # Also notify custom API of session end
                if self._api_session_id:
                     import requests
                     try:
                        requests.post(f"{self.API_BASE_URL}/session/end", 
                                      json={"avatarId": API_AVATAR_ID}, timeout=2)
                     except: pass

    def _setup_data_listener(self):
        """Listen for mode switch and text input via data channel"""
        @self._ctx.room.on("data_received")
        def on_data(data: rtc.DataPacket):
            try:
                payload = json.loads(data.data.decode("utf-8"))
                msg_type = payload.get("type")

                if msg_type == "mode_switch":
                    new_mode = payload.get("mode", "ai")
                    self._mode = AgentMode.HUMAN if new_mode == "human" else AgentMode.AI
                    asyncio.create_task(self._send_data({"type": "mode_changed", "mode": self._mode.value}))
                    logger.info(f"🔄 Mode switched to: {self._mode.value}")

                elif msg_type == "text_input":
                    text = payload.get("text", "")
                    if text and self._mode == AgentMode.AI:
                        asyncio.create_task(self._handle_text_input(text))
                
                elif msg_type == "vision":
                    self._latest_vision_context = payload.get("description", "")
                    # logger.info(f"👁️ Vision context updated: {self._latest_vision_context[:50]}...")

            except Exception as e:
                pass

    async def _handle_text_input(self, text: str):
        """Handle text input from frontend"""
        if self._mode == AgentMode.AI:
            reply = await self._generate_response(text)
            if reply:
                await self._session.say(reply, allow_interruptions=True)
        else:
             await self._session.say(text, allow_interruptions=True)

    async def _wait_for_audio_track(self) -> rtc.Track:
        """Wait for participant's audio track"""
        # Check existing tracks
        for pub in self._participant.track_publications.values():
            if pub.track and pub.track.kind == rtc.TrackKind.KIND_AUDIO:
                return pub.track

        # Wait for track subscription
        track_ready = asyncio.Event()
        audio_track = None

        @self._ctx.room.on("track_subscribed")
        def on_track(track: rtc.Track, pub: rtc.TrackPublication, participant: rtc.RemoteParticipant):
            nonlocal audio_track
            if track.kind == rtc.TrackKind.KIND_AUDIO and participant.identity == self._participant.identity:
                audio_track = track
                track_ready.set()

        try:
            await asyncio.wait_for(track_ready.wait(), timeout=30.0)
        except asyncio.TimeoutError:
            logger.warning("🎤 Timeout waiting for audio track")

        return audio_track

    async def _send_data(self, payload: dict):
        """Send data to frontend via data channel"""
        try:
            data = json.dumps(payload).encode("utf-8")
            await self._ctx.room.local_participant.publish_data(data, reliable=True)
        except Exception as e:
            logger.warning(f"Send data error: {e}")

    async def _report_error(self, error_msg: str):
        logger.error(f"❌ {error_msg}")
        try:
            await self._send_data({"type": "error", "message": error_msg})
        except: pass

    async def _cleanup(self):
        """Cleanup resources"""
        logger.info("🧹 Cleaning up...")
        self._running = False
        
        if self._stt_task:
            self._stt_task.cancel()
        
        # End API Session
        if self._api_session_id:
             try:
                 import requests
                 requests.post(f"{self.API_BASE_URL}/session/end", 
                              json={"avatarId": API_AVATAR_ID}, timeout=2)
             except: pass


# =============================================================================
# Entrypoint
# =============================================================================
async def entrypoint(ctx: JobContext):
    """Single unified entrypoint"""
    agent = UnifiedAvatarAgent(ctx)
    await agent.start()


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
