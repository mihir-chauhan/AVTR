import requests
import argparse
import sys

# Configuration
BASE_URL = "https://avatarinput.onrender.com/api"

def test_conversation(avatar_id):
    """Starts a chat session and allows interactive testing."""
    print(f"\n[*] Connecting to Avatar: {avatar_id} at {BASE_URL}")
    
    # 1. Start session
    try:
        session_response = requests.post(f"{BASE_URL}/chat/session/start", json={"avatarId": avatar_id})
        if session_response.status_code != 200:
            print(f"    ERROR: Could not start session: {session_response.text}")
            return
        
        session_id = session_response.json().get('sessionId')
        print(f"    SUCCESS: Session started. ID: {session_id}")
    except Exception as e:
        print(f"    ERROR: Connection failed: {e}")
        return

    print("\n" + "="*50)
    print(" CHAT STARTED (Type 'exit' or 'quit' to end)")
    print("="*50 + "\n")

    try:
        while True:
            # 2. Get User Input
            user_text = input("You: ").strip()
            
            if user_text.lower() in ['exit', 'quit']:
                break
            
            if not user_text:
                continue

            # 3. Generate Response
            print("[*] Waiting for avatar...", end="\r")
            generate_response = requests.post(f"{BASE_URL}/chat/generate", json={
                "avatarId": avatar_id,
                "sessionId": session_id,
                "text": user_text
            })
            
            if generate_response.status_code == 200:
                response_data = generate_response.json()
                avatar_reply = response_data.get('response', 'No response found.')
                print(f"Avatar: {avatar_reply}\n")
            else:
                print(f"\n    ERROR: {generate_response.text}")

    except KeyboardInterrupt:
        print("\n\n[*] Interrupted by user.")
    finally:
        # 4. End session
        print("\n[*] Ending session...")
        requests.post(f"{BASE_URL}/chat/session/end", json={"avatarId": avatar_id})
        print("[*] Goodbye!")

def main():
    parser = argparse.ArgumentParser(description="Test Avatar Conversation")
    parser.add_argument("avatar_id", help="The UUID of the avatar to chat with")
    args = parser.parse_args()

    test_conversation(args.avatar_id)

if __name__ == "__main__":
    main()
