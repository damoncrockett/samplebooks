from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/submit_judgment": {"origins": "http://samplebook.photos.s3-website-us-east-1.amazonaws.com"}})


# Your routes and logic here

if __name__ == '__main__':
    app.run()