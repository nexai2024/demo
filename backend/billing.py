"""Plan catalogue mirrored from Clerk Billing.

Clerk is the source of truth for checkout and subscription state. Webhooks
copy the active plan slug into our user / organization records so quota
checks stay local and fast. Unknown paid slugs fail upward to Pro-level
limits rather than silently dropping a paying customer back to Free.
"""

PLANS = {
    "free": {"name": "Free", "recordings": 20, "seconds": 20 * 120, "rank": 0, "audience": "user"},
    "starter": {"name": "Starter", "recordings": 100, "seconds": 100 * 120, "rank": 1, "audience": "user"},
    "pro": {"name": "Pro", "recordings": 500, "seconds": 500 * 120, "rank": 2, "audience": "both"},
    "team": {"name": "Team", "recordings": 1000, "seconds": 1000 * 120, "rank": 3, "audience": "organization"},
    "business": {"name": "Business", "recordings": 2500, "seconds": 2500 * 120, "rank": 4, "audience": "organization"},
    "enterprise": {"name": "Enterprise", "recordings": 10000, "seconds": 10000 * 120, "rank": 5, "audience": "both"},
}

ACTIVE_BILLING_STATUSES = {"active", "trialing", "past_due"}


def normalize_plan(value: str | None, *, fallback: str = "free") -> str:
    slug = str(value or "").strip().lower().replace(" ", "_").replace("-", "_")
    if slug.startswith("org:"):
        slug = slug[4:]
    if slug in PLANS:
        return slug
    if slug in {"free_user", "free_org", "default", ""}:
        return "free"
    # A paid slug created in Clerk but not mirrored here should not be
    # treated as free. Pro is the conservative paid tier.
    return "pro" if slug else fallback


def plan_info(plan: str | None) -> dict:
    slug = normalize_plan(plan)
    return {"slug": slug, **PLANS[slug]}


def limits_for(plan: str | None, override: int | None = None) -> tuple[int, int]:
    info = plan_info(plan)
    recordings = int(override) if override else int(info["recordings"])
    seconds = recordings * 120 if override else int(info["seconds"])
    return recordings, seconds


def highest_plan(plans: list[str | None]) -> str:
    best = "free"
    for plan in plans:
        slug = normalize_plan(plan)
        if PLANS[slug]["rank"] > PLANS[best]["rank"]:
            best = slug
    return best


def billing_is_entitled(status: str | None) -> bool:
    return str(status or "active").strip().lower() in ACTIVE_BILLING_STATUSES
