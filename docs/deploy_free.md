# Free public website (no credit card)

Goal: a link anyone can open, like  
`https://huggingface.co/spaces/YOUR_USERNAME/rexa`

**Do not use Render / Vercel if they ask for a card.**  
Use **Hugging Face Spaces** instead (free Docker, usually **no card**).

---

## Hugging Face Spaces (recommended — free, no card)

### 1) Create account
1. Open [https://huggingface.co/join](https://huggingface.co/join)
2. Sign up with email or GitHub  
3. Confirm email if asked

### 2) Create a Space
1. Open [https://huggingface.co/new-space](https://huggingface.co/new-space)
2. **Space name:** `rexa`
3. **License:** MIT (or any)
4. **SDK:** **Docker**
5. **Hardware:** **CPU basic** (Free)
6. **Visibility:** **Public**
7. Create Space

### 3) Get a write token
1. [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. **Create new token** → type **Write** → create  
3. Copy the token (starts with `hf_...`)

### 4) Deploy from this project (PowerShell)

In the project folder, replace `YOUR_HF_USERNAME` and paste your token when asked:

```powershell
cd "C:\Users\Hasnain Ali Talpur\Projects\earas"
.\scripts\deploy_hf_space.ps1 -HfUsername "YOUR_HF_USERNAME"
```

Or tell me your Hugging Face **username** after you create the Space, and I can run the deploy for you (you paste the token once).

### 5) Open your public link

After the build turns green (5–15 minutes):

`https://huggingface.co/spaces/YOUR_HF_USERNAME/rexa`

**Login**

- `admin@earas.edu` / `Admin1234`
- `analyst@earas.edu` / `Analyst1234`

---

## Why not Render / Vercel?

Many accounts now must add a **credit card** even for “free” plans.  
Hugging Face Spaces free CPU does **not** require that for a normal student account.

---

## After you deploy

You can still change code on your PC → push GitHub → re-run the HF deploy script (or push to the Space remote) to update the live site.
