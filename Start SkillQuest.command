#!/bin/bash
cd "$(dirname "$0")"
echo "Installing dependencies..."
npm install --silent 2>/dev/null
echo ""
echo "Starting SkillQuest..."
echo "Open http://localhost:3000 in your browser"
echo ""
node server.js
