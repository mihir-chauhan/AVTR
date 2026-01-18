# Quick Start Guide

## Already Working ✓

Run these commands right now:

```bash
# Verify your avatar
python3 test_avatar.py

# List your agents
python3 rest_api_example.py
```

## To Use Real-Time Avatar (3 Steps)

### 1. Get LiveKit Account
- Go to https://cloud.livekit.io
- Sign up (free tier available)
- Create a new project

### 2. Configure Credentials
```bash
python3 setup_livekit.py
```
Enter your LiveKit credentials when prompted.

### 3. Test & Run
```bash
# Test configuration
python3 test_livekit.py

# Install dependencies
pip install -r requirements.txt

# Run real-time avatar
python3 python_example.py dev
```

## What Each File Does

| File | Purpose | Status |
|------|---------|--------|
| `test_avatar.py` | Check avatar access | ✓ Working |
| `create_agent.py` | Create new agents | ✓ Working |
| `rest_api_example.py` | Basic API calls | ✓ Working |
| `setup_livekit.py` | Configure LiveKit | Ready |
| `test_livekit.py` | Verify LiveKit setup | Needs credentials |
| `python_example.py` | Real-time avatar session | Needs LiveKit |
| `start_call_example.py` | Start video calls | Needs LiveKit |

## Need Help?

- Full details: `SETUP_COMPLETE.md`
- Documentation: https://docs.bey.dev
- Discord: https://discord.gg/beyondpresence
