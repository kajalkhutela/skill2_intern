from flask import Flask, jsonify, request, send_from_directory, abort, redirect, url_for, session, flash
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from datetime import datetime, date
import pandas as pd
import os
import re
from difflib import SequenceMatcher
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import json
import uuid
from groq import Groq

# Import the resume parser module
import sys
sys.path.insert(0, os.path.dirname(__file__))
try:
    from resume_parser import parse_resume, map_to_skill_categories
    RESUME_PARSER_AVAILABLE = True
except ImportError:
    RESUME_PARSER_AVAILABLE = False
    print("Warning: Resume parser not available. Install PyMuPDF and spaCy.")

app = Flask(__name__)
app.secret_key = 'skill2intern_secret_key_2024'  # Change this in production

# Configure file upload
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
ALLOWED_EXTENSIONS = {'pdf'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# User data storage (in production, use a database)
USERS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'users.json')
SEARCHES_FILE = os.path.join(os.path.dirname(__file__), 'data', 'saved_searches.json')
USER_APPLICATIONS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'user_applications.json')

class User(UserMixin):
    def __init__(self, id, email, password_hash, name='', skills='', city='', job_type_preference=''):
        self.id = id
        self.email = email
        self.password_hash = password_hash
        self.name = name
        self.skills = skills
        self.city = city
        self.job_type_preference = job_type_preference

@login_manager.user_loader
def load_user(user_id):
    users = _read_json_file(USERS_FILE)
    user_data = next((u for u in users if u['id'] == user_id), None)
    if user_data:
        return User(
            id=user_data['id'],
            email=user_data['email'],
            password_hash=user_data['password_hash'],
            name=user_data.get('name', ''),
            skills=user_data.get('skills', ''),
            city=user_data.get('city', ''),
            job_type_preference=user_data.get('job_type_preference', '')
        )
    return None

# Enable CORS for local development
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Load dataset (path relative to this file)
csv_path = os.path.join(os.path.dirname(__file__), "data", "internships.csv")
df = pd.read_csv(csv_path)

# Frontend directory (sibling folder)
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))

# Normalize column names to snake_case for predictable access
df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]

# Drop any unnamed/index columns that pandas may have created
df = df.loc[:, ~df.columns.str.startswith('unnamed')]

def _parse_stipend(s):
    if pd.isna(s):
        return 0
    s = str(s).lower()
    if 'unpaid' in s or s.strip() == '':
        return 0
    m = re.search(r"(\d[\d,]*)", s)
    if not m:
        return 0
    try:
        return int(m.group(1).replace(',', ''))
    except ValueError:
        return 0

# Create numeric stipend column for comparisons
if 'stipend' in df.columns:
    df['stipend_amount'] = df['stipend'].apply(_parse_stipend)
else:
    df['stipend_amount'] = 0

# (No cached cities list — city lists are derived on-demand from the dataset)

# Skill mapping for internships
SKILL_KEYWORDS = {
    'Software Development': ['development', 'developer', 'coding', 'programming', 'backend', 'frontend', 'full stack', 'engineer', 'java', 'python', 'javascript', 'c++'],
    'Data Science': ['data', 'analytics', 'analysis', 'scientist', 'ml', 'machine learning', 'statistical', 'python', 'r programming'],
    'AI / ML': ['ai', 'artificial intelligence', 'ml', 'machine learning', 'neural', 'deep learning', 'nlp', 'computer vision'],
    'Web Development': ['web', 'frontend', 'react', 'angular', 'html', 'css', 'javascript', 'wordpress', 'ui/ux'],
    'Marketing': ['marketing', 'digital marketing', 'social media', 'content', 'brand', 'campaign', 'seo', 'advertising'],
    'Design': ['design', 'ui', 'ux', 'graphic', 'creative', 'visual', 'figma', 'adobe']
}

def _similarity_score(str1, str2):
    """Calculate similarity between two strings (0-1)"""
    if not str1 or not str2:
        return 0
    return SequenceMatcher(None, str(str1).lower(), str(str2).lower()).ratio()

def _match_score(job_title, user_skills, city, user_city, job_type, user_job_type):
    """Calculate how well a job matches user preferences (0-100)"""
    score = 0

    # Skill matching (60% weight) - Enhanced with better keyword matching
    if job_title and user_skills and len(user_skills) > 0:
        job_title_lower = str(job_title).lower()
        skill_score = 0
        total_weight = 0

        for skill in user_skills:
            keywords = SKILL_KEYWORDS.get(skill, [skill.lower()])
            skill_weight = 1.0  # Base weight for each skill

            # Check for exact keyword matches (highest priority)
            exact_matches = sum(1 for keyword in keywords if keyword.lower() in job_title_lower)
            if exact_matches > 0:
                skill_score += 100 * skill_weight
                total_weight += skill_weight
                continue

            # Check for partial/semantic similarity matches
            max_sim = 0
            for keyword in keywords:
                sim = _similarity_score(job_title_lower, keyword.lower())
                max_sim = max(max_sim, sim)

            if max_sim > 0.6:  # Higher threshold for similarity
                skill_score += max_sim * 80 * skill_weight
                total_weight += skill_weight
            elif max_sim > 0.4:  # Lower threshold for partial matches
                skill_score += max_sim * 40 * skill_weight
                total_weight += skill_weight * 0.5

        # Normalize skill score
        if total_weight > 0:
            skill_score = min(100, skill_score / total_weight)
        else:
            skill_score = 20  # Base score when no skills match

        score += skill_score * 0.4  # 40% weight
    else:
        # If no user skills, give a moderate default match score
        score += 40 * 0.4  # 40% weight

    # City matching (40% weight) - Prioritize exact matches
    if city and user_city and str(city).lower().strip() == str(user_city).lower().strip():
        score += 40
    elif city and user_city and _similarity_score(str(city).lower(), str(user_city).lower()) > 0.8:
        score += 24  # Partial city match (60% of full city score)

    # Job type matching (20% weight) - Exact match only
    if job_type and user_job_type and str(job_type).lower().strip() == str(user_job_type).lower().strip():
        score += 20

    return min(100, score)


@app.route("/internships", methods=["GET"])
def get_internships():
    """
    Get internships with smart filtering and skill matching
    Query params:
    - city: Filter by city
    - type: Filter by job type (comma-separated for multiple)
    - skills: User skills (comma-separated for skill matching)
    - stipend: Minimum stipend
    - duration: Filter by duration
    """
    city_q = request.args.get("city", "").strip()
    job_type_q = request.args.get("job_type", "").strip() or request.args.get("type", "").strip()
    skills_q = request.args.get("skills", "").strip()
    min_stipend = request.args.get("stipend", "0").strip()
    duration_q = request.args.get("duration", "").strip()
    
    # Parse skills
    user_skills = [s.strip() for s in skills_q.split(",") if s.strip()] if skills_q else []
    
    filtered = df.copy()

    cols = set(filtered.columns)
    # Common CSV column names after normalization
    job_title_col = 'job_title' if 'job_title' in cols else ( 'job' if 'job' in cols else None)
    job_type_col = 'job_type' if 'job_type' in cols else None
    company_col = 'company_name' if 'company_name' in cols else ( 'company' if 'company' in cols else None)
    city_col = 'cities' if 'cities' in cols else ('city' if 'city' in cols else None)
    state_col = 'states' if 'states' in cols else ('state' if 'state' in cols else None)
    duration_col = 'duration' if 'duration' in cols else None
    late_date_col = None
    for candidate in ('late_date_to_apply', 'last_date_to_apply', 'late_date', 'last_date'):
        if candidate in cols:
            late_date_col = candidate
            break

    # Filters - Exact case-insensitive matches for better precision
    if city_q and city_col:
        filtered = filtered[filtered[city_col].astype(str).str.lower().str.strip() == str(city_q).lower().strip()]

    if job_type_q and job_type_col:
        filtered = filtered[filtered[job_type_col].astype(str).str.lower().str.strip() == str(job_type_q).lower().strip()]

    if min_stipend and min_stipend != "0":
        try:
            min_val = int(min_stipend)
            filtered = filtered[filtered['stipend_amount'] >= min_val]
        except Exception:
            pass

    if duration_q and duration_col:
        filtered = filtered[filtered[duration_col].astype(str).str.contains(str(duration_q), case=False, na=False)]

    # Compute days left from the late/apply date if available
    def _compute_days_left(val):
        if pd.isna(val):
            return None
        s = str(val).strip()
        if s == "":
            return None
        for fmt in ("%d-%m-%Y", "%d-%m-%y", "%Y-%m-%d"):
            try:
                d = datetime.strptime(s, fmt).date()
                return (d - date.today()).days
            except Exception:
                continue
        return None

    if late_date_col:
        filtered['days_left'] = filtered[late_date_col].apply(_compute_days_left)
    else:
        filtered['days_left'] = None
    
    # Calculate overall match score (skills, city, job type)
    if job_title_col:
        filtered['skill_match_score'] = filtered.apply(
            lambda row: _match_score(
                row[job_title_col],
                user_skills,
                row[city_col] if city_col else None,
                city_q,
                row[job_type_col] if job_type_col else None,
                job_type_q
            ),
            axis=1
        )
    else:
        filtered['skill_match_score'] = 0

    # Prepare output mapping to stable keys expected by the frontend
    out_cols = {}
    if job_title_col:
        out_cols[job_title_col] = 'job_title'
    if company_col:
        out_cols[company_col] = 'company_name'
    if city_col:
        out_cols[city_col] = 'city'
    if state_col:
        out_cols[state_col] = 'state'
    out_cols['stipend_amount'] = 'stipend'
    if duration_col:
        out_cols[duration_col] = 'duration'
    if job_type_col:
        out_cols[job_type_col] = 'job_type'
    out_cols['days_left'] = 'days_left'
    out_cols['skill_match_score'] = 'skill_match_score'

    # Ensure we only select existing columns
    select_cols = [c for c in out_cols.keys() if c in filtered.columns]
    # Rename to stable keys
    result = filtered[select_cols].rename(columns=out_cols)
    
    # Filter to only show well-matched internships (score > 20), then sort and limit to top 50
    result = result[result['skill_match_score'] > 20]
    result = result.sort_values(
        by=['skill_match_score', 'stipend'],
        ascending=[False, False]
    ).head(50)
    
    # Replace NaN with None for JSON
    result = result.where(pd.notnull(result), None)

    return jsonify(result.to_dict(orient="records"))


# Get list of all cities from internships
@app.route("/cities", methods=["GET"])
def get_cities():
    """Return list of all unique cities from internships"""
    cols = set(df.columns)
    city_col = 'cities' if 'cities' in cols else ('city' if 'city' in cols else None)
    
    if not city_col or city_col not in df.columns:
        return jsonify([])
    
    cities = sorted(df[city_col].dropna().unique().tolist())
    return jsonify(cities)


# Get list of all job types from internships
@app.route("/job-types", methods=["GET"])
def get_job_types():
    """Return list of all unique job types from internships"""
    cols = set(df.columns)
    job_type_col = 'job_type' if 'job_type' in cols else None
    
    if not job_type_col or job_type_col not in df.columns:
        return jsonify([])
    
    job_types = sorted(df[job_type_col].dropna().unique().tolist())
    return jsonify(job_types)


# -----------------------------------------
# Projects & Applications simple JSON API
# -----------------------------------------
PROJECTS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'projects.json')
APPLICATIONS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'applications.json')

def _read_json_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []

def _write_json_file(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@app.route('/api/projects', methods=['GET', 'POST'])
def projects_handler():
    if request.method == 'GET':
        data = _read_json_file(PROJECTS_FILE)
        return jsonify(data)

    # POST
    try:
        payload = request.get_json() or {}
        title = payload.get('title')
        url = payload.get('url')
        description = payload.get('description', '')
        tags = payload.get('tags', [])
        if not title or not url:
            return jsonify({'error': 'title and url required'}), 400

        projects = _read_json_file(PROJECTS_FILE)
        new = {
            'id': str(uuid.uuid4()),
            'title': title,
            'url': url,
            'description': description,
            'tags': tags,
            'addedAt': datetime.utcnow().isoformat() + 'Z'
        }
        projects.insert(0, new)
        _write_json_file(PROJECTS_FILE, projects)
        return jsonify(new), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/applications', methods=['GET', 'POST'])
def applications_handler():
    if request.method == 'GET':
        data = _read_json_file(APPLICATIONS_FILE)
        return jsonify(data)

    try:
        payload = request.get_json() or {}
        applications = _read_json_file(APPLICATIONS_FILE)
        payload['id'] = str(uuid.uuid4())
        payload['receivedAt'] = datetime.utcnow().isoformat() + 'Z'
        applications.insert(0, payload)
        _write_json_file(APPLICATIONS_FILE, applications)
        return jsonify({'status': 'ok', 'id': payload['id']}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Note: explicit /cities endpoint removed — frontend derives cities from internships data when needed.


def allowed_file(filename):
    """Check if file has allowed extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/upload-resume', methods=['POST'])
def upload_resume():
    """
    Upload and parse resume PDF to extract skills
    Returns extracted skills, education, and projects
    """
    if not RESUME_PARSER_AVAILABLE:
        return jsonify({
            "success": False,
            "error": "Resume parser not configured. Install PyMuPDF: pip install PyMuPDF spacy"
        }), 500
    
    # Check if file is in request
    if 'resume' not in request.files:
        return jsonify({
            "success": False,
            "error": "No file part in request"
        }), 400
    
    file = request.files['resume']
    
    if file.filename == '':
        return jsonify({
            "success": False,
            "error": "No file selected"
        }), 400
    
    if not allowed_file(file.filename):
        return jsonify({
            "success": False,
            "error": "Only PDF files are allowed"
        }), 400
    
    try:
        # Save uploaded file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Parse resume
        result = parse_resume(filepath)
        
        # Clean up - delete uploaded file after parsing
        os.remove(filepath)
        
        if result['success']:
            # Map extracted skills to predefined categories
            matched_categories = map_to_skill_categories(result['skills'])
            
            return jsonify({
                "success": True,
                "skills": result['skills'][:20],  # Limit to top 20 skills
                "education": result['education'],
                "projects": result['projects'],
                "suggestedCategories": matched_categories,
                "skillCount": len(result['skills'])
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": result.get('error', 'Failed to parse resume')
            }), 400
            
    except Exception as e:
        print(f"Resume upload error: {e}")
        return jsonify({
            "success": False,
            "error": f"Error processing resume: {str(e)}"
        }), 500




# ==========================================
# USER AUTHENTICATION & PROFILE MANAGEMENT
# ==========================================

@app.route('/api/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        name = data.get('name', '').strip()

        if not email or not password:
            return jsonify({'success': False, 'error': 'Email and password required'}), 400

        # Check if user already exists
        users = _read_json_file(USERS_FILE)
        if any(u['email'] == email for u in users):
            return jsonify({'success': False, 'error': 'Email already registered'}), 400

        # Create new user
        user_id = str(uuid.uuid4())
        password_hash = generate_password_hash(password)

        new_user = {
            'id': user_id,
            'email': email,
            'password_hash': password_hash,
            'name': name,
            'skills': '',
            'city': '',
            'job_type_preference': '',
            'created_at': datetime.utcnow().isoformat() + 'Z'
        }

        users.append(new_user)
        _write_json_file(USERS_FILE, users)

        # Log in the user
        user_obj = User(
            id=user_id,
            email=email,
            password_hash=password_hash,
            name=name
        )
        login_user(user_obj)

        return jsonify({
            'success': True,
            'message': 'Registration successful',
            'user': {
                'id': user_id,
                'email': email,
                'name': name
            }
        }), 201

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/login', methods=['POST'])
def login():
    """Authenticate user login"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        password = data.get('password', '')

        if not email or not password:
            return jsonify({'success': False, 'error': 'Email and password required'}), 400

        users = _read_json_file(USERS_FILE)
        user_data = next((u for u in users if u['email'] == email), None)

        if not user_data or not check_password_hash(user_data['password_hash'], password):
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

        # Create user object and log in
        user_obj = User(
            id=user_data['id'],
            email=user_data['email'],
            password_hash=user_data['password_hash'],
            name=user_data.get('name', ''),
            skills=user_data.get('skills', ''),
            city=user_data.get('city', ''),
            job_type_preference=user_data.get('job_type_preference', '')
        )
        login_user(user_obj)

        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': {
                'id': user_data['id'],
                'email': user_data['email'],
                'name': user_data.get('name', ''),
                'skills': user_data.get('skills', ''),
                'city': user_data.get('city', ''),
                'job_type_preference': user_data.get('job_type_preference', '')
            }
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    """Log out current user"""
    logout_user()
    return jsonify({'success': True, 'message': 'Logged out successfully'}), 200


@app.route('/api/user/profile', methods=['GET', 'PUT'])
@login_required
def user_profile():
    """Get or update user profile"""
    if request.method == 'GET':
        return jsonify({
            'success': True,
            'user': {
                'id': current_user.id,
                'email': current_user.email,
                'name': current_user.name,
                'skills': current_user.skills,
                'city': current_user.city,
                'job_type_preference': current_user.job_type_preference
            }
        }), 200

    elif request.method == 'PUT':
        try:
            data = request.get_json()
            users = _read_json_file(USERS_FILE)

            # Find and update user
            for user in users:
                if user['id'] == current_user.id:
                    user['name'] = data.get('name', user.get('name', ''))
                    user['skills'] = data.get('skills', user.get('skills', ''))
                    user['city'] = data.get('city', user.get('city', ''))
                    user['job_type_preference'] = data.get('job_type_preference', user.get('job_type_preference', ''))
                    break

            _write_json_file(USERS_FILE, users)

            # Update current user object
            current_user.name = data.get('name', current_user.name)
            current_user.skills = data.get('skills', current_user.skills)
            current_user.city = data.get('city', current_user.city)
            current_user.job_type_preference = data.get('job_type_preference', current_user.job_type_preference)

            return jsonify({
                'success': True,
                'message': 'Profile updated successfully',
                'user': {
                    'id': current_user.id,
                    'email': current_user.email,
                    'name': current_user.name,
                    'skills': current_user.skills,
                    'city': current_user.city,
                    'job_type_preference': current_user.job_type_preference
                }
            }), 200

        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/user/saved-searches', methods=['GET', 'POST'])
@login_required
def saved_searches():
    """Get or save user search filters"""
    if request.method == 'GET':
        searches = _read_json_file(SEARCHES_FILE)
        user_searches = [s for s in searches if s.get('user_id') == current_user.id]
        return jsonify({'success': True, 'searches': user_searches}), 200

    elif request.method == 'POST':
        try:
            data = request.get_json()
            searches = _read_json_file(SEARCHES_FILE)

            new_search = {
                'id': str(uuid.uuid4()),
                'user_id': current_user.id,
                'name': data.get('name', 'Unnamed Search'),
                'filters': {
                    'city': data.get('city', ''),
                    'job_type': data.get('job_type', ''),
                    'skills': data.get('skills', ''),
                    'stipend': data.get('stipend', ''),
                    'duration': data.get('duration', '')
                },
                'created_at': datetime.utcnow().isoformat() + 'Z'
            }

            searches.append(new_search)
            _write_json_file(SEARCHES_FILE, searches)

            return jsonify({
                'success': True,
                'message': 'Search saved successfully',
                'search': new_search
            }), 201

        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/user/applications', methods=['GET', 'POST'])
@login_required
def user_applications():
    """Get or track user internship applications"""
    if request.method == 'GET':
        applications = _read_json_file(USER_APPLICATIONS_FILE)
        user_applications = [a for a in applications if a.get('user_id') == current_user.id]
        return jsonify({'success': True, 'applications': user_applications}), 200

    elif request.method == 'POST':
        try:
            data = request.get_json()
            applications = _read_json_file(USER_APPLICATIONS_FILE)

            new_application = {
                'id': str(uuid.uuid4()),
                'user_id': current_user.id,
                'internship_id': data.get('internship_id'),
                'job_title': data.get('job_title'),
                'company_name': data.get('company_name'),
                'status': 'applied',  # applied, interview, rejected, accepted
                'applied_date': datetime.utcnow().isoformat() + 'Z',
                'notes': data.get('notes', '')
            }

            applications.append(new_application)
            _write_json_file(USER_APPLICATIONS_FILE, applications)

            return jsonify({
                'success': True,
                'message': 'Application tracked successfully',
                'application': new_application
            }), 201

        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/user/dashboard', methods=['GET'])
@login_required
def user_dashboard():
    """Get personalized dashboard data for user"""
    try:
        # Get user's recent applications
        applications = _read_json_file(USER_APPLICATIONS_FILE)
        user_applications = [a for a in applications if a.get('user_id') == current_user.id]
        recent_applications = sorted(user_applications, key=lambda x: x.get('applied_date', ''), reverse=True)[:5]

        # Get personalized internship recommendations
        user_skills = [s.strip() for s in current_user.skills.split(',') if s.strip()] if current_user.skills else []
        user_city = current_user.city
        user_job_type = current_user.job_type_preference

        # Filter internships based on user preferences
        filtered = df.copy()
        cols = set(filtered.columns)
        job_title_col = 'job_title' if 'job_title' in cols else ('job' if 'job' in cols else None)
        job_type_col = 'job_type' if 'job_type' in cols else None
        city_col = 'cities' if 'cities' in cols else ('city' if 'city' in cols else None)

        # Apply user preferences
        if user_city and city_col:
            filtered = filtered[filtered[city_col].astype(str).str.lower().str.strip() == user_city.lower().strip()]

        if user_job_type and job_type_col:
            filtered = filtered[filtered[job_type_col].astype(str).str.lower().str.strip() == user_job_type.lower().strip()]

        # Calculate match scores
        if job_title_col and len(filtered) > 0:
            filtered['skill_match_score'] = filtered.apply(
                lambda row: _match_score(
                    row[job_title_col],
                    user_skills,
                    row[city_col] if city_col else None,
                    user_city,
                    row[job_type_col] if job_type_col else None,
                    user_job_type
                ),
                axis=1
            )

            # Get top recommendations
            recommendations = filtered[filtered['skill_match_score'] > 30]
            recommendations = recommendations.sort_values('skill_match_score', ascending=False).head(10)

            # Prepare output
            out_cols = {}
            if job_title_col:
                out_cols[job_title_col] = 'job_title'
            if 'company_name' in cols:
                out_cols['company_name'] = 'company_name'
            if city_col:
                out_cols[city_col] = 'city'
            out_cols['stipend_amount'] = 'stipend'
            if 'duration' in cols:
                out_cols['duration'] = 'duration'
            if job_type_col:
                out_cols[job_type_col] = 'job_type'
            out_cols['skill_match_score'] = 'skill_match_score'

            select_cols = [c for c in out_cols.keys() if c in recommendations.columns]
            recommendations = recommendations[select_cols].rename(columns=out_cols)
            recommendations = recommendations.where(pd.notnull(recommendations), None)
            recommendations_list = recommendations.to_dict(orient="records")
        else:
            recommendations_list = []

        return jsonify({
            'success': True,
            'dashboard': {
                'user': {
                    'id': current_user.id,
                    'email': current_user.email,
                    'name': current_user.name,
                    'skills': current_user.skills,
                    'city': current_user.city,
                    'job_type_preference': current_user.job_type_preference
                },
                'recent_applications': recent_applications,
                'recommendations': recommendations_list,
                'stats': {
                    'total_applications': len(user_applications),
                    'pending_applications': len([a for a in user_applications if a.get('status') == 'applied'])
                }
            }
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve frontend files from the sibling `frontend/` folder.

    If the requested file doesn't exist, return `index.html` so client-side
    routing continues to work and the browser doesn't receive a 404.
    """
    # If root requested, serve index.html directly
    if path == '' or path is None:
        return send_from_directory(FRONTEND_DIR, 'index.html')

    # Prevent directory traversal
    if '..' in path or path.startswith('/'):
        abort(404)

    target = os.path.join(FRONTEND_DIR, path)
    if os.path.exists(target) and os.path.isfile(target):
        return send_from_directory(FRONTEND_DIR, path)

    # Fallback to index.html for unknown paths (useful for SPA)
    return send_from_directory(FRONTEND_DIR, 'index.html')


# ==========================================
# HYBRID AI CHAT ASSISTANT
# ==========================================

@app.route('/api/chat', methods=['POST'])
@login_required
def chat_assistant():
    """Hybrid AI chat endpoint: Logic-first, then natural language generation"""
    try:
        data = request.get_json()
        question = data.get('question', '').strip().lower()

        if not question:
            return jsonify({'success': False, 'error': 'Question is required'}), 400

        # Get user profile
        user_skills = [s.strip() for s in current_user.skills.split(',') if s.strip()] if current_user.skills else []
        user_city = current_user.city
        user_job_type = current_user.job_type_preference

        # Intent detection using keywords
        intent = detect_intent(question)

        # Prepare facts using logic engine
        facts = prepare_facts(intent, user_skills, user_city, user_job_type)

        # Generate natural language response
        response = generate_response(intent, facts, question)

        return jsonify({
            'success': True,
            'response': response,
            'intent': intent,
            'facts': facts
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def detect_intent(question):
    """Simple keyword-based intent detection"""
    question_lower = question.lower()

    # Improvement questions
    if any(word in question_lower for word in ['improve', 'better', 'enhance', 'boost', 'increase', 'grow', 'develop', 'advance']):
        return 'improvement'

    # Recommendation questions
    if any(word in question_lower for word in ['recommend', 'suggest', 'best', 'top', 'good']):
        return 'recommendation'

    # Career guidance
    if any(word in question_lower for word in ['career', 'future', 'path', 'job', 'work', 'profession']):
        return 'career_guidance'

    # Application questions
    if any(word in question_lower for word in ['apply', 'application', 'resume', 'cover letter', 'interview']):
        return 'application_help'

    # Skill-related questions
    if any(word in question_lower for word in ['skill', 'learn', 'training', 'course']):
        return 'skill_development'

    # Default to general
    return 'general'


def prepare_facts(intent, user_skills, user_city, user_job_type):
    """Logic engine: Prepare facts based on intent"""
    facts = {}

    # Get user's best matching internship
    filtered = df.copy()
    cols = set(filtered.columns)
    job_title_col = 'job_title' if 'job_title' in cols else ('job' if 'job' in cols else None)
    city_col = 'cities' if 'cities' in cols else ('city' if 'city' in cols else None)
    job_type_col = 'job_type' if 'job_type' in cols else None

    # Apply user preferences
    if user_city and city_col:
        filtered = filtered[filtered[city_col].astype(str).str.lower().str.strip() == user_city.lower().strip()]

    if user_job_type and job_type_col:
        filtered = filtered[filtered[job_type_col].astype(str).str.lower().str.strip() == user_job_type.lower().strip()]

    # Calculate match scores
    if job_title_col and len(filtered) > 0:
        filtered['skill_match_score'] = filtered.apply(
            lambda row: _match_score(
                row[job_title_col],
                user_skills,
                row[city_col] if city_col else None,
                user_city,
                row[job_type_col] if job_type_col else None,
                user_job_type
            ),
            axis=1
        )

        # Get best match
        best_match = filtered.sort_values('skill_match_score', ascending=False).head(1)
        if len(best_match) > 0:
            best = best_match.iloc[0]
            facts['best_internship'] = {
                'title': best[job_title_col],
                'company': best.get('company_name', ''),
                'city': best.get(city_col, ''),
                'stipend': best.get('stipend_amount', 0),
                'match_score': round(best['skill_match_score'], 1)
            }

            # Calculate missing skills (simplified)
            job_title = str(best[job_title_col]).lower()
            required_skills = []
            for category, keywords in SKILL_KEYWORDS.items():
                if any(kw in job_title for kw in keywords):
                    required_skills.extend(keywords[:2])  # Take first 2 keywords per category

            user_skill_set = set(s.lower() for s in user_skills)
            missing_skills = list(set(required_skills) - user_skill_set)[:3]  # Limit to 3
            facts['missing_skills'] = missing_skills

    # User's current skills
    facts['user_skills'] = user_skills
    facts['user_city'] = user_city
    facts['user_job_type'] = user_job_type

    return facts


def generate_response(intent, facts, original_question):
    """Generate natural language response using Groq AI with facts from logic engine"""

    # Initialize Groq client
    groq_api_key = os.environ.get('GROQ_API_KEY')
    if not groq_api_key:
        print("Warning: GROQ_API_KEY not set. Chat fallback to templates.")
        return fallback_response(intent, facts, original_question)
    groq_client = Groq(api_key=groq_api_key)

    # Prepare context from facts
    best = facts.get('best_internship')
    missing = facts.get('missing_skills', [])
    user_skills = facts.get('user_skills', [])
    user_city = facts.get('user_city', '')
    user_job_type = facts.get('user_job_type', '')

    # Create system prompt based on intent
    system_prompts = {
        'improvement': f"""You are a helpful career advisor for Skill2Intern. A student with skills in {', '.join(user_skills) if user_skills else 'general areas'} from {user_city} wants to improve their internship prospects.

Facts from our matching system:
- Best matching internship: {best['title'] if best else 'None found'}
- Current match score: {best['match_score'] if best else 'N/A'}%
- Missing skills: {', '.join(missing) if missing else 'None identified'}

Provide specific, actionable advice on how to improve their chances. Be encouraging and professional.""",

        'recommendation': f"""You are a career advisor for Skill2Intern. Recommend internships based on the student's profile.

Student profile:
- Skills: {', '.join(user_skills) if user_skills else 'Not specified'}
- Preferred city: {user_city}
- Preferred job type: {user_job_type}

Best recommendation from our system:
{f"- {best['title']} at {best['company']} in {best['city']} (₹{best['stipend']:,}/month, {best['match_score']}% match)" if best else "No strong matches found"}

Provide personalized recommendations with explanations.""",

        'career_guidance': f"""You are a career mentor for Skill2Intern. Provide guidance on career paths.

Student has skills in: {', '.join(user_skills) if user_skills else 'general areas'}
Their best matching role: {best['title'] if best else 'Not determined'}

Give thoughtful career advice, including potential paths, next steps, and long-term opportunities.""",

        'application_help': f"""You are an application coach for Skill2Intern. Help with internship applications.

Student skills: {', '.join(user_skills) if user_skills else 'general'}
Target role: {best['title'] if best else 'general internships'}

Provide practical tips on resumes, cover letters, interviews, and application strategies.""",

        'skill_development': f"""You are a skill development advisor for Skill2Intern.

Student current skills: {', '.join(user_skills) if user_skills else 'none specified'}
Skills they should learn: {', '.join(missing) if missing else 'focus on fundamentals'}

Recommend learning paths, resources, and project ideas to develop these skills.""",

        'general': """You are a helpful assistant for Skill2Intern, an internship matching platform. Answer questions about internships, career development, and skill building. Be friendly and informative."""
    }

    system_prompt = system_prompts.get(intent, system_prompts['general'])

    try:
        # Call Groq API
        response = groq_client.chat.completions.create(
            model="gemma2-9b-it",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": original_question}
            ],
            max_tokens=500,
            temperature=0.7
        )

        ai_response = response.choices[0].message.content.strip()

        # Fallback if AI response is too short or fails
        if len(ai_response) < 10:
            ai_response = "I'm here to help with your internship journey. Could you please rephrase your question?"

        return ai_response

    except Exception as e:
        # Fallback to template-based response if Groq fails
        print(f"Groq API error: {e}")
        return fallback_response(intent, facts, original_question)


def fallback_response(intent, facts, original_question):
    """Fallback template-based response if Groq fails"""

    best = facts.get('best_internship')
    missing = facts.get('missing_skills', [])
    user_skills = facts.get('user_skills', [])

    if intent == 'improvement':
        if best and missing:
            response = f"To improve your chances for the '{best['title']}' internship at {best['company']}, focus on learning {', '.join(missing)}. You currently have a {best['match_score']}% match with your skills in {', '.join(user_skills) if user_skills else 'general areas'}. These additional skills will significantly boost your profile."
        else:
            response = f"To improve your internship prospects, consider developing skills in high-demand areas like Python, data analysis, or web development. Keep building projects and gaining practical experience."

    elif intent == 'recommendation':
        if best:
            response = f"Based on your skills and preferences, I recommend the '{best['title']}' position at {best['company']} in {best['city']}. It offers ₹{best['stipend']:,} per month and matches {best['match_score']}% with your profile."
        else:
            response = "I recommend exploring internships in software development, data science, or marketing based on current market trends. Consider your location and skill preferences when applying."

    elif intent == 'career_guidance':
        if user_skills:
            response = f"With your skills in {', '.join(user_skills)}, you have strong potential in technology and development roles. Focus on building a portfolio of projects and gaining practical experience. The '{best['title']}' role could be a great starting point for your career."
        else:
            response = "Start by identifying your interests and building foundational skills. Technology fields like software development offer great growth potential. Consider online courses and personal projects to get started."

    elif intent == 'application_help':
        response = "When applying for internships, tailor your resume to highlight relevant skills and projects. Include a cover letter explaining your interest and fit. Apply early and follow up politely. For the '{best['title']}' position, emphasize your {', '.join(user_skills) if user_skills else 'transferable skills'}."

    elif intent == 'skill_development':
        if missing:
            response = f"To develop the skills you need, I suggest learning {', '.join(missing)} through online platforms like Coursera, Udemy, or freeCodeCamp. Start with practical projects to apply what you learn."
        else:
            response = "Continue developing your skills through projects and online courses. Focus on areas like problem-solving, communication, and technical expertise. Building a strong portfolio is key."

    else:  # general
        response = "I'm here to help with internship recommendations, skill development advice, and career guidance. Feel free to ask specific questions about improving your profile or finding the right opportunities."

    return response


if __name__ == "__main__":
    # Run on all interfaces for local testing; frontend is served by Flask routes above.
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
