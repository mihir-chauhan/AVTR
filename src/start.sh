#!/bin/bash
# BitHuman Avatar - Quick Start Script

echo "======================================"
echo "BitHuman Avatar Chat"
echo "======================================"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q -r requirements.txt

echo ""
echo "======================================"
echo "Starting services..."
echo "======================================"
echo ""
echo "1. Starting Web Server (port 8000)..."
echo "2. Starting Agent (LiveKit worker)..."
echo ""
echo "Open http://localhost:8000 in your browser"
echo ""
echo "Press Ctrl+C to stop"
echo "======================================"
echo ""

# Start both processes
# Web server in background
python app.py &
WEB_PID=$!

# Small delay
sleep 2

# Agent in foreground
python agent.py dev

# Cleanup
kill $WEB_PID 2>/dev/null
