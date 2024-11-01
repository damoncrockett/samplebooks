from flask import Flask, jsonify, request, make_response
import os
import psycopg2
from psycopg2.extras import DictCursor
from datetime import datetime
from dotenv import load_dotenv
from functools import wraps
import hashlib
from datetime import timedelta

load_dotenv()

app = Flask(__name__)

app.config['PASSWORD_HASH'] = os.environ.get('PASSWORD_HASH')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_cookie = request.cookies.get('auth_token')
        print("Received auth cookie:", auth_cookie)  # Debug log
        print("Expected secret key:", app.config['SECRET_KEY'])  # Debug log
        if not auth_cookie or auth_cookie != app.config['SECRET_KEY']:
            print("Auth failed")  # Debug log
            return jsonify({"error": "Unauthorized"}), 401
        print("Auth successful")  # Debug log
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    password = data.get('password', '')
    
    # Hash the provided password
    hashed = hashlib.sha256(password.encode()).hexdigest()
    
    print("Received hash:", hashed)  # Debug log
    print("Stored hash:", app.config['PASSWORD_HASH'])  # Debug log
    print("Match?", hashed == app.config['PASSWORD_HASH'])  # Debug log
    
    if hashed == app.config['PASSWORD_HASH']:
        response = make_response(jsonify({"status": "success"}))
        
        # Set cookie that expires in 30 days
        response.set_cookie(
            'auth_token', 
            app.config['SECRET_KEY'],
            max_age=timedelta(days=30),
            secure=True,
            httponly=True,
            samesite='Strict'
        )
        return response
    
    return jsonify({"status": "error", "message": "Invalid password"}), 401

# CORS settings
ALLOWED_ORIGINS = [
    'http://localhost:8080',  # Development
    'http://samplebook.photos',  # Production domain HTTP
    'https://samplebook.photos',  # Production domain HTTPS
    'https://fierce-earth-72469-f6228ef670f9.herokuapp.com'  # Heroku domain
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

@app.route('/api/submit_judgment', methods=['OPTIONS'])
def submit_judgment_preflight():
    response = make_response()
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'POST,OPTIONS'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

def get_db_connection():
    database_url = os.environ.get('DATABASE_URL')
    if database_url and database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    return psycopg2.connect(database_url)

def init_db():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Create new matchups table
            cur.execute('''
                CREATE TABLE IF NOT EXISTS matchups (
                    id SERIAL PRIMARY KEY,
                    image_path TEXT NOT NULL,
                    selected_model TEXT NOT NULL,
                    other_model TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        conn.commit()

def record_judgment(image_path, selected_model, other_model):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('''
                INSERT INTO matchups (image_path, selected_model, other_model)
                VALUES (%s, %s, %s)
            ''', (image_path, selected_model, other_model))
        conn.commit()

# Initialize database when app starts
try:
    init_db()
except Exception as e:
    print(f"Error initializing database: {e}")

@app.route('/api/submit_judgment', methods=['POST', 'OPTIONS'])
@login_required
def submit_judgment():
    if request.method == 'OPTIONS':
        return jsonify({"status": "success"})
        
    data = request.json
    image_path = data.get('imgPath')
    selected_model = data.get('selectedModel')
    other_model = data.get('otherModel')
    
    if not all([image_path, selected_model, other_model]):
        return jsonify({
            "status": "error",
            "message": "Missing required fields"
        }), 400
    
    try:
        record_judgment(image_path, selected_model, other_model)
        
        print(f"Recorded matchup - Image: {image_path}, Winner: {selected_model}, Other: {other_model}")
        
        return jsonify({
            "status": "success",
            "message": "Matchup recorded",
            "data": {
                "image_path": image_path,
                "selected_model": selected_model,
                "other_model": other_model
            }
        })
    except Exception as e:
        print(f"Error recording matchup: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to record matchup"
        }), 500

@app.route('/api/stats', methods=['GET'])
@login_required
def get_stats():
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=DictCursor) as cur:
                # Get overall win counts for each model
                cur.execute('''
                    SELECT 
                        selected_model as model,
                        COUNT(*) as wins,
                        (
                            SELECT COUNT(*)
                            FROM matchups j2
                            WHERE j2.other_model = j1.selected_model
                        ) as losses
                    FROM matchups j1
                    GROUP BY selected_model
                    ORDER BY wins DESC
                ''')
                model_stats = cur.fetchall()
                
                # Get head-to-head stats
                cur.execute('''
                    WITH matchups_summary AS (
                        SELECT 
                            LEAST(selected_model, other_model) as model1,
                            GREATEST(selected_model, other_model) as model2,
                            CASE 
                                WHEN selected_model = LEAST(selected_model, other_model) THEN 1
                                ELSE 0
                            END as model1_won
                        FROM matchups
                    )
                    SELECT 
                        model1,
                        model2,
                        SUM(model1_won) as model1_wins,
                        COUNT(*) - SUM(model1_won) as model2_wins,
                        COUNT(*) as total_matches
                    FROM matchups_summary
                    GROUP BY model1, model2
                    ORDER BY total_matches DESC, model1
                ''')
                matchup_stats = cur.fetchall()
                
                # Get total number of matchups judged
                cur.execute('SELECT COUNT(*) as total FROM matchups')
                total_matchups = cur.fetchone()['total']
                
                return jsonify({
                    "total_matchups": total_matchups,
                    "overall_stats": [
                        {
                            "model": row['model'],
                            "wins": row['wins'],
                            "losses": row['losses'],
                            "win_rate": round(row['wins'] / (row['wins'] + row['losses']) * 100, 1)
                            if (row['wins'] + row['losses']) > 0 else 0
                        }
                        for row in model_stats
                    ],
                    "matchup_stats": [
                        {
                            "model1": row['model1'],
                            "model2": row['model2'],
                            "model1_wins": row['model1_wins'],
                            "model2_wins": row['model2_wins'],
                            "total_matches": row['total_matches']
                        }
                        for row in matchup_stats
                    ]
                })
    except Exception as e:
        print(f"Error fetching stats: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to fetch stats"
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=3001)