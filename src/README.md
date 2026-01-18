# Beyond Presence Real-Time Avatar API Examples

✓ **Setup Complete!** Your avatar "Jerome - Business" is ready to use.

## Your Configuration

- **Avatar ID**: `b63ba4e6-d346-45d0-ad28-5ddffaac0bd0_v2`
- **Avatar Name**: Jerome - Business
- **Agent ID**: `2a389a49-922c-401e-bdfe-db1506f65125`
- **API Key**: Configured in all examples

See `SETUP_COMPLETE.md` for detailed setup information.

## Quick Start

### Option 1: REST API (Simplest)

The REST API approach is the simplest way to get started without setting up LiveKit infrastructure.

#### Python Example

```bash
# Install dependencies
pip install -r requirements.txt

# Run the example
python rest_api_example.py
```

#### Bash Example

```bash
# Make script executable
chmod +x rest_api_example.sh

# Run the example
./rest_api_example.sh
```

### Option 2: LiveKit Agents Plugin (Recommended for Production)

For real-time voice + video integration, use the LiveKit Agents plugin.

#### Python Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables (if needed)
export OPENAI_API_KEY="your-openai-key"  # If using OpenAI for STT/LLM/TTS
export LIVEKIT_URL="wss://your.livekit.cloud"
export LIVEKIT_API_KEY="your-livekit-key"
export LIVEKIT_API_SECRET="your-livekit-secret"

# Update AVATAR_ID in python_example.py
# Then run:
python python_example.py dev
```

#### Node.js Setup

```bash
# Install dependencies
npm install

# Set environment variables
export OPENAI_API_KEY="your-openai-key"
export LIVEKIT_URL="wss://your.livekit.cloud"
export LIVEKIT_API_KEY="your-livekit-key"
export LIVEKIT_API_SECRET="your-livekit-secret"

# Update AVATAR_ID in node_example.js
# Then run:
npm start
```

## API Endpoints

### List Avatars

```bash
curl "https://api.bey.dev/v1/avatars" \
  --header "x-api-key: sk-WqWFLJ7Jf_AWCFTgH-L_Pg11jifisvwC4IJaQ2v41SE"
```

### Start a Call

```bash
curl --request POST \
  --url https://api.bey.dev/v1/calls \
  --header 'Content-Type: application/json' \
  --header 'x-api-key: sk-WqWFLJ7Jf_AWCFTgH-L_Pg11jifisvwC4IJaQ2v41SE' \
  --data '{
    "avatar_id": "<your-avatar-id>",
    "livekit_url": "wss://your.livekit.cloud",
    "livekit_token": "<your-livekit-token>",
    "language": "english"
  }'
```

## Next Steps

1. **Get an Avatar ID**: Run `list_avatars()` or use the REST API to get available avatar IDs
2. **Set up LiveKit** (for real-time): If using the LiveKit plugin, you'll need a LiveKit server
3. **Customize**: Update the avatar ID and configuration in the examples

## Documentation

- [Beyond Presence API Docs](https://docs.bey.dev/get-started/api)
- [LiveKit Agents Plugin](https://docs.livekit.io/agents/models/avatar/plugins/bey/)
- [API Reference](https://docs.bey.dev/api-reference)

## Notes

- The API key is included in the examples for convenience. In production, use environment variables or secure configuration management.
- For speech-to-video sessions, Beyond Presence recommends using the LiveKit plugin or Pipecat service rather than calling session endpoints directly.
- Avatar rendering latency is typically ~250ms.
