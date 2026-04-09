# ════════════════════════════════════
#  STRIDE — Python Proxy Server
#  Deployed on Render.com
#  Keeps Anthropic API key off browser
# ════════════════════════════════════

import os
import json
import re
import anthropic
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS

app = Flask(__name__)

# Apply CORS globally to all routes
CORS(app, resources={r"/*": {"origins": "*"}})

# API key loaded from Render environment variable
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

@app.after_request
def after_request(response):
    return add_cors_headers(response)

@app.route("/", methods=["GET"])
def health():
    return jsonify({ "status": "STRIDE proxy is running" })

@app.route("/generate", methods=["OPTIONS", "POST"])
def generate():
    # Handle preflight
    if request.method == "OPTIONS":
        return make_response("", 200)

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

        text = next((b.text for b in message.content if b.type == "text"), "")

        if not text:
            return jsonify({ "error": "Empty response from Claude" }), 500

        print(f"← Claude responded ({len(text)} chars)")

        # Strip markdown fences
        clean = re.sub(r"```json|```", "", text).strip()

        # Try parsing directly
        try:
            parsed = json.loads(clean)
            workouts = parsed if isinstance(parsed, list) else parsed.get("workouts") or parsed.get("plan")
        except json.JSONDecodeError:
            match = re.search(r"\[[\s\S]*\]", clean)
            if not match:
                print("Could not find JSON array. Full response:")
                print(text)
                return jsonify({ "error": "Could not extract workout array" }), 500
            workouts = json.loads(match.group())

        print(f"✓ Parsed {len(workouts)} workouts successfully")
        return jsonify({ "workouts": workouts })

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({ "error": str(e) }), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    app.run(host="0.0.0.0", port=port)
