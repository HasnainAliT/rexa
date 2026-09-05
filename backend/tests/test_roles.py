import uuid
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text

from app.main import app
from app.models import AnalysisRun, Question, Submission, User
from app.security import hash_password


def test_role_migration_is_idempotent(tmp_path, monkeypatch):
    db_path = tmp_path / "migrate.db"
    engine = create_engine(f"sqlite:///{db_path}")
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE users (
                    id VARCHAR(36) PRIMARY KEY,
                    email VARCHAR(255),
                    name VARCHAR(255),
                    hashed_password VARCHAR(255),
                    role VARCHAR(20),
                    created_at DATETIME
                )
                """
            )
        )
        conn.execute(
            text(
                "INSERT INTO users (id, email, name, hashed_password, role) "
                "VALUES ('1', 'viewer@example.com', 'Viewer', 'x', 'viewer')"
            )
        )
        conn.execute(
            text(
                "INSERT INTO users (id, email, name, hashed_password, role) "
                "VALUES ('2', 'analyst@example.com', 'Analyst', 'x', 'analyst')"
            )
        )
        conn.execute(
            text(
                "INSERT INTO users (id, email, name, hashed_password, role) "
                "VALUES ('3', 'admin@example.com', 'Admin', 'x', 'admin')"
            )
        )

    import app.database as database

    monkeypatch.setattr(database, "engine", engine)
    database.ensure_schema()

    with engine.connect() as conn:
        roles = dict(conn.execute(text("SELECT email, role FROM users")).fetchall())
    assert roles == {
        "viewer@example.com": "student",
        "analyst@example.com": "teacher",
        "admin@example.com": "admin",
    }
    cols = {column["name"] for column in inspect(engine).get_columns("users")}
    assert "roll_number" in cols

    database.ensure_schema()
    with engine.connect() as conn:
        roles_again = dict(conn.execute(text("SELECT email, role FROM users")).fetchall())
    assert roles_again == roles


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _login(client: TestClient, email: str, password: str, role: str) -> str:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password, "role": role},
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]["token"]


def test_register_rejects_admin_with_400():
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/register",
            json={
                "name": "Nope",
                "email": f"admin-{uuid.uuid4().hex[:8]}@example.com",
                "password": "Admin1234",
                "role": "admin",
            },
        )
    assert response.status_code == 400
    assert "student or teacher" in response.json()["message"].lower()


def test_teacher_signup_requires_matching_code():
    from app.config import settings

    with TestClient(app) as client:
        email = f"teach-{uuid.uuid4().hex[:8]}@example.com"
        denied = client.post(
            "/api/auth/register",
            json={
                "name": "Instructor",
                "email": email,
                "password": "Teacher1234",
                "role": "teacher",
                "institution_code": "WRONG-CODE",
            },
        )
        assert denied.status_code == 403
        assert denied.json()["message"] == "Invalid institution code"

        allowed = client.post(
            "/api/auth/register",
            json={
                "name": "Instructor",
                "email": email,
                "password": "Teacher1234",
                "role": "teacher",
                "institution_code": settings.TEACHER_SIGNUP_CODE,
            },
        )
        assert allowed.status_code == 200, allowed.text
        assert allowed.json()["data"]["user"]["role"] == "teacher"


def test_student_signup_stores_roll_and_strips_answer_key():
    with TestClient(app) as client:
        email = f"stu-{uuid.uuid4().hex[:8]}@example.com"
        created = client.post(
            "/api/auth/register",
            json={
                "name": "Pat Student",
                "email": email,
                "password": "Student1234",
                "role": "student",
                "roll_number": " cs-09 ",
            },
        )
        assert created.status_code == 200, created.text
        user = created.json()["data"]["user"]
        assert user["role"] == "student"
        assert user["rollNumber"] == "CS-09"
        token = created.json()["data"]["token"]

        teacher_token = _login(client, "teacher@earas.edu", "Teacher1234", "teacher")
        prompt = f"Key leak check {uuid.uuid4().hex[:8]}"
        question = client.post(
            "/api/questions",
            headers=_auth(teacher_token),
            json={
                "title": prompt[:120],
                "prompt": prompt,
                "reference_answer": "Axial tilt is the secret key.",
                "concepts": ["axial tilt", "orbit"],
                "difficulty": "medium",
            },
        )
        assert question.status_code == 201, question.text
        question_id = question.json()["data"]["id"]

        listed = client.get("/api/questions", headers=_auth(token))
        assert listed.status_code == 200, listed.text
        listed_body = listed.text
        assert "reference_answer" not in listed_body
        assert "concepts" not in listed_body
        assert "Axial tilt" not in listed_body

        detail = client.get(f"/api/questions/{question_id}", headers=_auth(token))
        assert detail.status_code == 200, detail.text
        assert "reference_answer" not in detail.text
        assert "concepts" not in detail.text
        payload = detail.json()["data"]
        assert payload["id"] == question_id
        assert set(payload.keys()) <= {
            "id",
            "title",
            "prompt",
            "course",
            "difficulty",
            "created_by",
            "created_at",
        }

        dashboard = client.get("/api/analytics/dashboard", headers=_auth(token))
        assert dashboard.status_code == 200, dashboard.text
        stats = dashboard.json()["data"]
        assert "avgStars" not in stats
        assert stats.get("empty") is True


def test_student_cannot_read_another_analysis():
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        owner = User(
            email=f"own-{uuid.uuid4().hex[:8]}@example.com",
            name="Owner",
            hashed_password=hash_password("Student1234"),
            role="student",
            roll_number="OWN-1",
        )
        stranger = User(
            email=f"str-{uuid.uuid4().hex[:8]}@example.com",
            name="Stranger",
            hashed_password=hash_password("Student1234"),
            role="student",
            roll_number="STR-1",
        )
        question = Question(
            title="Owned question",
            prompt="What is gravity?",
            reference_answer="Mass attracts mass.",
            concepts=["gravity"],
            created_by=None,
        )
        db.add_all([owner, stranger, question])
        db.flush()
        submission = Submission(
            question_id=question.id,
            student_name=owner.name,
            student_id=owner.roll_number,
            answer_text="Things fall down.",
            created_by=owner.id,
        )
        db.add(submission)
        db.flush()
        run = AnalysisRun(
            submission_id=submission.id,
            question_id=question.id,
            user_id=owner.id,
            result_json={"stars": 2, "highlights": []},
            stars=2,
            model_version="test",
            created_at=datetime.now(timezone.utc),
        )
        db.add(run)
        db.commit()
        run_id = run.id
        stranger_email = stranger.email
    finally:
        db.close()

    with TestClient(app) as client:
        token = _login(client, stranger_email, "Student1234", "student")
        response = client.get(f"/api/analyses/{run_id}", headers=_auth(token))
    assert response.status_code == 404
    assert response.json()["message"] == "Analysis not found"


def test_admin_user_management_safety_rules():
    with TestClient(app) as client:
        admin_token = _login(client, "admin@earas.edu", "Admin1234", "teacher")
        me = client.get("/api/auth/me", headers=_auth(admin_token))
        assert me.status_code == 200
        admin_id = me.json()["data"]["id"]

        listed = client.get("/api/users", headers=_auth(admin_token))
        assert listed.status_code == 200, listed.text
        rows = listed.json()["data"]["data"]
        for person in rows:
            if person["role"] == "admin" and person["id"] != admin_id:
                demote = client.patch(
                    f"/api/users/{person['id']}/role",
                    headers=_auth(admin_token),
                    json={"role": "teacher"},
                )
                assert demote.status_code == 200, demote.text

        own = client.patch(
            f"/api/users/{admin_id}/role",
            headers=_auth(admin_token),
            json={"role": "teacher"},
        )
        assert own.status_code == 400
        assert "own role" in own.json()["message"].lower()

        from app.deps import require_admin

        fake = User(
            id="fake-other-admin",
            email="fake-admin@example.com",
            name="Fake",
            hashed_password="x",
            role="admin",
        )
        app.dependency_overrides[require_admin] = lambda: fake
        try:
            last = client.patch(
                f"/api/users/{admin_id}/role",
                json={"role": "student"},
            )
            assert last.status_code == 400, last.text
            assert "last remaining admin" in last.json()["message"].lower()
        finally:
            app.dependency_overrides.clear()
