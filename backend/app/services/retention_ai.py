import json
import logging
import os
from typing import Dict, Any, List, Optional
import httpx

from app.models.member import Member
from app.models.prediction import Prediction
from app.models.processed_customer import ProcessedCustomer

logger = logging.getLogger(__name__)


def generate_heuristic_strategy(
    member: Member,
    prediction: Prediction,
    features: Optional[ProcessedCustomer],
    active_plan_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Intelligent domain-grounded retention reasoning engine for The DGym Rosario Batangas.
    Produces rich, personalized, actionable strategies based on member behavioral vectors.
    """
    days_inactive = features.days_since_last_checkin if features else 7
    freq = features.visit_frequency_weekly if features else 1.0
    pt_sessions = features.total_pt_sessions if features else 0
    class_bookings = features.total_class_bookings if features else 0
    tenure = features.membership_tenure_days if features else 30
    plan = active_plan_name or "Gym Pass"
    first_name = member.first_name

    risk_tier = (prediction.risk_tier or "MEDIUM").upper()
    prob_pct = int(prediction.churn_probability * 100)

    # 1. CRITICAL: High risk & long inactive (> 14 days)
    if risk_tier == "HIGH" and days_inactive >= 14:
        return {
            "urgency": "CRITICAL",
            "strategy_title": f"Urgent Comeback Protocol — {first_name}'s Strength Re-engagement",
            "diagnosis_summary": (
                f"{first_name} has been absent from the barbell turf for {days_inactive} consecutive days "
                f"with a high churn probability of {prob_pct}%. Weekly check-ins have plummeted to {freq}x/week. "
                f"Without immediate intervention, complete athlete dropout is imminent upon {plan} expiration."
            ),
            "tactical_action_steps": [
                f"Direct WhatsApp/SMS outreach from Front Desk acknowledging {first_name}'s lifting milestones.",
                "Conduct a brief check-in to identify scheduling, fatigue, or recovery roadblocks.",
                "Offer a complimentary 1-on-1 barbell technique and form review session with Head Coach Mark.",
                "Provide a low-barrier re-entry invitation with zero re-activation fees.",
            ],
            "offer_title": "🔥 Comeback Special: 20% OFF Next Renewal + Free 1-on-1 Form Check",
            "offer_message": (
                f"Kumusta, {first_name}! We miss having you on the turf. Jump back into your training groove "
                f"with an exclusive 20% discount on your next membership pass plus a complimentary 1-on-1 technique assessment with our certified coaches."
            ),
            "offer_action_text": "Claim Comeback Offer",
            "offer_action_url": "/membership",
        }

    # 2. HIGH: High risk with low frequency (< 1.5x/week)
    if risk_tier == "HIGH" or days_inactive >= 10:
        return {
            "urgency": "HIGH",
            "strategy_title": f"Habit Rebuilding & Community Immersion — {first_name}",
            "diagnosis_summary": (
                f"{first_name} exhibits inconsistent attendance ({freq}x/week) and {days_inactive} days since last visit. "
                f"Current churn risk is evaluated at {prob_pct}%. Low group class participation ({class_bookings} classes) "
                f"indicates weak community anchoring."
            ),
            "tactical_action_steps": [
                f"Invite {first_name} to join the Tuesday/Thursday Conditioning Circuit or Saturday Deadlift Clinic.",
                "Coach check-in on the floor during next entry to evaluate current program split.",
                "Suggest a paired training partner or introduce to regular morning/evening barbell lifters.",
            ],
            "offer_title": "⚡ Barbell Momentum Perk: Free Saturday Clinic Access",
            "offer_message": (
                f"Hey {first_name}! Build consistent lifting momentum with complimentary access to our Saturday "
                f"Powerlifting & Deadlift Clinic, or renew your {plan} today with a 15% loyalty bonus."
            ),
            "offer_action_text": "Explore Classes & Perks",
            "offer_action_url": "/classes",
        }

    # 3. MEDIUM: Moderate risk / Tenure fading
    if risk_tier == "MEDIUM":
        return {
            "urgency": "MODERATE",
            "strategy_title": f"Tenure Appreciation & Progression Incentive — {first_name}",
            "diagnosis_summary": (
                f"{first_name} has {tenure} days of gym tenure with moderate churn risk ({prob_pct}%). "
                f"While attendance ({freq}x/week) is steady, lack of coached PT sessions ({pt_sessions} sessions) "
                f"and upcoming renewal could trigger hesitation."
            ),
            "tactical_action_steps": [
                f"Congratulate {first_name} at the front desk for reaching {tenure} days as an athlete at The DGym.",
                "Provide feedback on lifting progress and invite to participate in the upcoming gym mock-meet.",
                "Present early renewal discount before the current membership term concludes.",
            ],
            "offer_title": "🏆 Loyal Lifter Perk: 15% OFF Quarterly Membership",
            "offer_message": (
                f"Thank you for being part of The DGym family, {first_name}! As a verified athlete, "
                f"lock in your quarterly pass before term expiration and save 15% upfront."
            ),
            "offer_action_text": "Renew with 15% OFF",
            "offer_action_url": "/membership",
        }

    # 4. LOW: Loyal habitual lifters
    return {
        "urgency": "MODERATE",
        "strategy_title": f"Advocacy & VIP Athlete Protocol — {first_name}",
        "diagnosis_summary": (
            f"{first_name} is a high-engagement athlete ({freq}x/week, {days_inactive} days since visit, {prob_pct}% churn probability). "
            f"Strategy focuses on advocacy, rewards, and referral opportunities."
        ),
        "tactical_action_steps": [
            f"Acknowledge {first_name}'s lifting dedication in-person.",
            "Offer a complimentary VIP weekend pass for a friend or training buddy.",
            "Explore interest in specialized powerlifting programming or advanced barbell equipment.",
        ],
        "offer_title": "🎁 Athlete Perk: Free Weekend Buddy Pass",
        "offer_message": (
            f"You're crushing your sessions, {first_name}! As one of our most consistent athletes, "
            f"bring a training buddy for free this weekend to experience The DGym barbell turf."
        ),
        "offer_action_text": "View Athlete Dashboard",
        "offer_action_url": "/dashboard",
    }


async def generate_ai_retention_strategy(
    member: Member,
    prediction: Prediction,
    features: Optional[ProcessedCustomer],
    active_plan_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generates AI Retention Strategy using OpenAI GPT-4o-mini when OPENAI_API_KEY is available,
    or gracefully falls back to the heuristic domain engine.
    """
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()

    if not openai_key:
        logger.info("OPENAI_API_KEY not configured. Utilizing intelligent heuristic retention engine.")
        return generate_heuristic_strategy(member, prediction, features, active_plan_name)

    # If OpenAI key is present, attempt LLM generation
    try:
        system_prompt = (
            "You are the Head of Athlete Retention and Performance Director for 'The DGym' located in Rosario, Batangas. "
            "The DGym is a high-end weightlifting, powerlifting, and athletic fitness facility. "
            "Analyze the member's profile, XGBoost churn risk score, and feature vector. "
            "Respond ONLY with a valid JSON object matching this schema:\n"
            "{\n"
            '  "urgency": "CRITICAL" | "HIGH" | "MODERATE",\n'
            '  "strategy_title": "string (concise, inspiring title)",\n'
            '  "diagnosis_summary": "string (2-3 sentences explaining why they are slipping away)",\n'
            '  "tactical_action_steps": ["step 1", "step 2", "step 3"],\n'
            '  "offer_title": "string (clear promotional headline)",\n'
            '  "offer_message": "string (warm, motivating member-facing message)",\n'
            '  "offer_action_text": "string (button text, e.g. Claim 20% Off)",\n'
            '  "offer_action_url": "string (e.g. /membership or /dashboard/book)"\n'
            "}"
        )

        user_content = {
            "athlete_name": member.full_name,
            "member_code": member.member_code,
            "active_plan": active_plan_name or "Standard Member",
            "risk_tier": prediction.risk_tier,
            "churn_probability": round(prediction.churn_probability, 3),
            "top_risk_factors": [
                f for f in [prediction.top_risk_factor_1, prediction.top_risk_factor_2, prediction.top_risk_factor_3] if f
            ],
            "metrics": {
                "days_since_last_checkin": features.days_since_last_checkin if features else 0,
                "visit_frequency_weekly": features.visit_frequency_weekly if features else 0.0,
                "total_visits_30d": features.total_visits_30d if features else 0,
                "total_class_bookings": features.total_class_bookings if features else 0,
                "total_pt_sessions": features.total_pt_sessions if features else 0,
                "membership_tenure_days": features.membership_tenure_days if features else 0,
            },
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openai_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": json.dumps(user_content)},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.4,
                },
            )

            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                result = json.loads(content)
                # Ensure all required keys exist
                required_keys = [
                    "urgency",
                    "strategy_title",
                    "diagnosis_summary",
                    "tactical_action_steps",
                    "offer_title",
                    "offer_message",
                    "offer_action_text",
                    "offer_action_url",
                ]
                if all(k in result for k in required_keys):
                    return result
            else:
                logger.warning(f"OpenAI API returned status {resp.status_code}: {resp.text}")

    except Exception as exc:
        logger.warning(f"OpenAI call failed ({exc}). Falling back to heuristic retention engine.")

    return generate_heuristic_strategy(member, prediction, features, active_plan_name)
