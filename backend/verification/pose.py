"""
Mathematical Proportion Checking via MediaPipe & Segmentation.

This module resolves the LLM hallucination hurdle for spatial reasoning.
It combines MediaPipe 3D body landmarks with U2Net segmentation to mathematically 
determine exactly where a garment's hemline falls on the model's body, independent of LLM guesswork.
"""

import mediapipe as mp
import numpy as np
from PIL import Image
from verification.segmentation import segment_garment

mp_pose = mp.solutions.pose

def analyze_proportions(image: Image.Image) -> dict:
    """
    Detects body landmarks and overlay the garment's segmentation mask
    to calculate exactly where the garment falls on the body.
    """
    with mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.5) as pose:
        image_np = np.array(image.convert("RGB"))
        results = pose.process(image_np)

        if not results.pose_landmarks:
            return {"error": "Could not clearly detect body landmarks due to pose or occlusion."}

        landmarks = results.pose_landmarks.landmark
        
        # Get Y coordinates (normalized 0.0 to 1.0, 0 is top of image, 1 is bottom)
        shoulder_y = (landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].y + 
                      landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y) / 2
        
        hip_y = (landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].y + 
                 landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y) / 2
                 
        knee_y = (landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].y + 
                  landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].y) / 2
                  
        ankle_y = (landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].y + 
                   landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].y) / 2

        # 2. Get the actual garment hemline using the segmentation mask
        cutout, conf = segment_garment(image)
        if conf < 0.2:
            return {"error": "Could not segment garment to find hemline."}
            
        alpha = np.array(cutout.split()[-1])
        y_indices, _ = np.where(alpha > 128)
        
        if len(y_indices) == 0:
            return {"error": "Empty garment mask."}
            
        # The maximum Y index is the lowest point of the garment (the hemline)
        hemline_y_pixel = np.max(y_indices)
        hemline_y = hemline_y_pixel / image.height

        # 3. Mathematically classify the hemline
        # Calculate distances to standard landmarks
        dist_to_hip = abs(hemline_y - hip_y)
        dist_to_knee = abs(hemline_y - knee_y)
        dist_to_ankle = abs(hemline_y - ankle_y)
        
        # Determine closest landmark
        min_dist = min(dist_to_hip, dist_to_knee, dist_to_ankle)
        
        if min_dist == dist_to_hip:
            actual_length = "hip_length"
        elif min_dist == dist_to_knee:
            # Check if it's strictly above or below knee for nuance
            if hemline_y < knee_y - 0.05:
                actual_length = "above_knee"
            elif hemline_y > knee_y + 0.05:
                actual_length = "below_knee"
            else:
                actual_length = "knee_length"
        else:
            actual_length = "ankle_length"

        return {
            "landmarks": {
                "shoulder_y": round(shoulder_y, 3),
                "hip_y": round(hip_y, 3),
                "knee_y": round(knee_y, 3),
                "ankle_y": round(ankle_y, 3)
            },
            "detected_hemline_y": round(hemline_y, 3),
            "mathematical_length_category": actual_length
        }
