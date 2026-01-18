"""
Beyond Presence Real-Time Avatar API Example (Python)
Using LiveKit Agents Plugin
"""
import asyncio
from livekit import agents, rtc
from livekit.plugins import bey, openai, silero
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
    tts,
    vad,
    voice_assistant,
)

# Your API key
BEY_API_KEY = "sk-WqWFLJ7Jf_AWCFTgH-L_Pg11jifisvwC4IJaQ2v41SE"
AVATAR_ID = "b63ba4e6-d346-45d0-ad28-5ddffaac0bd0_v2"


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the voice assistant with avatar"""
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    # Initialize the voice assistant
    assistant = voice_assistant.VoiceAssistant(
        vad=vad.VAD.load(),
        stt=openai.STT(),
        llm=llm.LLM.load(),
        tts=tts.TTS.load(),
        chat_ctx=llm.ChatContext().append(
            role="system",
            text="You are a helpful AI assistant with a realistic avatar.",
        ),
    )
    
    # Create avatar session
    avatar = bey.AvatarSession(
        avatar_id=AVATAR_ID,
        api_key=BEY_API_KEY,
    )
    
    # Start avatar session
    await avatar.start(assistant.session, room=ctx.room)
    
    # Start the assistant
    assistant.start(ctx.room)
    
    # Wait for the session to complete
    await assistant.aclose()


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
