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
CORS(app)  # Allow requests from your STRIDE frontend

# API key loaded from Render environment variable — never hardcoded
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

@app.route("/", methods=["GET"])
def health():
    return jsonify({ "status": "STRIDE proxy is running" })

@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json()

    if not data or "prompt" not in data:
        return jsonify({ "error": "Missing prompt field" }), 400

    prompt = data["prompt"]

    print(f"\n→ Sending to Anthropic Claude...")

    try:
        message = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=8000,
            messages=[{ "role": "user", "content": prompt }]
        )

        # Extract text from Anthropic response
        text = next((b.text for b in message.content if b.type == "text"), "")

        if not text:
            return jsonify({ "error": "Empty response from Claude" }), 500

        print(f"← Claude responded ({len(text)} chars)")
        print(f"--- First 200 chars ---\n{text[:200]}\n-----------------------")

        # Strip markdown fences
        clean = re.sub(r"```json|```", "", text).strip()

        # Try parsing directly
        try:
            parsed = json.loads(clean)
            workouts = parsed if isinstance(parsed, list) else parsed.get("workouts") or parsed.get("plan")
        except json.JSONDecodeError:
            # Extract array from within text
            match = re.search(r"\[[\s\S]*\]", clean)
            if not match:
                print("Could not find JSON array. Full response:")
                print(text)
                return jsonify({ "error": "Could not extract workout array from Claude response" }), 500
            workouts = json.loads(match.group())

        print(f"✓ Parsed {len(workouts)} workouts successfully")
        return jsonify({ "workouts": workouts })

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({ "error": str(e) }), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    app.run(host="0.0.0.0", port=port)
