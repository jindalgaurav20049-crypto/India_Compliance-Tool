from hashlib import sha256
from typing import Dict, Iterable


def assert_role(user_roles: Iterable[str], required_role: str) -> None:
    if required_role not in user_roles:
        raise PermissionError(f"Required role missing: {required_role}")


def redact_sensitive(payload: Dict, allowed_fields: Iterable[str]) -> Dict:
    allow = set(allowed_fields)
    return {k: v for k, v in payload.items() if k in allow}


def build_audit_hash(prev_hash: str, actor_id: str, action: str, object_id: str) -> str:
    seed = f"{prev_hash}|{actor_id}|{action}|{object_id}".encode()
    return sha256(seed).hexdigest()
