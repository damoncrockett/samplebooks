from flask import Flask, jsonify, request, make_response
import os
import psycopg2
from psycopg2.extras import DictCursor
from datetime import datetime, timedelta
from dotenv import load_dotenv
from functools import wraps
import hashlib
import json

load_dotenv()

app = Flask(__name__)

app.config['PASSWORD_HASH'] = os.environ.get('PASSWORD_HASH')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
image_paths_file = os.path.join(BASE_DIR, 'impaths_all.json')

try:
    with open('../src/assets/json/impaths_all.json', 'r') as f: # dev
        image_paths = json.load(f)
except:
    try:
        with open(image_paths_file, 'r') as f: # prod
            image_paths = json.load(f)
    except Exception as e:
        print(f"Error loading image paths: {e}")
        image_paths = []

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_cookie = request.cookies.get('auth_token')
        if not auth_cookie or auth_cookie != app.config['SECRET_KEY']:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    password = data.get('password', '')
    
    hashed = hashlib.sha256(password.encode()).hexdigest()
    
    if hashed == app.config['PASSWORD_HASH']:
        response = make_response(jsonify({"status": "success"}))
        response.set_cookie(
            'auth_token', 
            app.config['SECRET_KEY'],
            max_age=timedelta(days=30),
            secure=True,
            httponly=True,
            samesite='None',
            path='/',
            domain='fierce-earth-72469-f6228ef670f9.herokuapp.com'
        )
        return response

    return jsonify({"status": "error", "message": "Invalid password"}), 401

ALLOWED_ORIGINS = [
    'http://localhost:8080',
    'http://samplebook.photos',
    'https://samplebook.photos',
    'https://fierce-earth-72469-f6228ef670f9.herokuapp.com'
]

@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin and origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Vary'] = 'Origin'
    return response

def get_db_connection():
    database_url = os.environ.get('DATABASE_URL')
    if database_url and database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    return psycopg2.connect(database_url)

def init_db():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Check if table exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'crop_coordinates'
                )
            """)
            table_exists = cur.fetchone()[0]

            if not table_exists:
                # Create crop_coordinates table with is_saved column
                cur.execute('''
                    CREATE TABLE crop_coordinates (
                        id SERIAL PRIMARY KEY,
                        image_path TEXT NOT NULL,
                        x FLOAT NOT NULL,
                        y FLOAT NOT NULL,
                        width FLOAT NOT NULL,
                        height FLOAT NOT NULL,
                        is_saved BOOLEAN DEFAULT FALSE,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(image_path)
                    )
                ''')
                print("Created crop_coordinates table")
            
            # Create image_positions table if it doesn't exist
            cur.execute("""
                CREATE TABLE IF NOT EXISTS image_positions (
                    id SERIAL PRIMARY KEY,
                    current_position INTEGER NOT NULL DEFAULT 0,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Insert initial position if table is empty
            cur.execute('SELECT COUNT(*) FROM image_positions')
            if cur.fetchone()[0] == 0:
                cur.execute('INSERT INTO image_positions (current_position) VALUES (0)')
            
            conn.commit()

def drop_tables():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('DROP TABLE IF EXISTS crop_coordinates')
            cur.execute('DROP TABLE IF EXISTS image_positions')
            conn.commit()
            print("Tables dropped")

# Initialize database when app starts
try:
    init_db()
except Exception as e:
    print(f"Error initializing database: {e}")

@app.route('/api/crop_coordinates/<path:image_path>', methods=['GET'])
@login_required
def get_crop_coordinates(image_path):
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=DictCursor) as cur:
                cur.execute('''
                    SELECT x, y, width, height, is_saved
                    FROM crop_coordinates 
                    WHERE image_path = %s
                ''', (image_path,))
                
                result = cur.fetchone()
                
                if result:
                    coordinates = {
                        'x': float(result['x']),
                        'y': float(result['y']),
                        'width': float(result['width']),
                        'height': float(result['height']),
                        'is_saved': result['is_saved']
                    }
                    return jsonify({"coordinates": coordinates})
                else:
                    return jsonify({"coordinates": None}), 404
                    
    except Exception as e:
        print(f"Error fetching crop coordinates: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to fetch crop coordinates"
        }), 500

@app.route('/api/save_crop/<path:image_path>', methods=['POST'])
@login_required
def save_crop(image_path):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:

                data = request.json
                coordinates = data.get('coordinates')
                
                if not coordinates or not all(k in coordinates for k in ['x', 'y', 'width', 'height']):
                    return jsonify({
                        "status": "error",
                        "message": "Missing or invalid coordinates"
                    }), 400

                # Insert/update coordinates and mark as saved in one operation
                cur.execute('''
                    INSERT INTO crop_coordinates 
                        (image_path, x, y, width, height, is_saved)
                    VALUES (%s, %s, %s, %s, %s, TRUE)
                    ON CONFLICT (image_path) 
                    DO UPDATE SET 
                        x = EXCLUDED.x,
                        y = EXCLUDED.y,
                        width = EXCLUDED.width,
                        height = EXCLUDED.height,
                        is_saved = TRUE,
                        timestamp = CURRENT_TIMESTAMP
                ''', (
                    image_path,
                    coordinates['x'],
                    coordinates['y'],
                    coordinates['width'],
                    coordinates['height']
                ))
                
            conn.commit()
            
        return jsonify({
            "status": "success",
            "message": "Crop coordinates saved"
        })
    except Exception as e:
        print(f"Error saving crop: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to save crop"
        }), 500

@app.route('/api/current_position', methods=['GET'])
@login_required
def get_current_position():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT current_position FROM image_positions ORDER BY timestamp DESC LIMIT 1')
                position = cur.fetchone()[0]
                return jsonify({"current_position": position})
    except Exception as e:
        print(f"Error fetching position: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to fetch position"
        }), 500

@app.route('/api/update_position', methods=['POST'])
@login_required
def update_position():
    data = request.json
    new_position = data.get('position')
    
    if new_position is None:
        return jsonify({
            "status": "error",
            "message": "Missing position"
        }), 400
    
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    INSERT INTO image_positions (current_position)
                    VALUES (%s)
                ''', (new_position,))
            conn.commit()
            
        return jsonify({
            "status": "success",
            "message": "Position updated",
            "position": new_position
        })
    except Exception as e:
        print(f"Error updating position: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to update position"
        }), 500

@app.route('/api/stats/<int:current_index>', methods=['GET'])
@login_required
def get_stats(current_index):
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=DictCursor) as cur:
                # Count unsaved images before current position
                cur.execute('''
                    WITH numbered_paths AS (
                        SELECT path, idx 
                        FROM unnest(%s::text[]) WITH ORDINALITY AS t(path, idx)
                    )
                    SELECT COUNT(*) as count_before
                    FROM numbered_paths np
                    LEFT JOIN crop_coordinates cc ON cc.image_path = np.path
                    WHERE np.idx - 1 < %s 
                    AND (cc.id IS NULL OR NOT cc.is_saved)
                ''', (image_paths, current_index))
                unsaved_before = cur.fetchone()['count_before']

                # Count unsaved images after current position
                cur.execute('''
                    WITH numbered_paths AS (
                        SELECT path, idx 
                        FROM unnest(%s::text[]) WITH ORDINALITY AS t(path, idx)
                    )
                    SELECT COUNT(*) as count_after
                    FROM numbered_paths np
                    LEFT JOIN crop_coordinates cc ON cc.image_path = np.path
                    WHERE np.idx - 1 > %s 
                    AND (cc.id IS NULL OR NOT cc.is_saved)
                ''', (image_paths, current_index))
                unsaved_after = cur.fetchone()['count_after']
                
                return jsonify({
                    "unsaved_before": unsaved_before,
                    "unsaved_after": unsaved_after
                })
    except Exception as e:
        print(f"Error fetching stats: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to fetch stats"
        }), 500

@app.route('/api/next_unsaved/<int:current_index>/<path:direction>', methods=['GET'])
@login_required
def get_next_unsaved(current_index, direction):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if direction == 'forward':
                    # Find next unsaved image after current_index
                    cur.execute('''
                        WITH numbered_paths AS (
                            SELECT path, idx 
                            FROM unnest(%s::text[]) WITH ORDINALITY AS t(path, idx)
                        )
                        SELECT np.idx - 1 as next_index
                        FROM numbered_paths np
                        LEFT JOIN crop_coordinates cc ON cc.image_path = np.path
                        WHERE np.idx - 1 > %s 
                        AND (cc.id IS NULL OR NOT cc.is_saved)
                        ORDER BY np.idx
                        LIMIT 1
                    ''', (image_paths, current_index))
                else:
                    # Find previous unsaved image before current_index
                    cur.execute('''
                        WITH numbered_paths AS (
                            SELECT path, idx 
                            FROM unnest(%s::text[]) WITH ORDINALITY AS t(path, idx)
                        )
                        SELECT np.idx - 1 as next_index
                        FROM numbered_paths np
                        LEFT JOIN crop_coordinates cc ON cc.image_path = np.path
                        WHERE np.idx - 1 < %s 
                        AND (cc.id IS NULL OR NOT cc.is_saved)
                        ORDER BY np.idx DESC
                        LIMIT 1
                    ''', (image_paths, current_index))

                result = cur.fetchone()
                next_index = result[0] if result and result[0] is not None else None
                
                if next_index is None and direction == 'forward':
                    # If no unsaved images after current, wrap to start
                    cur.execute('''
                        WITH numbered_paths AS (
                            SELECT path, idx 
                            FROM unnest(%s::text[]) WITH ORDINALITY AS t(path, idx)
                        )
                        SELECT np.idx - 1 as next_index
                        FROM numbered_paths np
                        LEFT JOIN crop_coordinates cc ON cc.image_path = np.path
                        WHERE (cc.id IS NULL OR NOT cc.is_saved)
                        ORDER BY np.idx
                        LIMIT 1
                    ''', (image_paths,))
                    result = cur.fetchone()
                    next_index = result[0] if result and result[0] is not None else current_index
                elif next_index is None and direction == 'backward':
                    # If no unsaved images before current, wrap to end
                    cur.execute('''
                        WITH numbered_paths AS (
                            SELECT path, idx 
                            FROM unnest(%s::text[]) WITH ORDINALITY AS t(path, idx)
                        )
                        SELECT np.idx - 1 as next_index
                        FROM numbered_paths np
                        LEFT JOIN crop_coordinates cc ON cc.image_path = np.path
                        WHERE (cc.id IS NULL OR NOT cc.is_saved)
                        ORDER BY np.idx DESC
                        LIMIT 1
                    ''', (image_paths,))
                    result = cur.fetchone()
                    next_index = result[0] if result and result[0] is not None else current_index

                return jsonify({"next_index": next_index})
                
    except Exception as e:
        print(f"Error finding next unsaved: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to find next unsaved"
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=3001)