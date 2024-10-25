from flask import Flask, jsonify, request, make_response
import sqlite3
from datetime import datetime
import os

app = Flask(__name__)

ALLOWED_ORIGINS = [
    'http://localhost:8080',  # Development
    'http://samplebook.photos.s3-website-us-east-1.amazonaws.com',  # Production S3 website
    'http://samplebook.photos'  # Production domain
]

@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin:  # If there's an origin header
        # Check if the origin is in our allowed list
        if origin in ALLOWED_ORIGINS:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
        else:
            print(f"Rejected CORS request from origin: {origin}")  # For debugging
    return response

# Database setup
DB_PATH = 'judgments.db'

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS judgments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_path TEXT NOT NULL,
                selected_model TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()

def record_judgment(image_path, selected_model):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO judgments (image_path, selected_model)
            VALUES (?, ?)
        ''', (image_path, selected_model))
        conn.commit()

# Initialize database when app starts
init_db()

@app.route('/api/submit_judgment', methods=['POST', 'OPTIONS'])
def submit_judgment():
    if request.method == 'OPTIONS':
        return jsonify({"status": "success"})
        
    data = request.json
    image_path = data.get('imgPath')
    caption_choice = data.get('selectedCaption')
    
    # Map caption choice to model
    selected_model = 'Model A' if caption_choice == 'Caption A' else 'Model B'
    
    # Record the judgment
    record_judgment(image_path, selected_model)
    
    print(f"Recorded judgment - Image: {image_path}, Model: {selected_model}")
    
    return jsonify({
        "status": "success",
        "message": "Judgment recorded",
        "data": {
            "image_path": image_path,
            "selected_model": selected_model
        }
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT 
                image_path,
                selected_model,
                COUNT(*) as count
            FROM judgments
            GROUP BY image_path, selected_model
            ORDER BY image_path, selected_model
        ''')
        rows = cursor.fetchall()
        
        stats = {}
        for row in rows:
            img_path, model, count = row
            if img_path not in stats:
                stats[img_path] = {}
            stats[img_path][model] = count
            
        return jsonify(stats)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=3001)