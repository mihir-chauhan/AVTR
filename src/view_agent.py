"""
View your agent details and get dashboard/embed URLs
"""
import requests
import json

API_KEY = "sk-WqWFLJ7Jf_AWCFTgH-L_Pg11jifisvwC4IJaQ2v41SE"
AGENT_ID = "2a389a49-922c-401e-bdfe-db1506f65125"
API_BASE_URL = "https://api.bey.dev/v1"

headers = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
}

print("Agent Information")
print("=" * 60)

# Get agent details
try:
    response = requests.get(
        f"{API_BASE_URL}/agents/{AGENT_ID}",
        headers=headers
    )
    response.raise_for_status()
    agent = response.json()
    
    print(f"✓ Agent found!\n")
    print(f"Name: {agent.get('name')}")
    print(f"ID: {agent.get('id')}")
    print(f"Avatar ID: {agent.get('avatar_id')}")
    print(f"Language: {agent.get('language')}")
    print(f"System Prompt: {agent.get('system_prompt')}")
    
    print("\n" + "=" * 60)
    print("\nUseful URLs:")
    print(f"Dashboard: https://dashboard.bey.dev")
    print(f"Agent Settings: https://dashboard.bey.dev/agents/{AGENT_ID}")
    
    print("\n" + "=" * 60)
    print("\nFull agent details:")
    print(json.dumps(agent, indent=2))
    
except requests.exceptions.HTTPError as e:
    print(f"✗ Error: {e}")
    print(f"  Response: {e.response.text}")
except Exception as e:
    print(f"✗ Error: {e}")
