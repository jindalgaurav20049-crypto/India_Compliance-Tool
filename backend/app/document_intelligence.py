from typing import Dict, List


def extract_sections(raw_text: str) -> List[Dict]:
    sections = []
    anchors = [
        "balance sheet",
        "statement of profit and loss",
        "cash flow",
        "notes",
        "related party",
        "auditor",
        "esg",
        "brsr",
    ]
    text_lower = raw_text.lower()
    for anchor in anchors:
        if anchor in text_lower:
            sections.append(
                {
                    "section_title": anchor,
                    "start_page": 1,
                    "end_page": 1,
                    "confidence": 0.7,
                }
            )
    return sections


def extract_evidence(raw_text: str) -> List[Dict]:
    snippets = [line.strip() for line in raw_text.split("\n") if line.strip()][:5]
    return [
        {
            "evidence_text": snippet,
            "page": 1,
            "bbox": {"x1": 50, "y1": 100 + idx * 20, "x2": 550, "y2": 118 + idx * 20},
            "source": "ocr_or_digital_text",
        }
        for idx, snippet in enumerate(snippets)
    ]
