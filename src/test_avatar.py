"""
Test script to verify avatar access and details
"""
import requests
import json

API_KEY = "sk-WqWFLJ7Jf_AWCFTgH-L_Pg11jifisvwC4IJaQ2v41SE"
AVATAR_ID = "b63ba4e6-d346-45d0-ad28-5ddffaac0bd0_v2"
API_BASE_URL = "https://api.bey.dev/v1"

headers = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
}

print("Testing Avatar Access")
print("=" * 50)
print(f"\nAvatar ID: {AVATAR_ID}\n")

# Test 1: Get avatar details
print("1. Fetching avatar details...")
try:
    response = requests.get(
        f"{API_BASE_URL}/avatars/{AVATAR_ID}",
        headers=headers
    )
    response.raise_for_status()
    avatar_data = response.json()
    print(f"✓ Avatar found!")
    print(f"  Name: {avatar_data.get('name', 'N/A')}")
    print(f"  Status: {avatar_data.get('status', 'N/A')}")
    print(f"  Type: {avatar_data.get('type', 'N/A')}")
    print(f"\nFull details:")
    print(json.dumps(avatar_data, indent=2))
except requests.exceptions.HTTPError as e:
    print(f"✗ Error: {e}")
    print(f"  Response: {e.response.text}")
except Exception as e:
    print(f"✗ Error: {e}")

print("\n" + "=" * 50)
print("\n2. Listing all available avatars...")
try:
    response = requests.get(
        f"{API_BASE_URL}/avatars",
        headers=headers
    )
    response.raise_for_status()
    avatars = response.json()
    print(f"✓ Found {len(avatars.get('avatars', []))} total avatars")
    if avatars.get('avatars'):
        for avatar in avatars['avatars']:
            print(f"  - {avatar.get('id')}: {avatar.get('name', 'Unnamed')}")
except Exception as e:
    print(f"✗ Error: {e}")

print("\n" + "=" * 50)
print("\nNext steps:")
print("- If avatar is accessible, you can proceed with LiveKit setup")
print("- Run setup_livekit.py to configure LiveKit credentials")
