import json
import time
from datetime import datetime

from ncb import TABLE, TENANT, ncb


class DuplicateKeyError(Exception):
    pass


def _key(doc: dict) -> str:
    for field in ("id", "run_id", "identifier", "email", "user_id"):
        if doc.get(field):
            return str(doc[field])
    return "|".join(str(doc.get(field, "")) for field in ("project_id", "session", "type", "step_index"))


def _match(doc: dict, filt: dict) -> bool:
    for key, expected in (filt or {}).items():
        if key == "steps.id":
            if not any(step.get("id") == expected for step in doc.get("steps") or []):
                return False
            continue
        if key == "steps.0":
            exists = bool(doc.get("steps"))
            if isinstance(expected, dict) and bool(expected.get("$exists", True)) != exists:
                return False
            continue
        value = doc.get(key)
        if isinstance(expected, dict):
            if "$in" in expected and value not in expected["$in"]:
                return False
            if "$gte" in expected and (value is None or value < expected["$gte"]):
                return False
            if "$lte" in expected and (value is None or value > expected["$lte"]):
                return False
            if "$lt" in expected and (value is None or value >= expected["$lt"]):
                return False
            if "$gt" in expected and (value is None or value <= expected["$gt"]):
                return False
            if "$ne" in expected and value == expected["$ne"]:
                return False
            if "$exists" in expected and (key in doc and value is not None) != bool(expected["$exists"]):
                return False
            continue
        if value != expected:
            return False
    return True


def _step_matches(step: dict, cond: dict) -> bool:
    for key, expected in cond.items():
        field = key.split(".", 1)[1] if "." in key else key
        if step.get(field) != expected:
            return False
    return True


def _assign(doc: dict, path: str, value, filt: dict, array_filters: list | None):
    if path.startswith("steps.$."):
        field = path.split(".", 2)[2]
        for step in doc.setdefault("steps", []):
            if step.get("id") == filt.get("steps.id"):
                step[field] = value
        return
    if path.startswith("steps.$[]."):
        field = path.split(".", 2)[2]
        for step in doc.get("steps") or []:
            step[field] = value
        return
    if path.startswith("steps.$["):
        field = path.split(".", 2)[2]
        for step in doc.get("steps") or []:
            if any(_step_matches(step, cond) for cond in array_filters or []):
                step[field] = value
        return
    if "." not in path:
        doc[path] = value
        return
    head, tail = path.split(".", 1)
    child = doc.setdefault(head, {})
    if isinstance(child, dict):
        _assign(child, tail, value, filt, array_filters)


def _apply(doc: dict, update: dict, filt: dict, array_filters: list | None, inserting: bool):
    for path, value in (update.get("$set") or {}).items():
        _assign(doc, path, value, filt, array_filters)
    for path, value in (update.get("$inc") or {}).items():
        doc[path] = (doc.get(path) or 0) + value
    for field, value in (update.get("$push") or {}).items():
        doc.setdefault(field, []).append(value)
    if inserting:
        for path, value in (update.get("$setOnInsert") or {}).items():
            doc.setdefault(path, value)


def _project(doc: dict, projection: dict | None) -> dict:
    clean = {k: v for k, v in doc.items() if not str(k).startswith("_")}
    if not projection:
        return clean
    includes = [k for k, v in projection.items() if v == 1 or isinstance(v, dict)]
    if includes:
        out = {}
        for key in includes:
            spec = projection[key]
            if isinstance(spec, dict) and "$size" in spec:
                out[key] = len(clean.get(spec["$size"].lstrip("$")) or [])
            else:
                out[key] = clean.get(key)
        return out
    return {k: v for k, v in clean.items() if projection.get(k) != 0}


def _mysql_time(value) -> str:
    text = str(value or "").replace("T", " ").replace("Z", "")
    text = text.split("+")[0].split(".")[0].strip()
    if len(text) >= 19 and text[4] == "-" and text[10] == " ":
        return text[:19]
    return datetime.utcnow().isoformat(sep=" ", timespec="seconds")


def _row(collection: str, doc: dict) -> dict:
    return {
        "tenant_id": TENANT,
        "owner_user_id": str(doc.get("user_id") or TENANT),
        "owner_name": "appshowcase",
        "user_id": str(doc.get("user_id") or TENANT),
        "title": _key(doc)[:180],
        "status": collection,
        "target_url": str(doc.get("share_id") or doc.get("project_id") or doc.get("email") or "")[:500],
        "brief": json.dumps(doc, default=str),
        "created_at": _mysql_time(doc.get("created_at")),
        "updated_at": _mysql_time(doc.get("updated_at") or doc.get("created_at")),
    }


def _load(row: dict) -> dict:
    doc = json.loads(row.get("brief") or "{}")
    doc["_ncb_id"] = row.get("id")
    return doc


class _Cursor:
    def __init__(self, collection: "Collection", filt: dict, projection: dict | None):
        self.collection = collection
        self.filt = filt
        self.projection = projection
        self.order = None

    def sort(self, key, direction=-1):
        self.order = (key, direction)
        return self

    async def to_list(self, limit: int = 100):
        docs = await self.collection._filtered(self.filt, limit)
        if self.order:
            key, direction = self.order
            docs.sort(key=lambda doc: doc.get(key) or "", reverse=direction < 0)
        return [_project(doc, self.projection) for doc in docs[:limit]]


class _UpdateResult:
    def __init__(self, matched: int, modified: int):
        self.matched_count = matched
        self.modified_count = modified


class Collection:
    def __init__(self, name: str):
        self.name = name

    async def _rows(self, body: dict, limit: int) -> list:
        key = (self.name, json.dumps(body, sort_keys=True, default=str), limit)
        hit = _ROW_CACHE.get(key)
        if hit and time.time() - hit[0] < 8:
            return hit[1]
        found = []
        page = 1
        while len(found) < limit and page < 20:
            result = await ncb(
                "read", TABLE,
                params={"limit": str(min(100, limit)), "page": str(page),
                        "tenant_id": TENANT, "status": self.name,
                        **{key: str(value) for key, value in body.items()}},
            )
            batch = result["data"] if isinstance(result["data"], list) else []
            found.extend(row for row in batch if row.get("tenant_id") == TENANT and row.get("status") == self.name)
            if not batch or not result["has_more"]:
                break
            page += 1
        _ROW_CACHE[key] = (time.time(), found)
        return found

    async def _filtered(self, filt: dict, limit: int) -> list:
        hint = {}
        if filt.get("id"):
            hint["title"] = str(filt["id"])[:180]
        elif filt.get("run_id"):
            hint["title"] = str(filt["run_id"])[:180]
        elif filt.get("user_id") and not isinstance(filt["user_id"], dict):
            hint["user_id"] = str(filt["user_id"])
        elif filt.get("share_id"):
            hint["target_url"] = str(filt["share_id"])[:500]
        elif filt.get("project_id"):
            hint["target_url"] = str(filt["project_id"])[:500]
        rows = await self._rows(hint, max(limit, 200))
        return [_load(row) for row in rows if _match(_load(row), filt)]

    async def find_one(self, filt: dict, projection: dict | None = None, sort=None):
        docs = await self._filtered(filt, 100)
        if sort:
            for key, direction in reversed(sort):
                docs.sort(key=lambda doc, field=key: doc.get(field) or "", reverse=direction < 0)
        return _project(docs[0], projection) if docs else None

    def find(self, filt: dict, projection: dict | None = None):
        return _Cursor(self, filt, projection)

    async def insert_one(self, doc: dict):
        existing = await self.find_one({field: doc[field] for field in ("id", "run_id") if doc.get(field)})
        if existing and (doc.get("id") or doc.get("run_id")):
            raise DuplicateKeyError(_key(doc))
        created = await ncb("create", TABLE, body=_row(self.name, doc))
        _bust()
        record = created["data"] if isinstance(created["data"], dict) else {}
        doc.pop("_id", None)
        return record

    async def _save(self, doc: dict):
        record_id = doc.get("_ncb_id")
        payload = _row(self.name, {k: v for k, v in doc.items() if not str(k).startswith("_")})
        if not record_id:
            found = await self._rows({"title": _key(doc)[:180]}, 5)
            record_id = found[0]["id"] if found else None
        if not record_id:
            await ncb("create", TABLE, body=payload)
            _bust()
            return
        await ncb("update", TABLE, record_id=record_id, body=payload)
        _bust()

    async def update_one(self, filt: dict, update: dict, upsert: bool = False, array_filters=None):
        docs = await self._filtered(filt, 20)
        if not docs:
            if not upsert:
                return _UpdateResult(0, 0)
            doc = {k: v for k, v in filt.items() if not isinstance(v, dict) and "." not in k}
            _apply(doc, update, filt, array_filters, inserting=True)
            await self.insert_one(doc)
            return _UpdateResult(0, 1)
        doc = docs[0]
        _apply(doc, update, filt, array_filters, inserting=False)
        await self._save(doc)
        return _UpdateResult(1, 1)

    async def update_many(self, filt: dict, update: dict):
        for doc in await self._filtered(filt, 500):
            _apply(doc, update, filt, None, inserting=False)
            await self._save(doc)

    async def delete_one(self, filt: dict):
        docs = await self._filtered(filt, 5)
        if docs and docs[0].get("_ncb_id"):
            await ncb("delete", TABLE, record_id=docs[0]["_ncb_id"])
            _bust()

    async def count_documents(self, filt: dict) -> int:
        return len(await self._filtered(filt, 1000))

    def aggregate(self, pipeline: list):
        collection = self

        class _Pipeline:
            async def to_list(self, limit: int = 100):
                docs = await collection._filtered({}, max(limit, 500))
                for stage in pipeline:
                    if "$match" in stage:
                        docs = [doc for doc in docs if _match(doc, stage["$match"])]
                    elif "$sort" in stage:
                        for key, direction in reversed(list(stage["$sort"].items())):
                            docs.sort(key=lambda doc, field=key: doc.get(field) or "", reverse=direction < 0)
                    elif "$limit" in stage:
                        docs = docs[: stage["$limit"]]
                    elif "$project" in stage:
                        docs = [_project(doc, stage["$project"]) for doc in docs]
                return docs[:limit]

        return _Pipeline()


class Database:
    def __init__(self):
        self.users = Collection("profiles")
        self.projects = Collection("projects")
        self.runs = Collection("runs")
        self.history = Collection("history")
        self.cron_runs = Collection("cron_runs")
        self.analytics_events = Collection("events")
        self.login_attempts = Collection("attempts")
        self.user_sessions = Collection("sessions")

    def __getitem__(self, name: str) -> Collection:
        return Collection(name)


_ROW_CACHE: dict = {}


def _bust() -> None:
    _ROW_CACHE.clear()


db = Database()
