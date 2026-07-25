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
 ① UPLOAD                ② EXTRACT               ③ VERIFY                ④ PUBLISH
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

# Backend (Terminal 1)
cd backend
npm install
pip install -r requirements.txt
cp .env.example .env       # Add API keys
npm run dev                 # → http://localhost:3001

# Frontend (Terminal 2)
cd frontend
npm install
npm run dev                 # → http://localhost:5173
```

### Demo Credentials
| Email | Password |
|---|---|
| `seller@myntra.com` | `demo123` |

### Environment Variables
| Variable | Required | Purpose |
|---|---|---|
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
