# app/services/grok_client.py
"""
Groq client wrapper for Crime Tracer Mangalore.

We use Groq for:
- Precaution tips for victims based on complaint text.
- BNS section suggestions based on crime description (fallback).
- Summarization.
- Severity Prediction.

If GROK_API_KEY is not configured or API fails, we return
safe, generic fallbacks so the flow never breaks.
"""

from typing import Dict, List, Optional
import logging
import json
import re
import urllib.request

from ..config import settings

logger = logging.getLogger("crime_tracer.grok")

try:
    from groq import Groq  # type: ignore
    _groq_available = True
except ImportError:
    _groq_available = False
    logger.warning("groq not installed; Groq features disabled.")


def _get_client():
    """Get configured Groq client."""
    if not _groq_available:
        return None
    if not settings.GROK_API_KEY:
        logger.warning("GROK_API_KEY not set; Groq features disabled.")
        return None
    try:
        client = Groq(api_key=settings.GROK_API_KEY)
        return client
    except Exception as e:
        logger.error(f"Failed to configure Groq client: {e}", exc_info=True)
        return None


def _generate_content(prompt: str, model: Optional[str] = None) -> Optional[str]:
    """Generate content using Groq API with circuit breaker and retry logic."""
    from ..utils.circuit_breaker import grok_circuit_breaker
    from ..utils.retry import retry_with_backoff
    from ..utils.exceptions import ExternalServiceError
    
    client = _get_client()
    if not client:
        return None
    
    # Use Groq's available models - llama3 is fast and capable
    model_name = model or getattr(settings, "GROK_MODEL", None) or "llama-3.3-70b-versatile"
    
    @retry_with_backoff(max_attempts=3, initial_delay=1.0, exceptions=(Exception,))
    def _call_api():
        return client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "user", "content": prompt}
            ],
        )
    
    try:
        response = grok_circuit_breaker.call(_call_api)
        return response.choices[0].message.content
    except ExternalServiceError:
        # Circuit breaker is open or service unavailable
        logger.warning("Groq API unavailable (circuit breaker open or service error)")
        return None
    except Exception as e:
        logger.error(f"Groq API call failed: {e}", exc_info=True)
        return None


# ---------- Summarization ----------

def _fallback_summary(crime_type: str, description: str) -> Dict:
    """Generate a context-aware fallback summary when AI is unavailable."""
    # Create a basic summary from the description
    desc_preview = description[:200] + "..." if len(description) > 200 else description
    return {
        "summary_text": f"A {crime_type.lower()} incident has been reported. {desc_preview}",
        "keywords": [crime_type.lower()]
    }


def summarize_complaint(complaint) -> Dict:
    """
    Summarize the complaint description + crime type for the victim.
    Returns a concise ~100 word summary.
    """
    prompt = f"""You are a helpful assistant providing case updates to a crime victim.
    
Summarize this complaint in a clear, empathetic way (~100 words).
Focus on: what happened, what evidence was provided, and next steps they can expect.

Crime Type: {complaint.crime_type}
Description:
\"\"\"{complaint.description}\"\"\"

Return ONLY the summary paragraph, no headings or labels.
"""

    text = _generate_content(prompt)
    
    if not text:
        return _fallback_summary(complaint.crime_type, complaint.description)

    return {"summary_text": text.strip(), "keywords": []}


def generate_officer_summary(crime_type: str, description: str, location: str = "") -> Dict:
    """
    Generate a detailed summary for investigating officers (~150 words).
    Includes key facts, potential leads, and investigation priorities.
    """
    prompt = f"""You are a senior police desk officer preparing a case brief for investigating officers.

Analyze this complaint and provide a comprehensive briefing (~150 words):
- Key facts and timeline
- Potential evidence to collect
- Suggested investigation priorities
- Risk assessment

Crime Type: {crime_type}
Location: {location or "Not specified"}
Complaint:
\"\"\"{description}\"\"\"

Return a professional police briefing format. Be factual and actionable.
"""

    text = _generate_content(prompt)
    
    if not text:
        # Fallback: Extract key information
        return {
            "officer_summary": f"CASE BRIEF - {crime_type.upper()}\n\n"
                              f"Incident Type: {crime_type}\n"
                              f"Location: {location or 'To be verified'}\n"
                              f"Description: {description[:300]}{'...' if len(description) > 300 else ''}\n\n"
                              f"RECOMMENDED ACTIONS:\n"
                              f"1. Verify complainant identity and contact details\n"
                              f"2. Visit scene of incident if applicable\n"
                              f"3. Collect witness statements\n"
                              f"4. Document and preserve evidence",
            "priority": "MEDIUM"
        }
    
    return {"officer_summary": text.strip(), "priority": "PENDING_REVIEW"}


# ---------- Use Backend Model for BNS (Primary) ----------

def _call_local_bns_model(description: str) -> Optional[List[Dict]]:
    """
    Attempt to call local Backend_Model at configured URL with circuit breaker and retry.
    """
    from ..utils.circuit_breaker import ml_service_circuit_breaker
    from ..utils.retry import retry_with_backoff
    from ..utils.exceptions import ExternalServiceError
    
    url = getattr(settings, "MODEL_SERVICE_URL", "http://localhost:8001/predict")
    payload = {"facts": description, "top_k": 3}
    
    @retry_with_backoff(max_attempts=3, initial_delay=1.0, exceptions=(Exception,))
    def _make_request():
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url, 
            data=data, 
            headers={"Content-Type": "application/json"}, 
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                return json.loads(response.read().decode("utf-8"))
            else:
                raise Exception(f"ML service returned status {response.status}")
    
    try:
        resp_data = ml_service_circuit_breaker.call(_make_request)
        logger.info(f"Local BNS model response: {resp_data}")
        
        # Map response to our format
        # Response format: {"bns": [{"section_id": "...", "name": "...", "meaning": "..."}], "crime_type": "..."}
        
        out = []
        bns_list = resp_data.get("bns", [])
        
        # If bns_list is empty, try predicted_sections (legacy)
        if not bns_list and "predicted_sections" in resp_data:
            for item in resp_data.get("predicted_sections", []):
                out.append({
                    "section": str(item.get("section_id", "Unknown")),
                    "title": "Suspected Offense",
                    "confidence": round(item.get("score", 0.0), 2),
                    "reason": item.get("evidence") or "Predicted by Local Model"
                })
            logger.info(f"Local BNS model returning {len(out)} sections (legacy format)")
            return out

        for item in bns_list:
            out.append({
                "section": str(item.get("section_id") or item.get("name") or "Unknown"),
                "title": item.get("name") or "Suspected Offense", 
                "confidence": 0.85,  # Model wrapper might not return score in 'bns' list, default high
                "reason": item.get("meaning") or "Predicted by Local Model"
            })
        
        logger.info(f"Local BNS model returning {len(out)} sections")
        return out
    except ExternalServiceError:
        logger.warning("ML service unavailable (circuit breaker open or service error)")
        return None
    except Exception as e:
        logger.warning(f"Local BNS model connection failed: {e}")
        import traceback
        traceback.print_exc()
        return None


def _generate_bns_via_groq(crime_type: str, description: str) -> List[Dict]:
    """
    Use Groq LLM to suggest BNS sections based on crime description.
    Prompt is strict: only sections that DIRECTLY relate to the complaint.
    """
    prompt = f"""You are an expert on the Bharatiya Nyaya Sanhita (BNS), India's new criminal code.

Based on the following complaint, suggest ONLY BNS sections that DIRECTLY and clearly apply to the type of crime described.

Crime Type: {crime_type}
Description: {description}

CRITICAL RULES:
- Suggest ONLY sections that match the SAME category of offence (e.g. for fraud/scam/cheating suggest cheating/fraud/cyber sections; for theft suggest theft sections).
- Do NOT suggest sections for completely different crimes (e.g. do NOT suggest sexual offence or rape sections for a fraud/scam/cheating complaint; do NOT suggest murder/assault for a cyber fraud complaint).
- PROMISE TO MARRY / BREACH OF PROMISE: If the complaint is about "said he will marry me", "promise to marry", "breach of promise", or deception about marriage (before or without marriage), suggest ONLY sections on cheating, fraud, or deception (e.g. cheating by personation, fraud). Do NOT suggest Section 80 (dowry death) or Section 85 (cruelty by husband/relative) — those apply only to post-marriage situations like dowry harassment or marital cruelty, NOT to promise-to-marry or pre-marital deception.
- DOWRY / MARITAL CRUELTY: Sections 80 (dowry death) and 85 (cruelty by husband/relative) apply ONLY when the complaint clearly describes post-marriage dowry harassment, bride burning, or cruelty by husband/in-laws. Do NOT use them for complaints about breach of promise to marry or "he said he will marry me".
- If the complaint is about scam, cheating, fraud, or financial/online deception, only suggest sections related to cheating, fraud, identity theft, or cyber crime.
- Return empty array [] if no section clearly applies.

For each applicable section, provide:
1. Section number (e.g., "319", "112")
2. Section title/name
3. Brief explanation of why it applies to THIS complaint

Return as JSON array only:
[
  {{"section": "XXX", "title": "Section Title", "reason": "Why this applies"}}
]

Return ONLY the JSON array, no other text. If unsure or no direct match, return [].
"""
    
    text = _generate_content(prompt)
    
    if not text:
        return []
    
    # Parse JSON response
    try:
        # Handle markdown code blocks
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        
        sections = json.loads(text.strip())
        
        if not isinstance(sections, list):
            return []
        
        result = []
        for item in sections[:5]:  # Limit to 5 sections
            result.append({
                "section": str(item.get("section", "Unknown")),
                "title": item.get("title", ""),
                "confidence": 0.75,  # LLM-generated, moderate confidence
                "reason": item.get("reason", "Suggested by AI analysis")
            })
        return result
    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"Failed to parse Groq BNS response: {e}")
        return []


def _filter_bns_by_relevance(description: str, crime_type: str, sections: List[Dict]) -> List[Dict]:
    """
    Use Groq to filter BNS sections to only those that actually apply to the complaint.
    Removes irrelevant sections (e.g. sexual offence sections for a scam complaint).
    If Groq fails or returns empty, returns the original list unchanged.
    """
    if not sections or len(sections) == 0:
        return sections
    # Build list of section numbers for the prompt
    section_nums = [str(s.get("section", "")).strip() for s in sections if s.get("section")]
    if not section_nums:
        return sections
    prompt = f"""You are a legal expert. Given this complaint, which of these BNS section numbers DIRECTLY apply to the type of crime described?

Complaint: {description}
Crime type: {crime_type}

Section numbers to consider: {json.dumps(section_nums)}

Rules:
- Include ONLY section numbers that match the SAME category of offence.
- Exclude sexual offence/rape sections for fraud/scam/cheating complaints.
- PROMISE TO MARRY: If the complaint is about "said he will marry me", "promise to marry", or breach of promise (pre-marriage deception), EXCLUDE Section 80 (dowry death) and Section 85 (cruelty by husband/relative). Those apply only to post-marriage dowry/cruelty, not promise-to-marry. For promise-to-marry suggest only cheating/fraud sections.
- Exclude any section that is for a completely different crime.

Return ONLY a JSON array of the section numbers that apply, e.g. ["319", "112"]. No other text. If none apply, return [].
"""
    text = _generate_content(prompt)
    if not text:
        return sections
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        allowed = json.loads(text.strip())
        if not isinstance(allowed, list):
            return sections
        allowed_set = {str(x).strip() for x in allowed}
        filtered = [s for s in sections if str(s.get("section", "")).strip() in allowed_set]
        if len(filtered) > 0:
            logger.info(f"BNS relevance filter: kept {len(filtered)} of {len(sections)} sections")
            return filtered
    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"BNS relevance filter failed: {e}")
    return sections


def generate_bns_sections(
    crime_type: str, description: str, location_text: str = ""
) -> List[Dict]:
    """
    Suggest BNS sections that match the complaint description.
    When PREFER_GROQ_BNS is True (default), uses Groq first so suggestions are description-aware
    (e.g. no dowry/rape sections for scam or promise-to-marry). Local model is fallback.
    """
    prefer_groq = getattr(settings, "PREFER_GROQ_BNS", True)
    groq_result: Optional[List[Dict]] = None

    # 1. Prefer Groq when enabled so BNS matches description (no wrong mappings like 80/85 for promise-to-marry)
    if prefer_groq:
        groq_result = _generate_bns_via_groq(crime_type, description)
        if groq_result:
            filtered = _filter_bns_by_relevance(description, crime_type, groq_result)
            return filtered if len(filtered) > 0 else groq_result

    # 2. Try Local Model (RAG HGAT)
    local_result = _call_local_bns_model(description)
    if local_result is not None and len(local_result) > 0:
        filtered = _filter_bns_by_relevance(description, crime_type, local_result)
        if len(filtered) > 0:
            return filtered
        logger.info("Local BNS sections filtered out as irrelevant; using Groq for suggestions.")

    # 3. Fallback to Groq if not yet used or local was filtered out
    if groq_result is None:
        groq_result = _generate_bns_via_groq(crime_type, description)
    if groq_result:
        filtered = _filter_bns_by_relevance(description, crime_type, groq_result)
        return filtered if len(filtered) > 0 else groq_result

    # 4. If all fails, return error message
    return [
        {
            "section": "N/A",
            "title": "Unable to suggest sections",
            "confidence": 0.0,
            "reason": "Both local model and AI service unavailable. Manual review required."
        }
    ]


# ---------- Precautions ----------

def _get_crime_specific_precautions(crime_type: str) -> List[str]:
    """Return crime-specific precautions when AI is unavailable."""
    crime_type_lower = crime_type.lower()
    
    if "theft" in crime_type_lower or "burglary" in crime_type_lower:
        return [
            "Document all stolen items with descriptions and approximate values for the police report.",
            "Check if any neighbors have CCTV footage that might have captured the incident.",
            "Change locks immediately if keys were stolen and alert your bank if cards were taken."
        ]
    elif "assault" in crime_type_lower or "violence" in crime_type_lower:
        return [
            "Seek immediate medical attention and keep all medical records as evidence.",
            "Stay in a safe location with trusted friends or family until the investigation proceeds.",
            "Document any injuries with photographs and note down names of any witnesses."
        ]
    elif "fraud" in crime_type_lower or "cyber" in crime_type_lower:
        return [
            "Do not delete any messages, emails, or transaction records related to the fraud.",
            "Alert your bank immediately to freeze any compromised accounts or cards.",
            "Change passwords on all online accounts and enable two-factor authentication."
        ]
    elif "harassment" in crime_type_lower:
        return [
            "Save all evidence including messages, calls, and screenshots with timestamps.",
            "Inform trusted family members or friends about the situation for support.",
            "Avoid any direct contact with the harasser and communicate only through official channels."
        ]
    elif "domestic" in crime_type_lower:
        return [
            "If in immediate danger, contact Women Helpline 181 or Police Emergency 100.",
            "Keep important documents (ID, bank details) in a safe place accessible to you.",
            "Reach out to local NGOs or shelter homes if you need a safe place to stay."
        ]
    elif "missing" in crime_type_lower:
        return [
            "Provide the police with recent photographs and last known whereabouts.",
            "Contact friends, relatives, and places the person frequently visits.",
            "Check hospitals and local transport stations in case of any emergency admission."
        ]
    else:
        # General precautions
        return [
            "Keep all evidence including photos, documents, and communications safely preserved.",
            "Note down names and contact details of any witnesses who saw the incident.",
            "Maintain a record of all interactions with police and case updates for your reference."
        ]


def generate_precautions(crime_type: str, complaint_text: str) -> Dict:
    """
    Generate context-aware precautions for the victim.
    Returns:
        {
          "precautions": [list of strings],
          "raw": <full raw model output or prompt-reply>
        }
    """
    prompt = f"""You are a victim assistance counselor helping a crime victim in India.

Based on this complaint, provide 3 specific, practical, and calming precautionary steps.

Crime Type: {crime_type}
Complaint:
\"\"\"{complaint_text}\"\"\"

Guidelines:
- Each precaution should be actionable and under 30 words
- Be empathetic but practical
- Focus on evidence preservation, personal safety, and next steps
- Do NOT mention specific legal sections

Return ONLY a numbered list (1. 2. 3.).
"""

    text = _generate_content(prompt)
    
    if not text:
        # Use crime-specific fallbacks instead of generic ones
        precautions = _get_crime_specific_precautions(crime_type)
        return {"precautions": precautions, "raw": "\n".join(precautions)}

    lines = [ln.strip(" -") for ln in text.splitlines() if ln.strip()]
    parsed: List[str] = []
    for ln in lines:
        if ln and ln[0].isdigit():
            ln = ln.lstrip("0123456789.)- ").strip()
        if ln:
            parsed.append(ln)

    precautions = parsed[:3] if parsed else _get_crime_specific_precautions(crime_type)
    return {"precautions": precautions, "raw": text}


# ---------- Severity Prediction ----------

def predict_severity(description: str, crime_type: str) -> str:
    """
    Predict severity: Low, Medium, High, Critical.
    """
    prompt = f"""
    Analyze the following crime complaint and predict the severity level.
    Options: Low, Medium, High, Critical.
    
    Crime Type: {crime_type}
    Description: {description}
    
    Return ONLY the one severity word.
    """
    
    text = _generate_content(prompt)
    
    if not text:
        return "Medium"
    
    try:
        # Clean up punctuation/case
        cleaned = re.sub(r"[^a-zA-Z]", "", text)
        if cleaned.lower() in ["low", "medium", "high", "critical"]:
            return cleaned.capitalize()
        # fallback simple heuristic
        if "murder" in crime_type.lower() or "rape" in crime_type.lower():
            return "Critical"
        return "Medium"
    except Exception as e:
        logger.error(f"Groq severity prediction failed: {e}")
        return "Medium"
