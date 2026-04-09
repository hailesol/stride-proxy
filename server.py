# ════════════════════════════════════
#  STRIDE — Python Proxy Server
#  Deployed on Render.com
#  Keeps Anthropic API key off browser
# ════════════════════════════════════

import os
import json
import re
import anthropic
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)

# 1. SIMPLE CORS: This is usually enough for Render/GitHub Pages
CORS(app)

# API key loaded from Render environment variable
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

@app.route("/", methods=["GET"])
def health():
    return jsonify({ "status": "STRIDE proxy is running" })

@app.route("/generate", methods=["POST"])
def generate():
    # flask_cors handles OPTIONS automatically, so we only need POST logic here
    data = request.get_json()

    if not data or "prompt" not in data:
        return jsonify({ "error": "Missing prompt field" }), 400

    prompt = data["prompt"]
    print(f"\n→ Sending to Anthropic...")

    try:
        # 2. FIXED MODEL NAME: Changed to 3.5 Sonnet (or use 3-opus-20240229)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=8000,
            messages=[{ "role": "user", "content": prompt }]
        )

        text = next((b.text for b in message.content if b.type == "text"), "")

        if not text:
            return jsonify({ "error": "Empty response from Claude" }), 500

        print(f"← Claude responded ({len(text)} chars)")

        # Strip markdown fences
        clean = re.sub(r"```json|```", "", text).strip()

        try:
            parsed = json.loads(clean)
            # Handle different possible JSON structures from the AI
            if isinstance(parsed, list):
                workouts = parsed
            elif "workouts" in parsed:
                workouts = parsed["workouts"]
            elif "plan" in parsed:
                workouts = parsed["plan"]
            else:
                workouts = parsed
        except json.JSONDecodeError:
            match = re.search(r"\[[\s\S]*\]", clean)
            if not match:
                return jsonify({ "error": "Could not extract workout array" }), 500
            workouts = json.loads(match.group())

        return jsonify({ "workouts": workouts })

    except Exception as e:
        print(f"Error: {str(e)}")
        # Return error with 500 status but CORS will still be attached by flask_cors
        return jsonify({ "error": str(e) }), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    app.run(host="0.0.0.0", port=port)
