"""
Anchor — Fuzzy matching utilities for attribute comparison.
Uses synonym maps to prevent false positives on equivalent terms.
"""
from typing import Optional
from config import SYNONYM_MAP


def normalize(value: Optional[str]) -> Optional[str]:
    """Normalize an attribute value for comparison."""
    if value is None:
        return None
    return str(value).strip().lower().replace("-", "_").replace(" ", "_")


def find_synonym_group(attribute: str, value: str) -> Optional[str]:
    """Find which synonym group a value belongs to for a given attribute.
    Returns the group key, or None if no group found."""
    if attribute not in SYNONYM_MAP:
        return None

    norm_value = normalize(value)
    if norm_value is None:
        return None

    for group_key, synonyms in SYNONYM_MAP[attribute].items():
        normalized_synonyms = [normalize(s) for s in synonyms]
        if norm_value in normalized_synonyms:
            return group_key

    return None


def fuzzy_match(
    attribute: str,
    value1: Optional[str],
    value2: Optional[str],
) -> bool:
    """Check if two attribute values match, accounting for synonyms.
    
    Returns True if:
    - Both are None (both undetected — not a mismatch)
    - Both normalize to the same string
    - Both belong to the same synonym group
    
    Returns False if:
    - One is None and the other isn't (can't compare)
    - They don't match by any method
    """
    # Both None → can't compare, treat as not-a-mismatch
    if value1 is None and value2 is None:
        return True
    
    # One is None → skip this comparison (don't flag as mismatch)
    if value1 is None or value2 is None:
        return True  # Intentionally lenient — missing data ≠ mismatch
    
    norm1 = normalize(value1)
    norm2 = normalize(value2)
    
    # Exact match after normalization
    if norm1 == norm2:
        return True
    
    # Synonym group match
    group1 = find_synonym_group(attribute, value1)
    group2 = find_synonym_group(attribute, value2)
    
    if group1 is not None and group2 is not None:
        return group1 == group2
    
    # No synonym map for this attribute — try substring matching
    # "round neck" should match "round"
    if norm1 and norm2:
        if norm1 in norm2 or norm2 in norm1:
            return True
    
    return False


def compare_feature_lists(
    features1: Optional[list],
    features2: Optional[list],
) -> tuple[bool, str]:
    """Compare two lists of structural features.
    
    Returns (is_match, detail_string).
    A match means feature2 is a reasonable subset/superset of features1.
    """
    if features1 is None or features2 is None:
        return True, "Feature comparison skipped (missing data)"
    
    if not isinstance(features1, list) or not isinstance(features2, list):
        return True, "Feature comparison skipped (invalid format)"
    
    norm1 = {normalize(f) for f in features1 if f}
    norm2 = {normalize(f) for f in features2 if f}
    
    if not norm1 and not norm2:
        return True, "No features detected in either image"
    
    # Check for missing features (in anchor but not in catalog)
    missing = norm1 - norm2
    # Check for extra features (in catalog but not in anchor)
    extra = norm2 - norm1
    
    if not missing and not extra:
        return True, "All features match"
    
    details = []
    if missing:
        details.append(f"Missing in catalog: {', '.join(missing)}")
    if extra:
        details.append(f"Extra in catalog: {', '.join(extra)}")
    
    # Minor differences (1 feature) → warning, not fail
    if len(missing) + len(extra) <= 1:
        return True, f"Minor feature difference: {'; '.join(details)}"
    
    return False, f"Feature mismatch: {'; '.join(details)}"
