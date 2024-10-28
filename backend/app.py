from flask import Flask, jsonify, request, make_response
import os
import psycopg2
from psycopg2.extras import DictCursor
from datetime import datetime

app = Flask(__name__)

# CORS settings
ALLOWED_ORIGINS = [
    'http://localhost:8080',  # Development
    'http://samplebook.photos',  # Production domain HTTP
    'https://samplebook.photos'  # Production domain HTTPS
]

@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin:
        if origin in ALLOWED_ORIGINS:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
        else:
            print(f"Rejected CORS request from origin: {origin}")
    return response

def get_db_connection():
    # In development, you can set DATABASE_URL in your environment
    # In production, Heroku sets this automatically
    database_url = os.environ.get('DATABASE_URL')
    
    # Heroku's newer DATABASE_URLs start with postgres://, but psycopg2 wants postgresql://
    if database_url and database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    
    return psycopg2.connect(database_url)

def init_db():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('''
                CREATE TABLE IF NOT EXISTS judgments (
                    id SERIAL PRIMARY KEY,
                    image_path TEXT NOT NULL,
                    selected_model TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        conn.commit()

def record_judgment(image_path, selected_model):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('''
                INSERT INTO judgments (image_path, selected_model)
                VALUES (%s, %s)
            ''', (image_path, selected_model))
        conn.commit()

# Initialize database when app starts
try:
    init_db()
except Exception as e:
    print(f"Error initializing database: {e}")

@app.route('/api/submit_judgment', methods=['POST', 'OPTIONS'])
def submit_judgment():
    if request.method == 'OPTIONS':
        return jsonify({"status": "success"})
        
    data = request.json
    image_path = data.get('imgPath')
    caption_choice = data.get('selectedCaption')
    
    # Map caption choice to model
    selected_model = 'Model A' if caption_choice == 'Caption A' else 'Model B'
    
    try:
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
    except Exception as e:
        print(f"Error recording judgment: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to record judgment"
        }), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=DictCursor) as cur:
                cur.execute('''
                    SELECT 
                        image_path,
                        selected_model,
                        COUNT(*) as count
                    FROM judgments
                    GROUP BY image_path, selected_model
                    ORDER BY image_path, selected_model
                ''')
                rows = cur.fetchall()
                
                stats = {}
                for row in rows:
                    img_path = row['image_path']
                    model = row['selected_model']
                    count = row['count']
                    if img_path not in stats:
                        stats[img_path] = {}
                    stats[img_path][model] = count
                
                return jsonify(stats)
    except Exception as e:
        print(f"Error fetching stats: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to fetch stats"
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=3001)