#!/bin/bash
# Beyond Presence Real-Time Avatar API Example (Bash/curl)
# Using REST API directly

API_KEY="sk-WqWFLJ7Jf_AWCFTgH-L_Pg11jifisvwC4IJaQ2v41SE"
API_BASE_URL="https://api.bey.dev/v1"

echo "Beyond Presence API Examples"
echo "============================"
echo ""

# Example 1: List available avatars
echo "1. Listing available avatars..."
curl -X GET \
  "${API_BASE_URL}/avatars" \
  --header "x-api-key: ${API_KEY}" \
  --header "Content-Type: application/json" | jq '.'

echo ""
echo ""

# Example 2: List agents
echo "2. Listing agents..."
curl -X GET \
  "${API_BASE_URL}/agents" \
  --header "x-api-key: ${API_KEY}" \
  --header "Content-Type: application/json" | jq '.'

echo ""
echo ""

# Example 3: Start a call (requires avatar_id, livekit_url, and livekit_token)
echo "3. To start a real-time call, use:"
echo ""
echo "curl --request POST \\"
echo "  --url ${API_BASE_URL}/calls \\"
echo "  --header 'Content-Type: application/json' \\"
echo "  --header 'x-api-key: ${API_KEY}' \\"
echo "  --data '{"
echo "    \"avatar_id\": \"<your-avatar-id>\","
echo "    \"livekit_url\": \"wss://your.livekit.cloud\","
echo "    \"livekit_token\": \"<your-livekit-token>\","
echo "    \"language\": \"english\""
echo "  }'"
