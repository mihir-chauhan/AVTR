"""
Create a Beyond Presence agent with your avatar
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

print("Creating Beyond Presence Agent")
print("=" * 60)
print(f"\nAvatar ID: {AVATAR_ID}\n")

# Agent configuration
agent_config = {
    "name": "My First Avatar Agent",
    "avatar_id": AVATAR_ID,
    "system_prompt": "You are a helpful AI assistant. Be friendly, concise, and engaging.",
    "language": "en",  # Use ISO language code
}

print("Agent Configuration:")
print(json.dumps(agent_config, indent=2))
print()

# Create the agent
print("Creating agent...")
try:
    response = requests.post(
        f"{API_BASE_URL}/agents",
        headers=headers,
        json=agent_config,
    )
    response.raise_for_status()
    agent_data = response.json()
    
    print(f"✓ Agent created successfully!\n")
    print(f"Agent ID: {agent_data.get('id')}")
    print(f"Name: {agent_data.get('name')}")
    print(f"Status: {agent_data.get('status')}")
    
    print(f"\nFull agent details:")
    print(json.dumps(agent_data, indent=2))
    
    print("\n" + "=" * 60)
    print("\nNext steps:")
    print("  1. You can now use this agent in conversations")
    print("  2. Get the agent's endpoint URL from the dashboard")
    print("  3. Or use the API to start calls with this agent")
    
except requests.exceptions.HTTPError as e:
    print(f"✗ Error creating agent: {e}")
    print(f"  Response: {e.response.text}")
except Exception as e:
    print(f"✗ Error: {e}")
