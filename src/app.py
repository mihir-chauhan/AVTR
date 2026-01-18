"""
BitHuman Avatar Chat - Web Server
=================================
This server provides:
- Token endpoint for LiveKit room access
- Agent dispatch to trigger the avatar agent
- Static file serving for the frontend

Run this with: python app.py
Run agent with: python agent.py dev
"""

import os
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from livekit.api import AccessToken, VideoGrants

load_dotenv()

# Import config as fallback
import config

# Configuration
LIVEKIT_URL = os.getenv("LIVEKIT_URL", config.LIVEKIT_URL)
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", config.LIVEKIT_API_KEY)
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", config.LIVEKIT_API_SECRET)
BITHUMAN_AVATAR_ID = os.getenv("BITHUMAN_AVATAR_ID", config.BITHUMAN_AVATAR_ID)

app = FastAPI(title="BitHuman Avatar Chat")


@app.get("/")
async def index():
    """Serve the main page"""
    return FileResponse("static/index.html")


@app.get("/api/config")
async def get_config():
    """Get frontend configuration"""
    return {
        "livekit_url": LIVEKIT_URL,
        "avatar_id": BITHUMAN_AVATAR_ID,
    }


@app.get("/api/token")
async def get_token(room: str = "avatar-room", identity: str = None, mode: str = "ai"):
    """
    Generate LiveKit access token and dispatch agent to the room.

    Args:
        room: Room name to join
        identity: User identity (auto-generated if not provided)
        mode: Initial mode preference ('ai' or 'human') - can switch live via data channel
    """
    if identity is None:
        identity = f"user-{datetime.now().strftime('%H%M%S')}"

    import uuid
    # Generate unique room name for every session to ensure fresh agent dispatch
    if room == "avatar-room":
        room_name = f"avatar-session-{uuid.uuid4().hex[:8]}"
    else:
        room_name = room
    
    # Create token with agent dispatch permission
    token = AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET) \
        .with_identity(identity) \
        .with_name("User") \
        .with_grants(VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
            agent=True,  # Allow agent interactions
        ))
    
    # Agent is auto-dispatched by LiveKit when participant joins (no manual dispatch needed)

    return {
        "token": token.to_jwt(),
        "url": LIVEKIT_URL,
        "room": room_name,
        "identity": identity,
        "mode": mode,
    }


# Mount static files
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    """Serve the main page for any unknown route (SPA support)"""
    return FileResponse("static/index.html")


if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print("BitHuman Avatar Chat - Web Server")
    print("=" * 60)
    print(f"\nLiveKit URL: {LIVEKIT_URL}")
    print(f"Avatar ID: {BITHUMAN_AVATAR_ID}")
    print(f"\n📌 Start the agent in another terminal:")
    print("   python agent.py dev")
    print(f"\n🌐 Open http://localhost:8000 in your browser")
    print("=" * 60 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
