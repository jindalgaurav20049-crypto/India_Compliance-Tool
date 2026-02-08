from typing import Dict, List


def build_navigation_payload(violation: Dict, neighboring: List[Dict]) -> Dict:
    return {
        "violation_id": violation["violation_id"],
        "document_id": violation["document_reference"]["file_id"],
        "target_page": violation["document_reference"]["page"],
        "highlight_bbox": violation["document_reference"]["bounding_box"],
        "clause": violation["clause"],
        "reasoning": violation["reasoning"],
        "evidence_text": violation["evidence_text"],
        "neighbors": neighboring,
    }
