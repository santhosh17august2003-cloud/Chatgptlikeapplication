import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
print(f"Loaded API Key: '{api_key[:10]}...' (Length: {len(api_key)})")

genai.configure(api_key=api_key)

try:
    print("\nTesting chat completion with gemini-2.5-flash...")
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content("Say hello in one word.")
    print(f"Response: {response.text}")

    print("\nTesting embedding with models/gemini-embedding-001...")
    emb_res = genai.embed_content(
        model="models/gemini-embedding-001",
        content="Hello World"
    )
    # Check if the result is a dict with 'embedding' key
    embedding = emb_res['embedding']
    print(f"Embedding type: {type(embedding)}")
    print(f"Embedding length: {len(embedding)}")
    
except Exception as e:
    print(f"\nERROR OCCURRED:\n{e}")
