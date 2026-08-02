# Free public deploy (clickable website link)

This puts **frontend + API on one URL** so anyone can open RExA in the browser
(no install, no GitHub clone).

## Recommended: Render (free)

1. Open [https://dashboard.render.com](https://dashboard.render.com) and sign up (GitHub login is easiest).
2. Click **New +** → **Blueprint**
3. Connect the repo: **HasnainAliT/rexa**
4. Render reads [`render.yaml`](../render.yaml) and builds the Docker image.
5. Wait for the first deploy (often 10–20 minutes).
6. Open the service URL, e.g. `https://rexa-xxxx.onrender.com`

**Demo login**

- `admin@earas.edu` / `Admin1234`
- `analyst@earas.edu` / `Analyst1234`

### Notes

- Free instances **sleep** after ~15 minutes idle; the first click after sleep can take ~30–60s.
- DistilBERT is **off** in this deploy (`USE_DISTILBERT_STARS=false`) to fit free RAM.
- Core RExA sklearn modules ship in the image when `MODEL_MODE=trained`.

## Share this

After deploy, send your classmates/supervisor only the **https://….onrender.com** link.

## Local check of the same Docker image

```powershell
docker build -t rexa .
docker run --rm -p 8000:8000 rexa
```

Then open http://localhost:8000
