# Run RExA from VS Code (supervisor demo)

## One-time setup

1. Install **VS Code** (or Cursor — same steps).
2. Open this folder: `File → Open Folder…` → select  
   `C:\Users\Hasnain Ali Talpur\Projects\earas`
3. When prompted, **Install Recommended Extensions** (Python + debugpy).
4. Confirm these already exist on your PC (they do on this machine):
   - `backend\.venv` (Python environment)
   - `node_modules` (frontend packages)
   - `backend\.env` with `MODEL_MODE=trained`

If `node_modules` is missing, open Terminal (`Ctrl+`` `) and run:

```powershell
npm install
```

## Run the full demo (easiest)

### Option A — One click task (recommended)

1. Press **`Ctrl+Shift+B`** (default build task)  
   — or — **`Ctrl+Shift+P`** → **`Tasks: Run Task`** → **`RExA: Start Full Demo`**
2. Wait until two Terminal tabs show:
   - Backend: `Uvicorn running on http://127.0.0.1:8000`
   - Frontend: `Local: http://localhost:5173/`
3. Open Chrome/Edge: **http://localhost:5173/**

### Option B — Run and Debug (opens Chrome)

1. Install the **Python** extension if prompted
2. Open **Run and Debug** (`Ctrl+Shift+D`)
3. Select **`RExA: Open app in browser`**
4. Press **F5** (starts API + Vite, then opens the app)

### Option C — Double-click workspace file

1. Double-click **`RExA.code-workspace`** in this folder (opens VS Code)
2. Then use Option A (`Ctrl+Shift+B`)

## Login (seed account)

| Field    | Value              |
|----------|--------------------|
| Email    | `admin@earas.edu`  |
| Password | `Admin1234`        |

## What to show your supervisor

1. **Dashboard** — overview of analyses  
2. **Analysis** — paste a student answer → Run analysis  
3. **Reasoning Engine** — roles, coverage, explanations  
4. **Evaluation** — Acc / Precision / Recall / F1 + literature comparison  
5. **Compare** — two answers side by side  

## Stop the servers

- Click the **trash** icon on each Terminal panel, or  
- Press **`Ctrl+C`** in each running terminal  

## If something fails tomorrow

| Problem | Fix |
|---------|-----|
| Port 5173 or 8000 busy | Close old terminals, or restart VS Code |
| Login fails | Use `admin@earas.edu` / `Admin1234` exactly |
| Analysis errors | Confirm Terminal shows API on port **8000** |
| Blank Evaluation charts | Hard refresh the page (`Ctrl+F5`) |
| Python not found | Select interpreter: `Ctrl+Shift+P` → **Python: Select Interpreter** → `backend\.venv\Scripts\python.exe` |

## Manual terminals (backup)

**Terminal 1 — Backend**

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000 --host 127.0.0.1
```

**Terminal 2 — Frontend**

```powershell
npm run dev
```

Then open http://localhost:5173/
