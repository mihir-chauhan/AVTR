import requests
import time
import sys
import uuid

BASE_URL = "http://localhost:3000/api"

def register_user():
    username = f"stream_test_{uuid.uuid4().hex[:8]}"
    url = f"{BASE_URL}/auth/register"
    payload = {
        "username": username,
        "password": "testpassword123",
        "fullName": "Stream Tester"
    }
    print(f"[*] Registering user '{username}'...")
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            avatar_id = response.json()['avatarId']
            print(f"    SUCCESS: Avatar ID: {avatar_id}")
            return avatar_id
        else:
            print(f"    ERROR: Registration failed: {response.text}")
            return None
    except Exception as e:
        print(f"    ERROR: {e}")
        return None

def start_session(avatar_id):
    url = f"{BASE_URL}/chat/session/start"
    print(f"[*] Starting session for {avatar_id}...")
    try:
        response = requests.post(url, json={"avatarId": avatar_id})
        if response.status_code == 200:
            session_id = response.json()['sessionId']
            print(f"    SUCCESS: Session ID: {session_id}")
            return session_id
        else:
            print(f"    ERROR: Session start failed: {response.text}")
            return None
    except Exception as e:
        print(f"    ERROR: {e}")
        return None

def test_streaming(avatar_id, session_id, intervention=1):
    url = f"{BASE_URL}/chat/generate_with_human"
    payload = {
        "avatarId": avatar_id,
        "sessionId": session_id,
        "text": "The weather is really nice today, isn't it? I think we should go for a walk.",
        "intervention": intervention
    }
    
    print(f"[*] Testing Streaming Endpoint (Intervention={intervention}):")
    
    try:
        with requests.post(url, json=payload, stream=True) as response:
            if response.status_code != 200:
                print(f"    ERROR: Status Code {response.status_code}")
                print(f"    Body: {response.text}")
                return

            print("    [Stream Start]")
            full_content = ""
            start_time = time.time()
            first_chunk_time = None
            
            for chunk in response.iter_content(chunk_size=None):
                if chunk:
                    text_chunk = chunk.decode('utf-8')
                    full_content += text_chunk
                    sys.stdout.write(text_chunk)
                    sys.stdout.flush()
                    
                    if first_chunk_time is None:
                        first_chunk_time = time.time() - start_time
            
            print("\n    [Stream End]")
            print(f"    First chunk: {first_chunk_time:.3f}s")
            print(f"    Total length: {len(full_content)}")
            
            # Simple assertive check based on intervention type
            if intervention == 0:
                if full_content == payload['text']:
                     print("    ✅ SUCCESS: Intervention 0 echoed input exactly.")
                else:
                     print("    ❌ FAILURE: Intervention 0 did not echo exactly.")
            else:
                 # In mock mode, we expect: [Mock Guided Response] ...
                 # or if live, something different.
                 # Mock logic: `[Mock Guided Response] ${humanInput} (transformed)`
                 if full_content != payload['text']:
                      print("    ✅ SUCCESS: Intervention > 0 modified the input.")
                 else:
                      print("    ⚠️  WARNING: Intervention > 0 returned exact input.")
            
    except Exception as e:
        print(f"    ERROR: {e}")

if __name__ == "__main__":
    # Self-contained setup
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--mock", action="store_true", help="Run in mock mode (skip auth/db)")
    args = parser.parse_args()

    try:
        if args.mock:
            print("[*] Running in MOCK mode (skipping registration)")
            avatar_id = "mock-avatar-id"
            session_id = "mock-session-id"
            
            print("\n" + "="*40)
            test_streaming(avatar_id, session_id, intervention=1)
            print("-" * 30)
            test_streaming(avatar_id, session_id, intervention=0)
            print("="*40 + "\n")
            
        else:
            avatar_id = register_user()
            if avatar_id:
                session_id = start_session(avatar_id)
                if session_id:
                    print("\n" + "="*40)
                    # Test Case 1: High Intervention
                    test_streaming(avatar_id, session_id, intervention=1)
                    print("-" * 30)
                    # Test Case 2: No Intervention
                    test_streaming(avatar_id, session_id, intervention=0)
                    print("="*40 + "\n")
    except requests.exceptions.ConnectionError:
        print("[!] Could not connect to server. Is it running on port 3000?")
