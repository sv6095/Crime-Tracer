
# Test the API endpoint directly
import requests

# Get a cop token first (you'll need to login)
# For now, let's just test if the endpoint responds

url = "http://localhost:8000/api/cases/station-complaints?status_filter=Filed&limit=50"

# You need to replace this with an actual token
# Get it from browser localStorage: localStorage.getItem('auth-token')
token = "YOUR_TOKEN_HERE"

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

try:
    response = requests.get(url, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
