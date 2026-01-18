# Beyond Presence Avatar API - Setup Complete! ✓

## What We've Done

### ✓ 1. Verified Avatar Access
- **Avatar ID**: `b63ba4e6-d346-45d0-ad28-5ddffaac0bd0_v2`
- **Avatar Name**: Jerome - Business
- **Status**: Available
- **Visibility**: Public

### ✓ 2. Created Your First Agent
- **Agent ID**: `2a389a49-922c-401e-bdfe-db1506f65125`
- **Agent Name**: My First Avatar Agent
- **Language**: English (en)
- **System Prompt**: "You are a helpful AI assistant. Be friendly, concise, and engaging."

### ✓ 3. Updated All Examples
All example files now include your:
- API Key: `sk-WqWFLJ7Jf_AWCFTgH-L_Pg11jifisvwC4IJaQ2v41SE`
- Avatar ID: `b63ba4e6-d346-45d0-ad28-5ddffaac0bd0_v2`

## Files Created

### Working Examples
1. **`test_avatar.py`** ✓ - Verified avatar access (tested successfully)
2. **`create_agent.py`** ✓ - Created agent (tested successfully)
3. **`rest_api_example.py`** - REST API examples
4. **`python_example.py`** - LiveKit Agents plugin (Python)
5. **`node_example.js`** - LiveKit Agents plugin (Node.js)

### Setup Scripts
6. **`setup_livekit.py`** - Interactive LiveKit configuration
7. **`test_livekit.py`** - Test LiveKit credentials
8. **`start_call_example.py`** - Start real-time calls

### Configuration
9. **`config.py`** - Centralized configuration
10. **`requirements.txt`** - Python dependencies
11. **`package.json`** - Node.js dependencies

## Next Steps

### Option A: Use REST API (Simplest - No LiveKit needed)

```bash
# Already working!
python3 rest_api_example.py
python3 test_avatar.py
```

### Option B: Set Up Real-Time Streaming (Requires LiveKit)

#### Step 1: Get LiveKit Credentials
1. Sign up at [LiveKit Cloud](https://cloud.livekit.io) (free tier available)
2. Create a new project
3. Copy your credentials:
   - LiveKit URL (wss://your-project.livekit.cloud)
   - API Key
   - API Secret

#### Step 2: Configure LiveKit
```bash
python3 setup_livekit.py
# This will create a .env file with your credentials
```

#### Step 3: Test LiveKit Setup
```bash
pip install python-dotenv livekit
python3 test_livekit.py
```

#### Step 4: Run Real-Time Avatar Session
```bash
# Install all dependencies
pip install -r requirements.txt

# Run the LiveKit agent
python3 python_example.py dev
```

## Quick Commands Reference

```bash
# Test avatar access
python3 test_avatar.py

# List all agents
python3 -c "from rest_api_example import list_agents; import json; print(json.dumps(list_agents(), indent=2))"

# List all avatars
python3 -c "from rest_api_example import list_avatars; import json; print(json.dumps(list_avatars(), indent=2))"

# Create another agent
python3 create_agent.py

# Setup LiveKit (interactive)
python3 setup_livekit.py
```

## Your Agent Information

You can access your agent via:
- **Agent ID**: `2a389a49-922c-401e-bdfe-db1506f65125`
- **Dashboard**: https://dashboard.bey.dev
- **API**: https://api.bey.dev/v1/agents/2a389a49-922c-401e-bdfe-db1506f65125

## Available Language Codes

When creating agents, use these ISO language codes:
- `en` - English (generic)
- `en-US` - English (US)
- `en-GB` - English (UK)
- `en-AU` - English (Australia)
- `es` - Spanish
- `fr` - French
- `de` - German
- `zh` - Chinese
- `ja` - Japanese
- And many more (see error message in create_agent.py for full list)

## Documentation Links

- [Beyond Presence API Docs](https://docs.bey.dev/get-started/api)
- [LiveKit Setup Guide](https://docs.livekit.io)
- [LiveKit Agents Plugin](https://docs.livekit.io/agents/models/avatar/plugins/bey/)

## What's Working Right Now

✓ Avatar verified and accessible  
✓ Agent created successfully  
✓ REST API examples working  
✓ All configuration files updated  
✓ Ready for LiveKit integration (pending your setup)

## Need Help?

- Check the [FAQ](https://docs.bey.dev/learn-more/faqs)
- Join the [Discord Community](https://discord.gg/beyondpresence)
- View the [API Reference](https://docs.bey.dev/api-reference)
