# SmartChat + Document Upload RAG Application (Gemini Powered)

A modern, full-stack application built using **React (Vite)**, **Django (REST Framework)**, and **MySQL** (with SQLite fallback). It provides a ChatGPT-like interface with the added power of document indexing and Retrieval-Augmented Generation (RAG) powered by **Google Gemini API** (which has a free tier).

---

## Features
- **Dual Chat Modes**:
  - **General Mode**: Acts as a standard chat assistant using conversation history and the fast `gemini-1.5-flash` model.
  - **Document RAG Mode**: If a `.pdf` or `.txt` document is uploaded to a chat session, queries are answered strictly using contextual info parsed from that document.
- **Smart Conversational History**: Auto-generates chat thread titles based on the first question asked. Full history is preserved in MySQL/SQLite.
- **Premium Glassmorphic Dark UI**: Custom-built with modern CSS variables, responsive design, animations, and clean components.

---

## Project Structure
```text
Techjaysnewproject/
├── backend/
│   ├── backend/            # Django settings & config
│   ├── chats/              # API views, models, migrations
│   ├── media/documents/    # Uploaded PDFs/TXT files
│   ├── requirements.txt    # Python dependencies
│   ├── .env                # App configurations (API keys, DB details)
│   └── manage.py           # Django management CLI
└── frontend/
    ├── src/                # React source files (App.jsx, App.css, index.css)
    ├── package.json        # Frontend dependencies
    └── vite.config.js      # Vite configurations
```

---

## Getting Started

### 1. Prerequisite Configuration

#### Backend Setup (.env)
Copy the default environment template and enter your values:
1. Open [backend/.env](file:///c:/Users/Admin/Desktop/Techjaysnewproject/backend/.env).
2. Set your `GEMINI_API_KEY` (You can get a free key from Google AI Studio).
3. Provide your MySQL database credentials:
   - `DB_NAME` (default: `chat_rag_db`)
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_HOST`
   - `DB_PORT`

> [!NOTE]
> If MySQL is not running or credentials are wrong, the application will automatically output a warning and fall back to SQLite (`db.sqlite3`), allowing the application to run immediately for testing.

---

### 2. Running the Application

Open two separate terminals or runs:

#### Terminal 1: Backend Server (Django)
```powershell
# Navigate to backend directory
cd backend

# Activate virtual environment
.\venv\Scripts\activate

# Install dependencies (if not done)
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Start development server
python manage.py runserver 8001
```
The backend API will run on `http://127.0.0.1:8001/`.

#### Terminal 2: Frontend Server (React)
```powershell
# Navigate to frontend directory
cd frontend

# Install package dependencies
npm install

# Run the Vite server
npm run dev
```
The React frontend web portal will run on `http://localhost:5173/` (or similar). Open this URL in your web browser.

---

## Tech Stack Details
- **Frontend**: React (Hooks, Context, pure CSS styles), Vite
- **Backend**: Django, Django REST Framework, Django CORS Headers
- **GenAI**: Google Gemini API (`models/text-embedding-004` and `gemini-1.5-flash`)
- **Database**: MySQL (PyMySQL client connector) with automatic local SQLite fallback
- **File Parsing**: PyPDF
