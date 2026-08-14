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

Sellers increasingly use AI to generate product photos and descriptions — faster and cheaper than real photoshoots. But **nobody checks whether that AI content matches the real product.** A customer sees a midi dress; the shipped item is a different colour, wrong length, or wrong fabric — because the "photo" was never a photo of *that* item.

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
2. On-device AI models extract garment attributes
3. A **7-layer verification pipeline** compares anchor × catalog × metadata
4. **Pass →** Verified badge · **Fail →** seller sees exactly what's wrong

---

## The 7-Layer Verification Pipeline

| Layer | Name | What It Does | Runs Locally? |
|:---:|---|---|:---:|
| **1** | Visual Identity Gate | CLIP similarity + pHash — *"same garment?"* | ✅ Local |
| **2** | Attribute Extraction | Custom ViT + SigLIP zero-shot for 19 garment attributes | ✅ Local \* |
| **3** | Deterministic Comparison | Three-way anchor ↔ catalog ↔ metadata check with synonym matching, HSV colour analysis, size-chart cross-validation | ✅ Local |
| **4** | Measurement Channels | Independent physics-based checks — colour fidelity (CIEDE2000), print geometry (FFT), instance correspondence (DISK+LightGlue), embedding similarity (DINOv2 + MarqoFashionSigLIP) | ✅ Local |
| **5** | Bayesian Fusion | Fuses all evidence via likelihood ratios into a calibrated 0–100% score with full breakdown | ✅ Local |
| **6** | Correction Co-Pilot | Evidence-backed fix suggestions with consumer-impact prioritisation | ✅ Local |
| **7** | Listing Enhancement | SEO titles, descriptions, trend tags, 5-view AI catalog images | ☁️ API |

> **Layers 1, 3–6 run fully locally with no external calls.** Layer 2 runs on the local ViT and CLIP models by default; when a Gemini API key is configured, it also cross-checks against cloud vision for higher accuracy — offline-only mode is a supported configuration. Layer 7 (text generation + catalog images) uses external APIs when available and falls back to deterministic templates when not.

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
| **ML Service** | Python FastAPI, PyTorch, DINOv2, MarqoFashionSigLIP, Custom ViT, MediaPipe | Local inference — verification models run on-device |
| **Math Channels** | NumPy, Pillow, scikit-image | CIEDE2000 colour delta, FFT print analysis, geometric checks |
| **Optional APIs** | Google Gemini, Groq Llama 3.3 | Vision enrichment (Layer 2 cross-check) + text/image generation (Layer 7) |
| **Database** | SQLite | Products, sellers, verification records |

---

## Features

- **Anchor photo as source of truth** — every claim checked against the real product
- **Bayesian fusion scoring** — multiple independent evidence sources fused mathematically, not a single AI guess
- **8 measurement channels** — colour fidelity, print geometry, instance matching, deep embeddings, pose, segmentation, OCR, attributes
- **AI Correction Co-Pilot** — specific fix suggestions with consumer-impact ranking
- **Designed to never silently pass** — missing evidence = "couldn't verify," not a false green light
- **Size chart cross-validation** — exact measurements override visual guesses
- **5-view AI catalog generation** — front, back, side, close-up, full body with size-accurate proportions
- **Two workflows** — CSV bulk upload or guided manual listing
- **Full audit trail** — verification record stored with every published listing

---

## Known Limitations & Design Trade-offs

| Component | Current State | Production Path |
|---|---|---|
| **Database** | SQLite, synchronous — sufficient for hackathon-scale demo load | Replace with PostgreSQL or managed DB with connection pooling |
| **ML Worker** | Single local FastAPI process on one machine | Queued/batched inference behind a managed model-serving layer (e.g. Triton, SageMaker) |
| **ViT accuracy** | Internal dev-set estimate; not yet calibrated on a published benchmark | `scripts/calibrate.py` is designed to fit thresholds on labelled pairs — the path to a defensible number |

These are the first two infrastructure changes needed for production scale. The verification logic and pipeline design are independent of both.

---

## Challenges We Hit

| Challenge | What We Learned |
|---|---|
| **Balancing strictness** | Too strict frustrates honest sellers (false positives); too lenient lets fakes slip through (false negatives). We expose the Bayesian score breakdown so threshold tuning is data-driven, not guesswork — but calibration on real catalog data is still needed. |
| **AI spatial hallucinations** | Vision models struggle with physical proportions — guessing hemline length from a photo is unreliable. We mitigate this with size-chart cross-validation and geometric measurement channels rather than trusting a single model's spatial judgment. |
| **Retrofitting old catalog** | Existing listings have no anchor photo on file. Verifying them means re-onboarding sellers or defaulting to a lower trust tier until they provide one — there's no shortcut that maintains the anchor-based trust model. |

---

## Future Roadmap

**Product**
- **Feedback-verification layer** — cross-check customer reviews/complaints against catalog claims to catch refund-farming, not just real mismatches
- **Video verification** — extend pixel-locking from product photos to product videos
- **Regional dataset expansion** — improve fabric/attribute detection for regional garments and local textile terms
- **Full size-run verification** — extend checks beyond the single photographed size to the full size range

**Business Model**
- **Per-generation fee** — a minimal charge to sellers for AI catalog-image generation, as a revenue line for Myntra
- **Licensed model pool** — scale AI-model generation using a fixed pool of real model likenesses already contracted by Myntra, rather than generating arbitrary synthetic faces per listing. This avoids likeness/copyright exposure from unlicensed synthetic faces, gives contracted models recurring opportunity as their likeness scales across listings, and keeps represented body diversity grounded in real people on contract — not synthetic "diversity" the platform doesn't actually employ

**Infrastructure**
- **Scalable verification serving** — move the ML serving layer onto production-grade, horizontally scalable infrastructure (queued/batched inference, managed model serving). Feasible and cost-positive for Myntra at catalog scale; not yet built.

---

## Quick Start

```bash
git clone https://github.com/vanshika1030/Anchor_verify.git && cd Anchor_verify

# Terminal 1 — Backend API
cd backend
npm install
pip install -r requirements.txt
cp .env.example .env       # Add API keys (optional — verification works without them)
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

> Layers 1, 3–6 need **zero API keys**. Verification runs without any external services. Adding a Gemini key enables Layer 2 cloud cross-checks and Layer 7 generation.

---
**Research links:**
> https://clutch.co/resources/ai-in-branding
> https://stylitics.com/resources/blog/why-ai-generated-imagery-reduces-returns/
> Rest of the research, in one place : https://canva.link/abbkvorcizf998y

<p align="center">
  <strong>Built for Myntra HackerRamp</strong><br/>
  <em>⚓ Trust shouldn't be optional.</em>
</p>

---

## Research & References

<!-- Add links to papers, datasets, and prior art here -->
