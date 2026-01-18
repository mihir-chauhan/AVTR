"""
Beyond Presence Real-Time Avatar API Example
Using REST API directly
"""
import requests
import json

# Configuration
API_KEY = "sk-WqWFLJ7Jf_AWCFTgH-L_Pg11jifisvwC4IJaQ2v41SE"
API_BASE_URL = "https://api.bey.dev/v1"

# Headers for API requests
headers = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
}


def list_avatars():
    """List all available avatars"""
    response = requests.get(f"{API_BASE_URL}/avatars", headers=headers)
    response.raise_for_status()
    return response.json()


def get_avatar_details(avatar_id):
    """Get details for a specific avatar"""
    response = requests.get(f"{API_BASE_URL}/avatars/{avatar_id}", headers=headers)
    response.raise_for_status()
    return response.json()


def start_call(avatar_id, livekit_url, livekit_token, language="english"):
    """
    Start a real-time avatar call via REST API
    
    Args:
        avatar_id: The ID of the avatar to use
        livekit_url: Your LiveKit WebSocket URL (e.g., wss://your.livekit.cloud)
        livekit_token: LiveKit access token
        language: Language code (default: "english")
    """
    payload = {
        "avatar_id": avatar_id,
        "livekit_url": livekit_url,
        "livekit_token": livekit_token,
        "language": language,
    }
    
    response = requests.post(
        f"{API_BASE_URL}/calls",
        headers=headers,
        json=payload,
    )
    response.raise_for_status()
    return response.json()


def list_agents():
    """List all agents"""
    response = requests.get(f"{API_BASE_URL}/agents", headers=headers)
    response.raise_for_status()
    return response.json()


def create_agent(name, avatar_id, system_prompt, language="english"):
    """Create a new agent"""
    payload = {
        "name": name,
        "avatar_id": avatar_id,
        "system_prompt": system_prompt,
        "language": language,
    }
    
    response = requests.post(
        f"{API_BASE_URL}/agents",
        headers=headers,
        json=payload,
    )
    response.raise_for_status()
    return response.json()


if __name__ == "__main__":
    print("Beyond Presence API Examples\n")
    
    # Example 1: List available avatars
    print("1. Listing available avatars...")
    try:
        avatars = list_avatars()
        print(f"Found {len(avatars.get('avatars', []))} avatars")
        if avatars.get("avatars"):
            print(f"First avatar ID: {avatars['avatars'][0].get('id', 'N/A')}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Example 2: List agents
    print("\n2. Listing agents...")
    try:
        agents = list_agents()
        print(f"Found {len(agents.get('agents', []))} agents")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\nNote: To start a real-time call, you'll need:")
    print("- An avatar ID (from list_avatars())")
    print("- A LiveKit URL and token")
    print("- Then call start_call() with those parameters")
