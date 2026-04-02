# Skill2Intern - AI-Powered Internship Matching Platform

[![GitHub Repo](https://img.shields.io/github/stars/kajalkhutela/skill2_intern)](https://github.com/kajalkhutela/skill2_intern)
[![License](https://img.shields.io/github/license/kajalkhutela/skill2_intern)](LICENSE)

## 🚀 Overview

Skill2Intern is a full-stack web application that uses AI to match students with internships based on skills, location, stipend, and job type preferences. Features include:

- **Smart Matching**: AI-powered skill-job matching (60% weight skills, 40% location, 20% job type)
- **User Dashboard**: Personalized recommendations, application tracking, saved searches
- **Resume Parsing**: Upload PDF resumes to auto-extract skills & suggest categories (PyMuPDF + spaCy)
- **AI Chat Assistant**: Groq-powered career advice (logic-first + natural language)
- **Auth & Profile**: Registration, login, profile management (Flask-Login)
- **Full-Stack**: Flask (Python backend) + HTML/CSS/JS (frontend), Pandas data processing

Live Demo: [https://skill2intern.kajalkhutela.now.sh](https://skill2intern.kajalkhutela.now.sh) (deployed)

## 📁 Project Structure

```
skill2intern __/skill2intern_/skill2intern(internship)/
├── backend/
│   ├── app.py              # Main Flask app (all endpoints)
│   ├── data/
│   │   ├── internships.csv # Dataset (500+ internships)
│   │   ├── users.json      # User data
│   │   ├── projects.json   # Portfolio projects
│   │   ├── applications.json # User applications
│   │   └── saved_searches.json
│   ├── uploads/            # Resume uploads
│   └── test_api.py         # API tests
├── frontend/               # Static HTML/JS/CSS
│   ├── index.html
│   ├── login.html
│   ├── dashboard.html
│   ├── profile.html
│   ├── resume-upload.html
│   ├── css/style.css
│   └── js/                 # Vanilla JS for SPA routing
└── README.md
```

## 🛠️ Quick Start (Local)

1. **Clone & Navigate**
   ```bash
   git clone https://github.com/kajalkhutela/skill2_intern.git
   cd skill2_intern/skill2intern __/skill2intern_/skill2intern(internship)/backend
   ```

2. **Environment Setup**
   ```bash
   # Install Python deps
   pip install flask flask-login pandas werkzeug groq openpyxl PyMuPDF spacy
   python -m spacy download en_core_web_sm  # Resume parser

   # Set Groq API key (chat AI)
   set GROQ_API_KEY=gsk_YOUR_KEY_HERE  # https://console.groq.com/keys
   ```

3. **Run Server**
   ```bash
   python app.py
   ```
   Open [http://localhost:5000](http://localhost:5000)

## ✨ Features

### AI Matching Algorithm
```
Match Score = (Skill Match * 0.4) + (City Match * 0.4) + (Job Type * 0.2)
- Skill: Keyword + semantic similarity (SKILL_KEYWORDS dict)
- Fallback: Top 50 matches >20% score, sorted by score/stipend
```

### Endpoints (All CORS-enabled)
```
GET /internships?city=Delhi&skills=Python,ML&stipend=10000
GET /cities, /job-types
POST /api/register, /api/login, /api/user/profile
POST /api/user/applications, /api/user/saved-searches
POST /upload-resume (PDF → skills JSON)
POST /api/chat (Groq AI career coach)
```

### Tech Stack
- **Backend**: Flask, Flask-Login, Pandas, Groq API, PyMuPDF (resume)
- **Frontend**: Vanilla JS (no frameworks), responsive CSS
- **Data**: JSON + CSV (internships.csv: stipend, duration, city parsed)
- **Security**: Env vars for secrets, secure_filename uploads, hash passwords

## 📊 Sample Data

Dataset: 500+ internships (tech, marketing, design)
| Job Title | Company | City | Stipend | Duration | Skills Match |
|-----------|---------|------|---------|----------|--------------|
| ML Intern | XYZ AI | Delhi | ₹20k | 6 months | 92% |
| Frontend Dev | ABC Web | Bangalore | ₹15k | 3 months | 78% |

## 🤖 AI Chat Assistant

**Prompts**: Logic → Facts → Groq (gemma2-9b-it)
- `improve` → Missing skills for best match
- `recommend` → Personalized top jobs
- `career` → Long-term paths

**Fallback**: Template responses if API unavailable.

## 📈 Roadmap

- [x] Secret-free push (env vars)
- [ ] Docker deployment
- [ ] Database (SQLite → Postgres)
- [ ] React/Vue frontend
- [ ] Email notifications for deadlines
- [ ] More datasets (scraped from Internshala)

## 🐛 Issues

- Resume parser: Requires PyMuPDF + spacy `en_core_web_sm`
- Groq key: Required for `/api/chat`
- Windows paths: Spaces in `skill2intern __/...` (use quotes)

## 🔮 License & Credits

MIT License. Built for [Skill2Intern Internship](https://skill2intern.com).

**Author**: Kajal Khutela  
**Stars appreciated!** ⭐
