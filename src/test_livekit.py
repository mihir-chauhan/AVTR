"""
Test LiveKit configuration and generate a test token
"""
import os
import sys

try:
    from livekit import api
    from dotenv import load_dotenv
except ImportError:
    print("Missing dependencies. Installing...")
    os.system("pip install livekit python-dotenv")
    from livekit import api
    from dotenv import load_dotenv

# Load environment variables
load_dotenv()

LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

print("LiveKit Configuration Test")
print("=" * 60)

if not all([LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET]):
    print("✗ Missing LiveKit credentials!")
    print("\nPlease run: python setup_livekit.py")
    print("Or set these environment variables:")
    print("  - LIVEKIT_URL")
    print("  - LIVEKIT_API_KEY")
    print("  - LIVEKIT_API_SECRET")
    sys.exit(1)

print(f"LiveKit URL: {LIVEKIT_URL}")
print(f"API Key: {LIVEKIT_API_KEY[:10]}...")
print()

# Generate a test token
print("Generating test token...")
try:
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity("test-user")
    token.with_name("Test User")
    token.with_grants(api.VideoGrants(
        room_join=True,
        room="test-room"
    ))
    
    jwt_token = token.to_jwt()
    print(f"✓ Token generated successfully!")
    print(f"\nToken (first 50 chars): {jwt_token[:50]}...")
    print(f"\nFull token:\n{jwt_token}")
    
    print("\n" + "=" * 60)
    print("✓ LiveKit configuration is working!")
    print("\nYou can now:")
    print("  1. Start a real-time avatar session")
    print("  2. Run: python python_example.py dev")
    
except Exception as e:
    print(f"✗ Error generating token: {e}")
    print("\nPlease check your LiveKit credentials.")
    sys.exit(1)
