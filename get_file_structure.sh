#!/bin/bash
find . \( -name ".venv" -o -name "*.log" -o -name ".git" -o -name "__pycache__" -o -name "node_modules" -o -name "*.tmp" -o -name "data" \) -prune -o -print