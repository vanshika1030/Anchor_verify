"""
Pure-math verification channels (numpy + Pillow only, no ML models).

C2 — Colour fidelity:  garment-masked LAB clustering + CIEDE2000 delta-E.
C3 — Print geometry:   2-D FFT dominant spatial period + texture energy.

Design constraints these functions must honour:
  * Deterministic: same inputs, same outputs, forever. Seeded init, no RNG.
  * Scale-invariant where the physics demands it: stripe period is reported in
    cycles per garment-width, not pixels, so a zoomed-in close-up and a
    full-body shot of the same fabric agree.
  * Honest about applicability: a solid garment has no periodic structure and
    the texture channel must say "not applicable", never "match".
"""

import numpy as np
from PIL import Image

MAX_SIDE = 512


# ── Image + mask ─────────────────────────────────────────────────────

def load_rgb(path, max_side=MAX_SIDE):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    scale = max(w, h) / max_side
    if scale > 1:
        img = img.resize((int(w / scale), int(h / scale)), Image.LANCZOS)
    return np.asarray(img, dtype=np.float64)


def background_mask(img, k=6, border_frac=0.08):
    """Foreground mask by interior/border cluster voting.

    Anchor photos are real, unpolished seller shots — garments on floors,
    tables, hangers — so a corner-sampled background estimate routinely fails
    (it masked the garment itself out of the blue kurti). Instead: cluster the
    whole image in LAB, then score each cluster by where it lives. Background
    clusters dominate the border ring; garment clusters dominate the interior.
    This holds for uniform studio sweeps and messy floors alike, and degrades
    gracefully when the garment fills the frame (all clusters look interior,
    so everything is kept).
    """
    h, w, _ = img.shape
    step = max(1, int(np.sqrt(h * w / 20000)))
    ys, xs = np.mgrid[0:h:step, 0:w:step]
    ys, xs = ys.ravel(), xs.ravel()
    pixels = img[ys, xs]
    lab = srgb_to_lab(pixels)
    centers, _ = kmeans_lab(lab, k=k)

    d = np.linalg.norm(lab[:, None, :] - centers[None, :, :], axis=2)
    labels = np.argmin(d, axis=1)

    by = max(2, int(h * border_frac))
    bx = max(2, int(w * border_frac))
    on_border = (ys < by) | (ys >= h - by) | (xs < bx) | (xs >= w - bx)
    keep = []
    for i in range(centers.shape[0]):
        in_cluster = labels == i
        total = in_cluster.sum()
        if total == 0:
            continue
        border_share = (in_cluster & on_border).sum() / max(on_border.sum(), 1)
        interior_share = (in_cluster & ~on_border).sum() / max((~on_border).sum(), 1)
        if interior_share > border_share * 1.3:
            keep.append(i)
    if not keep:
        # Nothing separates cleanly — keep the most interior-weighted cluster
        # rather than failing outright.
        scores = []
        for i in range(centers.shape[0]):
            in_cluster = labels == i
            interior = (in_cluster & ~on_border).sum() / max((~on_border).sum(), 1)
            border = (in_cluster & on_border).sum() / max(on_border.sum(), 1)
            scores.append(interior - border)
        keep = [int(np.argmax(scores))]

    # Assign every pixel of the full-resolution image to its nearest cluster.
    full_lab = srgb_to_lab(img.reshape(-1, 3))
    full_d = np.linalg.norm(full_lab[:, None, :] - centers[None, :, :], axis=2)
    full_labels = np.argmin(full_d, axis=1).reshape(h, w)
    mask = np.isin(full_labels, keep)
    coverage = mask.mean()
    if coverage < 0.02:
        return None
    return mask


def mask_bbox(mask):
    ys, xs = np.where(mask)
    if len(ys) < 32:
        return None
    return int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())


# ── Colour science ───────────────────────────────────────────────────

def srgb_to_lab(rgb):
    """sRGB (0-255) -> CIELAB, D65. Vectorised over an (N,3) array."""
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ])
    xyz = c @ m.T
    white = np.array([0.95047, 1.0, 1.08883])
    t = xyz / white
    f = np.where(t > (6 / 29) ** 3, np.cbrt(t), t / (3 * (6 / 29) ** 2) + 4 / 29)
    L = 116 * f[:, 1] - 16
    a = 500 * (f[:, 0] - f[:, 1])
    b = 200 * (f[:, 1] - f[:, 2])
    return np.stack([L, a, b], axis=1)


def ciede2000(lab1, lab2, kL=2.0):
    """CIEDE2000 colour difference between two single LAB values.

    kL=2 is the textile-industry parameterisation (ISO 105-J03): lightness
    differences are half-weighted, because fabric lightness varies with
    illumination and drape far more than its chromaticity does. Our photos are
    cross-lighting by nature, so textile mode is the honest default.
    """
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2
    C1 = np.hypot(a1, b1)
    C2 = np.hypot(a2, b2)
    Cbar = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = np.hypot(a1p, b1), np.hypot(a2p, b2)
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360
    h2p = np.degrees(np.arctan2(b2, a2p)) % 360
    dLp = L2 - L1
    dCp = C2p - C1p
    dh = h2p - h1p
    if C1p * C2p == 0:
        dhp = 0.0
    elif abs(dh) <= 180:
        dhp = dh
    elif dh > 180:
        dhp = dh - 360
    else:
        dhp = dh + 360
    dHp = 2 * np.sqrt(C1p * C2p) * np.sin(np.radians(dhp) / 2)
    Lbp = (L1 + L2) / 2
    Cbp = (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbp = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbp = (h1p + h2p) / 2
    elif h1p + h2p < 360:
        hbp = (h1p + h2p + 360) / 2
    else:
        hbp = (h1p + h2p - 360) / 2
    T = (1 - 0.17 * np.cos(np.radians(hbp - 30))
         + 0.24 * np.cos(np.radians(2 * hbp))
         + 0.32 * np.cos(np.radians(3 * hbp + 6))
         - 0.20 * np.cos(np.radians(4 * hbp - 63)))
    dTheta = 30 * np.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * np.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    Sl = 1 + (0.015 * (Lbp - 50) ** 2) / np.sqrt(20 + (Lbp - 50) ** 2)
    Sc = 1 + 0.045 * Cbp
    Sh = 1 + 0.015 * Cbp * T
    Rt = -np.sin(np.radians(2 * dTheta)) * Rc
    return float(np.sqrt(
        (dLp / (kL * Sl)) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2
        + Rt * (dCp / Sc) * (dHp / Sh)
    ))


def gray_world_gains(img, mask):
    """Per-channel gains that equalise the masked means — cancels a global
    illumination tint without touching genuine garment colour differences."""
    pixels = img[mask]
    means = pixels.mean(axis=0)
    gray = means.mean()
    gains = np.where(means > 1e-6, gray / means, 1.0)
    return np.clip(gains, 0.6, 1.6)


def kmeans_lab(lab_pixels, k=3, iters=14):
    """Deterministic k-means. Init is farthest-point (seeded from the
    brightest pixel), so identical inputs always give identical clusters."""
    n = lab_pixels.shape[0]
    if n < k * 8:
        w = np.ones(1)
        return lab_pixels.mean(axis=0, keepdims=True), w
    centers = [lab_pixels[np.argmax(lab_pixels[:, 0])]]
    for _ in range(k - 1):
        d = np.min(
            np.stack([np.linalg.norm(lab_pixels - c, axis=1) for c in centers]),
            axis=0,
        )
        centers.append(lab_pixels[np.argmax(d)])
    centers = np.stack(centers)
    for _ in range(iters):
        d = np.linalg.norm(lab_pixels[:, None, :] - centers[None, :, :], axis=2)
        labels = np.argmin(d, axis=1)
        new = np.stack([
            lab_pixels[labels == i].mean(axis=0) if np.any(labels == i) else centers[i]
            for i in range(k)
        ])
        if np.allclose(new, centers, atol=1e-4):
            centers = new
            break
        centers = new
    d = np.linalg.norm(lab_pixels[:, None, :] - centers[None, :, :], axis=2)
    labels = np.argmin(d, axis=1)
    weights = np.array([(labels == i).mean() for i in range(k)])
    order = np.argsort(-weights)
    return centers[order], weights[order]


# Where a garment category lives on a standing figure, as a vertical band of
# the frame. Anchors and catalogs are on-model or hung shots; without a parsing
# model this prior is what separates "the crop top" from "the jeans she is
# also wearing". SegFormer parsing supersedes this when its weights are
# installed — this is the documented fallback, not the end state.
GARMENT_REGION_BANDS = {
    "top": (0.12, 0.58),
    "bottom": (0.42, 0.96),
    "full": (0.10, 0.90),
}

TOP_WORDS = ("top", "shirt", "tshirt", "t-shirt", "blouse", "crop", "tee", "sweater", "hoodie", "jacket")
BOTTOM_WORDS = ("jean", "trouser", "pant", "skirt", "short", "legging", "palazzo")


def region_band_for(garment_hint):
    hint = str(garment_hint or "").lower()
    if any(word in hint for word in BOTTOM_WORDS):
        return GARMENT_REGION_BANDS["bottom"]
    if any(word in hint for word in TOP_WORDS):
        return GARMENT_REGION_BANDS["top"]
    return GARMENT_REGION_BANDS["full"]


def color_profile(path, garment_hint=None, mode="model", sample_cap=60000):
    """Palette of the garment in a photo.

    mode="closeup": the fabric fills the frame (anchor close-ups). No masking —
    masking heuristics assume a background exists and destroy the palette when
    it doesn't. A 4% margin trim drops incidental edges (a finger, a table).

    mode="model": on-model or hung shot. Garment located by the declared
    category's body-region band plus interior/border cluster voting.
    """
    img = load_rgb(path)
    h, w, _ = img.shape

    if mode == "closeup":
        my, mx = int(h * 0.04), int(w * 0.04)
        region = img[my:h - my, mx:w - mx]
        mask = np.ones(region.shape[:2], dtype=bool)
        # No chromatic normalisation here: gray-world assumes the scene
        # averages to gray, but a closeup IS the garment — normalising would
        # bleach the very colour being verified. Cross-lighting robustness
        # comes from kL=2 textile delta-E instead.
        pixels = region[mask]
    else:
        y0f, y1f = region_band_for(garment_hint)
        region = img[int(h * y0f):int(h * y1f)]
        if region.shape[0] < 24:
            region = img
        mask = background_mask(region)
        if mask is None:
            return None
        gains = gray_world_gains(region, mask)
        pixels = np.clip(region[mask] * gains, 0, 255)
    if pixels.shape[0] > sample_cap:
        step = pixels.shape[0] // sample_cap
        pixels = pixels[::step]
    lab = srgb_to_lab(pixels)
    centers, weights = kmeans_lab(lab, k=3)
    return {"centers": centers, "weights": weights, "coverage": float(mask.mean())}


def compare_colors(anchor_path, catalog_path, garment_hint=None, anchor_mode="closeup", catalog_mode="model"):
    """Weighted greedy palette match between the two garments' LAB clusters.

    delta_e_weighted is the shopper-facing number: <2 imperceptible, 2-6 close,
    6-12 noticeably different tone, >12 reads as a different colour.
    """
    pa = color_profile(anchor_path, garment_hint, mode=anchor_mode)
    pc = color_profile(catalog_path, garment_hint, mode=catalog_mode)
    if pa is None or pc is None:
        return {"success": False, "error": "garment mask could not be established"}

    ca, wa = pa["centers"], pa["weights"]
    cc, wc = pc["centers"], pc["weights"]

    # Asymmetric question, on purpose: does every significant colour of the
    # PHYSICAL garment survive into the catalog? Each significant anchor
    # cluster finds its nearest catalog cluster (sharing allowed). Extra
    # catalog-only clusters — a model's skin, a background remnant — are
    # ignored rather than punished; a missing physical colour is punished.
    total_w = 0.0
    acc = 0.0
    pairs = []
    for i in range(ca.shape[0]):
        w = float(wa[i])
        if w < 0.12:
            continue  # noise cluster, not a shopper-visible colour
        des = [ciede2000(ca[i], cc[j]) for j in range(cc.shape[0])]
        j = int(np.argmin(des))
        best_de = des[j]
        acc += best_de * w
        total_w += w
        pairs.append({
            "anchor_lab": [round(float(v), 1) for v in ca[i]],
            "catalog_lab": [round(float(v), 1) for v in cc[j]],
            "anchor_weight": round(w, 3),
            "delta_e": round(best_de, 2),
        })
    de_weighted = acc / total_w if total_w else None
    # Dominant-cluster delta E on its own: the single most shopper-visible tone.
    de_dominant = pairs[0]["delta_e"] if pairs else None
    return {
        "success": True,
        "delta_e_weighted": round(de_weighted, 2) if de_weighted is not None else None,
        "delta_e_dominant": de_dominant,
        "pairs": pairs,
        "anchor_coverage": round(pa["coverage"], 3),
        "catalog_coverage": round(pc["coverage"], 3),
        "method": "LAB k-means + CIEDE2000, gray-world normalised",
    }


def compare_color_sets(anchor_paths, catalog_paths, garment_hint=None):
    """Per-view colour comparison across the two evidence sets.

    Views are compared like-with-like — front↔front, back↔back,
    closeup↔closeup — because same-view pairs share framing and usually
    lighting, which is what makes a delta-E meaningful. The set verdict is the
    MEDIAN of per-view delta-Es, so one occluded or badly lit view (hair over
    the back, a shadowed closeup) cannot dominate the reading either way.
    """
    view_plan = [
        ("front", 0, 0, "model", "model"),
        ("back", 1, 1, "model", "model"),
        ("closeup", 2, 2, "closeup", "closeup"),
    ]
    views = []
    for name, ai, ci, anchor_mode, catalog_mode in view_plan:
        if ai >= len(anchor_paths) or ci >= len(catalog_paths):
            continue
        r = compare_colors(
            anchor_paths[ai], catalog_paths[ci], garment_hint,
            anchor_mode=anchor_mode, catalog_mode=catalog_mode,
        )
        if r.get("success") and r.get("delta_e_weighted") is not None:
            views.append({"view": name, "delta_e": r["delta_e_weighted"], "detail": r})
    if not views:
        return {"success": False, "error": "no view pair produced a usable colour reading"}
    des = sorted(v["delta_e"] for v in views)
    median = des[len(des) // 2] if len(des) % 2 else (des[len(des) // 2 - 1] + des[len(des) // 2]) / 2
    return {
        "success": True,
        "delta_e_median": round(median, 2),
        "views": [{"view": v["view"], "delta_e": v["delta_e"]} for v in views],
        "views_used": len(views),
        "method": "per-view LAB k-means + CIEDE2000 (kL=2 textile), median across views",
    }


# ── Print / texture geometry ─────────────────────────────────────────

FFT_WINDOW = 256


def texture_features(path):
    """Dominant periodic structure of the garment surface.

    Reports the stripe/print repeat as cycles per garment-width, which is
    invariant to how far away the camera was — the property a catalog render
    must preserve for the fabric to look right.
    """
    img = load_rgb(path)
    mask = background_mask(img)
    if mask is None:
        return None
    bbox = mask_bbox(mask)
    if bbox is None:
        return None
    y0, y1, x0, x1 = bbox
    if (y1 - y0) < 32 or (x1 - x0) < 32:
        return None
    gray = img.mean(axis=2)
    crop = gray[y0:y1 + 1, x0:x1 + 1]
    crop_mask = mask[y0:y1 + 1, x0:x1 + 1]
    garment_width = x1 - x0 + 1

    # Neutralise background inside the bbox so it contributes no structure.
    mean_val = crop[crop_mask].mean()
    crop = np.where(crop_mask, crop, mean_val)

    # Resize to the analysis window via PIL for clean interpolation.
    pil = Image.fromarray(np.clip(crop, 0, 255).astype(np.uint8))
    pil = pil.resize((FFT_WINDOW, FFT_WINDOW), Image.LANCZOS)
    w = np.asarray(pil, dtype=np.float64)
    w = w - w.mean()
    # Hann window to suppress edge artefacts.
    hann = np.hanning(FFT_WINDOW)
    w = w * hann[:, None] * hann[None, :]

    spec = np.abs(np.fft.fftshift(np.fft.fft2(w)))
    c = FFT_WINDOW // 2
    yy, xx = np.mgrid[0:FFT_WINDOW, 0:FFT_WINDOW]
    rr = np.hypot(yy - c, xx - c)
    # Exclude DC and near-DC (global shading) and the extreme edge.
    valid = (rr >= 3) & (rr <= c - 2)
    spec_v = np.where(valid, spec, 0)

    peak_idx = np.unravel_index(np.argmax(spec_v), spec_v.shape)
    peak_r = rr[peak_idx]
    peak_mag = spec_v[peak_idx]
    background_mag = spec_v[valid].mean()
    periodicity = float(peak_mag / (background_mag + 1e-9))

    # The garment bbox was resized to exactly one analysis window, so a peak at
    # radius r is r cycles per window == r cycles per garment width. That makes
    # the number camera-distance-invariant, which is the whole point.
    cycles_per_garment = float(peak_r)

    orientation = float(np.degrees(np.arctan2(peak_idx[0] - c, peak_idx[1] - c))) % 180

    # Texture energy: gradient magnitude mean over the masked garment. This is
    # the print-coverage signal (a removed back print collapses it).
    gy, gx = np.gradient(gray)
    grad = np.hypot(gx, gy)
    texture_energy = float(grad[mask].mean())

    return {
        "cycles_per_garment_width": round(cycles_per_garment, 2),
        "periodicity_strength": round(periodicity, 2),
        "orientation_deg": round(orientation, 1),
        "texture_energy": round(texture_energy, 3),
    }


# A peak this many times the spectrum mean means genuinely periodic structure
# (stripes, checks, regular motifs) rather than noise.
PERIODIC_THRESHOLD = 18.0


def compare_texture(anchor_path, catalog_path):
    fa = texture_features(anchor_path)
    fc = texture_features(catalog_path)
    if fa is None or fc is None:
        return {"success": False, "error": "garment region could not be isolated"}

    a_periodic = fa["periodicity_strength"] >= PERIODIC_THRESHOLD
    c_periodic = fc["periodicity_strength"] >= PERIODIC_THRESHOLD

    result = {
        "success": True,
        "anchor": fa,
        "catalog": fc,
        "anchor_periodic": a_periodic,
        "catalog_periodic": c_periodic,
        "method": "2-D FFT dominant period (cycles per garment width) + gradient texture energy",
    }

    if a_periodic and c_periodic:
        ratio = fc["cycles_per_garment_width"] / max(fa["cycles_per_garment_width"], 1e-6)
        result["period_ratio"] = round(ratio, 3)
        result["orientation_delta_deg"] = round(
            min(
                abs(fa["orientation_deg"] - fc["orientation_deg"]),
                180 - abs(fa["orientation_deg"] - fc["orientation_deg"]),
            ), 1)
        result["applicable"] = True
    elif a_periodic != c_periodic:
        # One has regular structure the other lacks — the "print got simplified
        # or invented" case. Strong evidence in its own right.
        result["applicable"] = True
        result["structure_mismatch"] = True
    else:
        # Both solid: the channel truthfully has nothing to say about print
        # scale. Texture energy ratio still speaks to overall surface detail.
        result["applicable"] = False

    energy_ratio = fc["texture_energy"] / max(fa["texture_energy"], 1e-6)
    result["texture_energy_ratio"] = round(energy_ratio, 3)
    return result
