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

Sellers increasingly use AI to generate product photos and descriptions — it's faster and cheaper than real photoshoots. But **nobody checks whether that AI content actually matches the real product.** A customer sees a nice midi dress; the shipped item is a different color, wrong length, or wrong fabric — because the "photo" was never a photo of *that* item.

The result: rising return rates, eroding trust, and a growing gap between what shoppers see and what they receive.

## The Solution

Anchor sits between **"listing created"** and **"listing goes live"** and asks one question:

> **Does this listing actually match the real product?**

The seller provides real photos of the physical garment — the **anchor** — and everything in the listing is verified against it. AI can help *create* content, but it can't silently *replace* the evidence.

---

## How It Works

```
 → UPLOAD                → EXTRACT               → VERIFY                → PUBLISH
┌─────────────┐      ┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│ Seller       │      │ Local AI models  │     │ 7-Layer Pipeline │     │ Verified    │
│ uploads real │─────▶│ extract garment  │────▶│ checks anchor vs │────▶│ listing     │
│ anchor photo │      │ attributes       │     │ catalog vs data  │     │ goes live   │
└─────────────┘      └─────────────────┘     └────────┬─────────┘     └─────────────┘
                                                      │
                                               ❌ Mismatch?
                                                      │
                                              AI Co-Pilot suggests
                                              specific fix (1-click)
```

1. Seller uploads real photos (front, back, close-up) + size chart
2. On-device AI models extract garment attributes — **zero API calls**
3. A **7-layer verification pipeline** compares anchor × catalog × metadata
4. **Pass →** listing gets a Verified badge · **Fail →** seller sees exactly what's wrong

---

## The 7-Layer Verification Pipeline

| Layer | Name | What It Does | Local? |
|:---:|---|---|:---:|
| **1** | Visual Identity Gate | CLIP similarity + pHash — *"same garment?"* | ✅ |
| **2** | Attribute Extraction | Custom ViT (89% acc) + SigLIP zero-shot for 19 garment attributes | ✅ |
| **3** | Deterministic Comparison | Three-way anchor ↔ catalog ↔ metadata check with synonym matching, HSV colour analysis, size-chart cross-validation | ✅ |
| **4** | Measurement Channels | Independent physics-based checks — colour fidelity (CIEDE2000), print geometry (FFT), instance correspondence (DISK+LightGlue), embedding similarity (DINOv2 + MarqoFashionSigLIP) | ✅ |
| **5** | Bayesian Fusion | Fuses all evidence via likelihood ratios into a calibrated 0–100% score with full breakdown | ✅ |
| **6** | Correction Co-Pilot | Evidence-backed fix suggestions with consumer-impact prioritisation | ✅ |
| **7** | Listing Enhancement | SEO titles, descriptions, trend tags, 5-view AI catalog images | ☁️ |

> **Layers 1–6 use zero external API calls.** Verification works offline, never hits rate limits, and never sends product data to third parties. Only Layer 7 (text generation + catalog images) optionally uses external APIs.

### Measurement Channels (Layer 4)

Each channel answers one narrow question with its own physics and an honest "not measured" when it can't run:

| Channel | Question | Tech |
|---|---|---|
| **Garment segmentation** | Isolate garment from background | SegFormer-B2 / BiRefNet |
| **Body landmarks** | Detect pose for length/proportion checks | MediaPipe Pose |
| **Colour fidelity** | Catalog colour = received colour? | LAB k-means + CIEDE2000 ΔE |
| **Print/stripe geometry** | Print scale preserved? | FFT period + Gabor/LBP |
| **Instance correspondence** | Same physical item? | DISK/ALIKED + LightGlue |
| **Embedding similarity** | Deep visual match | DINOv2-S + MarqoFashionSigLIP |
| **Attributes** | Declared attrs match images? | Custom ViT + SigLIP zero-shot |
| **Document evidence** | Size chart / label readable? | PaddleOCR / Florence-2 |

Channels with correlated errors share a single likelihood-ratio slot in fusion — counting cousins twice would manufacture false confidence.

---

## Architecture

```
┌──────────────┐     ┌────────────────────┐     ┌──────────────────┐
│  React + Vite │────▶│  Node.js + Express  │────▶│  Python FastAPI   │
│  :5173        │     │  :3001              │     │  :8100            │
│               │     │                    │     │                  │
│  Seller studio│     │  Auth, uploads,    │     │  CLIP, ViT, pHash│
│  Verify page  │     │  CSV, orchestration│     │  Segmentation    │
│  Dashboard    │     │  Verification logic│     │  DINOv2, FFT     │
│  Citizen store│     │  Product persistence│    │  Colour, Pose    │
└──────────────┘     └─────────┬──────────┘     └──────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   SQLite    │  Local  │
                    │   (products,│  uploads│
                    │   sellers)  │  dir    │
                    └─────────────┴────────┘
                               │
                    ┌──────────┴──────────┐  (optional)
                    │  Gemini  │   Groq   │
                    │  Vision  │   Llama  │
                    └──────────┴──────────┘
```

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, Vite, React Router, Lucide Icons | Seller studio, verification UI, citizen storefront |
| **Backend** | Node.js, Express, better-sqlite3, Sharp, Multer | API orchestration, image processing, data persistence |
| **ML Service** | Python FastAPI, PyTorch, DINOv2, MarqoFashionSigLIP, Custom ViT, MediaPipe | Local inference — all verification models run on-device |
| **Math Channels** | NumPy, Pillow, scikit-image | CIEDE2000 colour delta, FFT print analysis, geometric checks |
| **Optional APIs** | Google Gemini, Groq Llama 3.3 | Vision enrichment + text/image generation (Layer 7 only) |
| **Database** | SQLite | Products, sellers, verification records |

---

## Features

- **Anchor photo as source of truth** — every claim is checked against the real product
- **Bayesian fusion scoring** — multiple independent evidence sources fused mathematically, not a single AI guess
- **8 measurement channels** — colour fidelity, print geometry, instance matching, deep embeddings, pose, segmentation, OCR, attributes
- **AI Correction Co-Pilot** — suggests specific fixes with consumer-impact ranking
- **Never silently passes** — missing evidence = "couldn't verify," never a false green light
- **Size chart cross-validation** — exact measurements override visual guesses
- **5-view AI catalog generation** — front, back, side, close-up, full body with size-accurate proportions
- **Automated trend tags** — `#y2k` `#streetwear` `#cottagecore` generated from verified attributes
- **Two workflows** — CSV bulk upload or guided manual listing
- **Verified badge** — consumers see which listings have been checked against the real product
- **Full audit trail** — verification record stored with every published listing

---

## Quick Start

```bash
git clone https://github.com/vanshika1030/Anchor_verify.git && cd Anchor_verify

# Terminal 1 — Backend API
cd backend
npm install
pip install -r requirements.txt
cp .env.example .env       # Add API keys
npm run dev                 # → http://localhost:3001

# Terminal 2 — ML Worker (required for verification)
cd backend
python services/ai_server.py   # → http://127.0.0.1:8100

# Terminal 3 — Frontend
cd frontend
npm install
npm run dev                 # → http://localhost:5173
```

**Demo login:** `seller@myntra.com` / `demo123`

> Layers 1–6 need **zero API keys**. Verification works without any external services.

---

<p align="center">
  <strong>Built for Myntra HackerRamp</strong><br/>
  <em>⚓ Trust shouldn't be optional.</em>
</p>
