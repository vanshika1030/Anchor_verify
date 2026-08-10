<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?logo=pytorch&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white" />
</p>

<h1 align="center">⚓ Anchor</h1>
<p align="center"><strong>Proactive AI-Powered Listing Verification for E-Commerce</strong></p>
<p align="center"><em>One real photo. Every claim checked. Before it goes live.</em></p>

---

## The Problem

Online clothing sellers increasingly use AI to generate product photos and descriptions — it's cheaper and faster than real photoshoots. But **nobody checks whether that AI-generated content actually matches the real product.** A customer sees a photo of a nice midi dress; the real item shipped might be a different color, wrong length, or wrong fabric — because the "photo" was never a photo of that real item, it was AI-imagined.

The result: customers receive products that don't match what they saw online, return rates climb, and trust erodes — not just for one seller, but across the entire platform.

We found real evidence this is already happening — actual customer complaints, AI-generated photos that visually contradict the same listing's text description, and industry data showing the problem is growing.

## The Solution

Anchor doesn't try to stop sellers from using AI. Instead, it sits between **"listing gets created"** and **"listing goes live"** and asks one question:

> **Does this listing actually match the real product?**

The seller provides one real, honest photo of the physical garment — the **anchor** — and everything else in the listing gets verified against it. It doesn't matter whether the listing was made by Anchor's tools, a third-party AI, or a real photographer. Anchor checks all of it the same way.

The name comes from this idea: like a ship's anchor prevents drift, the real photo keeps the listing honest.

---

## How It Works

```
 → UPLOAD                → EXTRACT               → VERIFY                → PUBLISH
┌─────────────┐      ┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│ Seller       │      │ Local AI models  │     │ 5-Layer Pipeline │     │ Verified    │
│ uploads real │─────▶│ extract garment  │────▶│ checks anchor vs │────▶│ listing     │
│ anchor photo │      │ attributes       │     │ catalog vs data  │     │ goes live   │
└─────────────┘      └─────────────────┘     └────────┬─────────┘     └─────────────┘
                                                      │
                                               ❌ Mismatch?
                                                      │
                                              AI Co-Pilot suggests
                                              specific fix (1-click)
```

1. Seller uploads real photos of the actual garment (front, back, close-up) + size chart
2. Local AI models extract garment attributes — zero API calls, runs on-device
3. A 5-layer verification pipeline compares anchor photo vs catalog photo vs declared metadata
4. **Pass →** listing gets a Verified badge and goes live
5. **Fail →** seller sees exactly what's wrong, with suggested fixes and one-click accept

---

## The 5-Layer Verification Pipeline

| Layer | Name | What It Does | Runs Locally? |
|:---:|---|---|:---:|
| **1** | Visual Gate | CLIP similarity + pHash — *"Is this even the same product?"* | ✅ |
| **2** | Attribute Extraction | Custom ViT (89% accuracy) + CLIP zero-shot for 19 garment attributes | ✅ |
| **3** | Deterministic Comparison | Synonym-aware matching, HSV color analysis, size chart cross-validation | ✅ |
| **4** | Bayesian Fusion | Fuses three independent evidence sources via Bayes' theorem → calibrated 0–100% score | ✅ |
| **5** | Listing Generation | SEO titles, descriptions, trend tags, AI model catalog images | ☁️ API |

> **Key design choice:** Layers 1–4 use **zero external API calls**. Verification works offline, never hits rate limits, and never sends product data to third parties. Only Layer 5 (text generation + catalog images) uses external APIs.

### The Verification Network (measurement channels)

On top of the layers, the live path fans each submission out to independent
**measurement channels**, each answering one narrow question with its own
physics, its own likelihood ratio, and an honest "not measured" when it can't
run:

| Channel | Question | Tech | Needs model weights? |
|---|---|---|:---:|
| **C1 Identity** | Same physical garment? | DINOv2 + FashionCLIP, fused as **one** correlated family | Yes (`scripts/fetch_models.py`) |
| **C2 Colour fidelity** | Is the catalog colour the colour a shopper receives? | LAB k-means + CIEDE2000 (kL=2 textile standard), per-view median | **No — pure math** |
| **C3 Print geometry** | Is the print scale/structure preserved? | 2-D FFT dominant period in cycles per garment width (camera-distance invariant) | **No — pure math** |
| **C5 Attributes & logic** | Do declared attributes agree with images and each other? | Custom ViT + zero-shot + deterministic comparison | Partially |

The worker reports a per-capability map at `GET :8100/health`; channels it
can't serve are listed in the verification report as `signals_missing` —
confidence tiers drop, scores never pretend. Fusion multiplies only channels
with independent physics: the embedding models share one likelihood-ratio slot
(their errors correlate — counting cousins twice manufactures false
confidence).

Calibration: `scripts/calibrate.py pairs.json` fits channel thresholds on
labelled pairs (include same-category-different-product hard negatives).

### Why Plain Code Makes the Final Call

A natural first idea: use one AI to check another AI's work. The problem — one guess checking another guess can share blind spots. Anchor deliberately uses **different types of checks** (mathematical fingerprints, a specialist model, a general-purpose AI, exact measurements) and only **plain, transparent, rule-based logic** makes the actual decision. Different methods make different mistakes, so requiring them to agree is stronger than trusting any single one.

---

## Features

### Verification & Trust
- **Anchor photo requirement** — one real photo = the source of truth everything is checked against
- **Bayesian fusion scoring** — three independent evidence sources fused mathematically, not a single AI confidence guess
- **AI Correction Co-Pilot** — suggests specific fixes when confident, asks politely when not
- **Never silently passes** — if any check fails to run, the result is "couldn't verify," never a false green light
- **Size chart as truth** — exact measurements override visual guesses where they apply (28" garment ≠ crop top, period)

### Catalog Generation
- **5-view AI model catalog** — Front, Back, Side, Close-up, Full body with size-accurate proportions
- **Automated trend tags** — `#y2k` `#streetwear` `#cottagecore` `#festivalwear` generated from verified attributes
- **SEO-optimized descriptions** — titles, bullet points, and category paths auto-generated
- **Two listing workflows** — CSV bulk upload (existing Myntra template) or guided manual upload

### Customer Experience
- **Verified badge** — customers see which listings have been checked against the real product
- **Confidence score** — the Bayesian match probability is visible, not hidden
- **Accurate search** — verified attributes power better discoverability than generic seller descriptions

---

## Quick Start

### Prerequisites
Node.js ≥ 18 · Python ≥ 3.10 · GPU recommended (CPU works, slower)

### Setup
```bash
git clone https://github.com/your-org/anchor.git && cd anchor

# Backend API (Terminal 1)
cd backend
npm install
pip install -r requirements.txt
cp .env.example .env       # Add API keys
npm run dev                 # → http://localhost:3001

# Local ML worker (Terminal 2) — REQUIRED for verification
# Layers 1 through 3.7 all call this process. It is separate from the Node API
# and does not start with it; without it, verification of new anchors returns
# EVIDENCE_PENDING.
cd backend
python services/ai_server.py   # → http://127.0.0.1:8100

# Frontend (Terminal 3)
cd frontend
npm install
npm run dev                 # → http://localhost:5173
```

### Checking that everything is actually up
```bash
curl http://localhost:3001/api/health
```
Returns `200` with `"status": "ok"` when the database and the ML worker (CLIP +
ViT loaded) are both healthy, and `503` with `"status": "unhealthy"` when a
decision-critical dependency is down. The Node backend also prints the worker's
state at startup. Missing LLM keys never fail the check — they only affect
Layer 5 listing text.

### Demo Credentials
| Email | Password |
|---|---|
| `seller@myntra.com` | `demo123` |

### Environment Variables
| Variable | Required | Purpose |
|---|---|---|
| `PORT` | Optional | Backend port; defaults to `3001` |
| `ANCHOR_ML_URL` | Optional | Local ML worker base URL; defaults to `http://127.0.0.1:8100`. Use an explicit IPv4 address — `localhost` resolves to `::1` first on many machines while uvicorn binds IPv4, which surfaces as `fetch failed` |
| `ANCHOR_ML_TIMEOUT_MS` | Optional | Per-inference timeout for ML calls; defaults to `30000` |
| `ANCHOR_ML_HEALTH_TIMEOUT_MS` | Optional | Timeout for the worker health probe; defaults to `2000` |
| `JWT_SECRET` | Required in production | Signs seller authentication tokens |
| `EVIDENCE_BINDING_SECRET` | Required in production | Cryptographically binds evidence to its anchor images |
| `GROQ_API_KEY` | Recommended | Llama 3.3 70B text generation (Layer 5) |
| `GEMINI_API_KEY` | Recommended | Gemini vision parsing + text fallback |
| `GEMINI_API_KEYS` | Optional | Multiple keys for rate-limit rotation |

> **Note:** Layers 1–4 need **zero API keys**. Verification works without any external services.

---

## Project Structure

```
anchor/
├── backend/
│   ├── server.js                    # Express entry point
│   ├── routes/
│   │   ├── verify.js                # ⭐ Core 5-layer verification pipeline
│   │   ├── extract.js               # Anchor attribute extraction
│   │   ├── csv.js                   # Bulk CSV upload & processing
│   │   ├── products.js              # Product CRUD + public catalog
│   │   ├── sizechart.js             # Size chart parsing
│   │   └── auth.js                  # JWT authentication
│   └── services/
│       ├── gemini.js                # AI orchestration + ML dispatch
│       ├── groq.js                  # Groq LLM wrapper
│       ├── fusion.js                # Bayesian mathematical fusion
│       ├── database.js              # SQLite schema + CRUD
│       ├── vit_infer_cli.py         # Custom ViT classifier (89% acc)
│       ├── clip_similarity_cli.py   # CLIP similarity + zero-shot
│       ├── phash_cli.py             # Perceptual hash comparison
│       └── segmentation_cli.py      # Garment segmentation (rembg)
├── frontend/src/
│   ├── pages/                       # Landing, Dashboard, NewListing, Verify,
│   │                                # Success, CitizenView, ProductView
│   ├── components/                  # AuthGuard, ExcelView, Sidebar, Stepper
│   └── services/api.js              # Backend API client
└── demo_data/                       # Sample anchor images + CSV templates
```

---

## Third-Party Services & Licenses

### External APIs
| Service | Model | Terms |
|---|---|---|
| Groq | Llama 3.3 70B Versatile | [groq.com/terms](https://groq.com/terms-of-use/) |
| Google Gemini | gemini-2.5-flash | [ai.google.dev/terms](https://ai.google.dev/terms) |

### Dependencies
| Package | License | | Package | License |
|---|---|---|---|---|
| Express.js | MIT | | React 19 | MIT |
| better-sqlite3 | MIT | | Vite 8 | MIT |
| Sharp | Apache-2.0 | | React Router | MIT |
| PyTorch | BSD-3 | | Lucide Icons | ISC |
| OpenCLIP | MIT | | PapaParse | MIT |
| timm | Apache-2.0 | | Groq SDK | Apache-2.0 |
| rembg | MIT | | @google/genai | Apache-2.0 |
| imagehash | BSD-2 | | jsonwebtoken | MIT |
| Pillow | HPND | | Google Fonts | SIL OFL 1.1 |

---

## What's Built, What's Next

| Status | Features |
|---|---|
| ✅ **Done** | Visual similarity gate · Custom ViT extraction (89%) · CLIP zero-shot · Deterministic comparison with synonym matching · Bayesian fusion scoring · AI correction co-pilot · Size chart cross-validation · CSV + manual listing workflows · Automated trend tags · Citizen storefront with verified badges · JWT authentication · Garment segmentation · HSV color analysis |
| 🔧 **In Progress** | AI model catalog generation (rate-limit dependent) |
| 📋 **Planned** | Size-chart body-proportion matching · Customer complaint resolution flow |

---

<p align="center">
  <strong>Built for Myntra HackerRamp</strong><br/>
  <em>⚓ Trust shouldn't be optional.</em>
</p>
