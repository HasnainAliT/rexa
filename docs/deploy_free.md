# Free public website (no credit card)

Your Gradio Space (free — **no Docker / no card**):

**https://huggingface.co/spaces/Hasnain-ai/RExA**

SDK on Hugging Face must be **Gradio** (Docker is marked Paid on new accounts).

---

## Deploy / update the Space

### 1) Write token
1. Open [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. **Create new token** → permission **Write**
3. Copy token (`hf_...`)

### 2) Push the Gradio demo

```powershell
cd "C:\Users\Hasnain Ali Talpur\Projects\earas"
$env:HF_TOKEN = "hf_PASTE_YOUR_TOKEN_HERE"
.\scripts\deploy_hf_gradio.ps1 -HfUsername "Hasnain-ai" -SpaceName "RExA"
```

Or paste the token in chat and ask to deploy (do not commit the token to GitHub).

### 3) Share the link

After the Space build is green, anyone can open:

https://huggingface.co/spaces/Hasnain-ai/RExA

Click **Analyze with RExA**. No login required on the Space.

---

## Notes

- This Gradio Space demos **Core RExA analysis** (roles, coverage, depth, stars).
- The full React website still runs locally / on GitHub: https://github.com/HasnainAliT/rexa
- Skip Render/Vercel if they ask for a credit card.
