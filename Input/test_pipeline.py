import requests
import argparse
import time
import os
import json
import subprocess

# Configuration
BASE_URL = "https://avatarinput.onrender.com/api"
# ensure this is unique or random to avoid "Username exists" error on repeated runs
# For testing, we'll append a timestamp to the username
import time
USERNAME = f"test_user_{int(time.time())}"
PASSWORD = "testpassword123"
FULL_NAME = "Test User"

def get_video_duration(file_path):
    """Get video duration in seconds using ffprobe."""
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
             '-of', 'default=noprint_wrappers=1:nokey=1', file_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        duration = float(result.stdout.strip())
        return duration
    except Exception as e:
        print(f"    WARNING: Could not determine video duration: {e}")
        print(f"    Using default timeout of 300s")
        return None

def register_user():
    """Creates a new user and returns the avatar_id."""
    url = f"{BASE_URL}/auth/register"
    payload = {
        "username": USERNAME,
        "password": PASSWORD,
        "fullName": FULL_NAME
    }
    print(f"[*] Registering user '{USERNAME}'...")
    response = requests.post(url, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        print(f"    SUCCESS: User created. Avatar ID: {data['avatarId']}")
        return data['avatarId']
    else:
        print(f"    ERROR: {response.text}")
        return None

def upload_video(avatar_id, file_path):
    """Uploads the MP4 file for ingestion."""
    url = f"{BASE_URL}/ingest/{avatar_id}"
    
    if not os.path.exists(file_path):
        print(f"    ERROR: File not found: {file_path}")
        return None

    print(f"[*] Uploading video: {file_path}...")
    with open(file_path, 'rb') as f:
        files = {'video': (os.path.basename(file_path), f, 'video/mp4')}
        response = requests.post(url, files=files)
    
    if response.status_code == 200:
        job_id = response.json().get('jobId')
        print(f"    SUCCESS: Ingestion started. Job ID: {job_id}")
        return job_id
    else:
        print(f"    ERROR: Upload failed: {response.text}")
        return None

def wait_for_ingestion(job_id, timeout=300):
    """Polls the job status until completion or timeout."""
    url = f"{BASE_URL}/ingest/status/{job_id}"
    print(f"[*] Waiting for ingestion to complete (timeout: {timeout}s)...")
    
    start_time = time.time()
    while time.time() - start_time < timeout:
        response = requests.get(url)
        if response.status_code == 200:
            job = response.json()
            status = job.get('status')
            
            if status == 'completed':
                print(f"    SUCCESS: Ingestion completed!")
                return True
            elif status == 'failed':
                print(f"    ERROR: Ingestion failed: {job.get('error')}")
                return False
            else:
                print(f"    Status: {status}... (waiting)")
                time.sleep(5)
        else:
            print(f"    ERROR: Could not check status: {response.text}")
            return False
    
    print(f"    TIMEOUT: Ingestion did not complete within {timeout}s")
    return False

def get_profile(avatar_id):
    """Retrieves the avatar profile."""
    url = f"{BASE_URL}/avatar/{avatar_id}"
    print(f"[*] Fetching Avatar Profile...")
    response = requests.get(url)
    
    if response.status_code == 200:
        profile = response.json()
        print(f"    Traits: {profile.get('personality', {}).get('traits')}")
        print(f"    Dialect: {profile.get('personality', {}).get('dialect')}")
        print(f"    Sessions: {profile.get('personality', {}).get('consistencyMetrics', {}).get('totalSessions')}")
        return profile
    else:
        print(f"    ERROR: Could not fetch profile: {response.text}")
        return None

def test_conversation(avatar_id):
    """Runs a test conversation to verify the avatar learned from the video."""
    print(f"\n[*] Starting test conversation...")
    
    # Start session
    session_response = requests.post(f"{BASE_URL}/chat/session/start", json={"avatarId": avatar_id})
    if session_response.status_code != 200:
        print(f"    ERROR: Could not start session: {session_response.text}")
        return
    
    session_id = session_response.json().get('sessionId')
    print(f"    Session ID: {session_id}")
    
    # Ask about what they were doing
    print(f"\n[*] User: What were you doing earlier?")
    generate_response = requests.post(f"{BASE_URL}/chat/generate", json={
        "avatarId": avatar_id,
        "sessionId": session_id,
        "text": "What were you doing earlier?"
    })
    
    if generate_response.status_code == 200:
        response_text = generate_response.json().get('response')
        print(f"    Avatar: {response_text}")
    else:
        print(f"    ERROR: {generate_response.text}")
    
    # End session
    requests.post(f"{BASE_URL}/chat/session/end", json={"avatarId": avatar_id})
    print(f"[*] Session ended.")

def main():
    parser = argparse.ArgumentParser(description="Test Avatar Pipeline")
    parser.add_argument("video_path", help="Path to the .mp4 file")
    args = parser.parse_args()

    # 0. Get video duration for timeout calculation
    video_duration = get_video_duration(args.video_path)
    if video_duration:
        # Timeout = 2x video duration + 60s buffer for processing overhead
        timeout = int(video_duration * 2 + 60)
        print(f"[*] Video duration: {video_duration:.1f}s, using timeout: {timeout}s")
    else:
        timeout = 300  # Default 5 minutes

    # 1. Register
    avatar_id = register_user()
    if not avatar_id:
        return

    # 2. Upload Video
    job_id = upload_video(avatar_id, args.video_path)
    if not job_id:
        return

    # 3. Wait for ingestion to complete
    if not wait_for_ingestion(job_id, timeout=timeout):
        print("\n[!] Ingestion failed or timed out. Exiting.")
        return
    
    # 4. Check profile
    get_profile(avatar_id)

    # 5. Test conversation
    test_conversation(avatar_id)

    print("\n[*] TEST COMPLETE.")
    print(f"[*] Avatar ID: {avatar_id}")
    print(f"[*] You can continue to interact at: {BASE_URL}/avatar/{avatar_id}")

if __name__ == "__main__":
    main()
