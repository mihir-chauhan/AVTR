"""
Example: Start a real-time call with your avatar
Requires LiveKit credentials
"""
import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = "sk-WqWFLJ7Jf_AWCFTgH-L_Pg11jifisvwC4IJaQ2v41SE"
AVATAR_ID = "b63ba4e6-d346-45d0-ad28-5ddffaac0bd0_v2"
API_BASE_URL = "https://api.bey.dev/v1"

LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_TOKEN = os.getenv("LIVEKIT_TOKEN")  # You need to generate this

headers = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
}

print("Starting Real-Time Avatar Call")
print("=" * 60)

if not LIVEKIT_URL:
    print("✗ LIVEKIT_URL not found in environment")
    print("\nPlease run: python setup_livekit.py")
    exit(1)

if not LIVEKIT_TOKEN:
    print("⚠ LIVEKIT_TOKEN not set")
    print("\nYou need to generate a LiveKit token first.")
    print("Run: python test_livekit.py")
    print("\nFor now, using a placeholder...")
    LIVEKIT_TOKEN = "placeholder-token"

print(f"Avatar ID: {AVATAR_ID}")
print(f"LiveKit URL: {LIVEKIT_URL}")
print()

# Call configuration
call_config = {
    "avatar_id": AVATAR_ID,
    "livekit_url": LIVEKIT_URL,
    "livekit_token": LIVEKIT_TOKEN,
    "language": "english",
}

print("Call Configuration:")
print(json.dumps(call_config, indent=2))
print()

# Start the call
print("Starting call...")
try:
    response = requests.post(
        f"{API_BASE_URL}/calls",
        headers=headers,
        json=call_config,
    )
    response.raise_for_status()
    call_data = response.json()
    
    print(f"✓ Call started successfully!\n")
    print(f"Call ID: {call_data.get('id')}")
    print(f"Status: {call_data.get('status')}")
    
    print(f"\nFull call details:")
    print(json.dumps(call_data, indent=2))
    
except requests.exceptions.HTTPError as e:
    print(f"✗ Error starting call: {e}")
    print(f"  Response: {e.response.text}")
    if e.response.status_code == 400:
        print("\n  This might be due to an invalid LiveKit token.")
        print("  Generate a proper token with: python test_livekit.py")
except Exception as e:
    print(f"✗ Error: {e}")
