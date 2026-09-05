"""Analytics / dashboard routes."""
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import ApiHTTPException, get_current_user, is_student, is_teacher
from app.models import AnalysisRun, Question, Submission, User
from app.routers.analysis import _student_runs_query
from app.schemas import (
    ApiResponse,
    CoverageTrendPoint,
    DashboardBand,
    DashboardStats,
    RecentAnalysisItem,
    RoleDistributionItem,
    RoleSentenceItem,
)

MAX_SENTENCES_PER_ROLE = 100

ROLE_ALIASES = {
    "other": "irrelevant",
    "irrelevant": "irrelevant",
    "explanation": "reasoning",
    "reasoning": "reasoning",
    "claim": "claim",
    "evidence": "evidence",
    "elaboration": "elaboration",
    "counterargument": "counterargument",
    "conclusion": "conclusion",
}


def _norm_role(role: object) -> str | None:
    if not role:
        return None
    key = str(role).strip().lower()
    return ROLE_ALIASES.get(key, key)


router = APIRouter(prefix="/analytics", tags=["analytics"])


def _band_list(rows: list[tuple[str, int]], total: int) -> list[DashboardBand]:
    denom = max(total, 1)
    return [
        DashboardBand(label=label, count=count, percent=round(100.0 * count / denom, 1))
        for label, count in rows
    ]


@router.get(
    "/dashboard",
    response_model=ApiResponse[DashboardStats],
    response_model_exclude_none=True,
)
def dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if is_student(current_user):
        return _student_dashboard(db, current_user)
    if not is_teacher(current_user):
        raise ApiHTTPException(status_code=403, detail="You do not have permission to perform this action")
    total_analyses = db.query(func.count(AnalysisRun.id)).scalar() or 0
    total_questions = db.query(func.count(Question.id)).scalar() or 0
    total_submissions = db.query(func.count(Submission.id)).scalar() or 0
    avg_stars = db.query(func.avg(AnalysisRun.stars)).scalar() or 0.0

    recent_runs = (
        db.query(AnalysisRun)
        .order_by(AnalysisRun.created_at.desc())
        .limit(10)
        .all()
    )

    recent_analyses: list[RecentAnalysisItem] = []
    role_counter: Counter[str] = Counter()
    coverage_by_day: dict[str, list[float]] = {}
    stars_by_day: dict[str, list[float]] = {}

    all_runs = db.query(AnalysisRun).order_by(AnalysisRun.created_at.asc()).all()
    question_ids = {run.question_id for run in all_runs if run.question_id}
    submission_ids = {run.submission_id for run in all_runs if run.submission_id}
    question_titles = {
        q.id: q.title
        for q in (
            db.query(Question).filter(Question.id.in_(question_ids)).all()
            if question_ids
            else []
        )
    }
    submission_names = {
        s.id: s.student_name
        for s in (
            db.query(Submission).filter(Submission.id.in_(submission_ids)).all()
            if submission_ids
            else []
        )
    }

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    analyses_this_week = 0
    star_low = star_mid = star_high = 0
    cov_low = cov_mid = cov_high = 0
    coverages: list[float] = []

    for run in all_runs:
        created = run.created_at
        if isinstance(created, datetime):
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if created >= week_ago:
                analyses_this_week += 1
            day_key = created.strftime("%Y-%m-%d")
        else:
            day_key = str(run.created_at)

        coverage_pct = float(
            ((run.result_json or {}).get("concept_coverage") or {}).get("coverage_pct", 0.0)
            or 0.0
        )
        coverages.append(coverage_pct)
        coverage_by_day.setdefault(day_key, []).append(coverage_pct)
        stars_by_day.setdefault(day_key, []).append(run.stars)

        stars = float(run.stars or 0)
        if stars < 2.5:
            star_low += 1
        elif stars < 3.5:
            star_mid += 1
        else:
            star_high += 1

        if coverage_pct < 50:
            cov_low += 1
        elif coverage_pct < 80:
            cov_mid += 1
        else:
            cov_high += 1

        for highlight in (run.result_json or {}).get("highlights") or []:
            role = _norm_role(highlight.get("role"))
            if role:
                role_counter[role] += 1

    for run in recent_runs:
        question = db.query(Question).filter(Question.id == run.question_id).first()
        submission = db.query(Submission).filter(Submission.id == run.submission_id).first()
        recent_analyses.append(
            RecentAnalysisItem(
                id=run.id,
                question_title=question.title if question else "Unknown",
                student_name=getattr(submission, "student_name", None) if submission else None,
                stars=run.stars,
                created_at=run.created_at,
            )
        )

    coverage_trend = [
        CoverageTrendPoint(
            date=day,
            avg_coverage=round(sum(values) / len(values), 2) if values else 0.0,
            avg_stars=round(
                sum(stars_by_day.get(day, [0])) / len(stars_by_day.get(day, [1])),
                2,
            ),
            count=len(values),
        )
        for day, values in sorted(coverage_by_day.items())
    ]

    role_distribution = [
        RoleDistributionItem(role=role, count=count)
        for role, count in sorted(role_counter.items(), key=lambda kv: -kv[1])
    ]

    filled: Counter[str] = Counter()
    role_sentences: list[RoleSentenceItem] = []
    for run in reversed(all_runs):
        if role_counter and all(
            filled[role] >= MAX_SENTENCES_PER_ROLE for role in role_counter
        ):
            break
        question_title = question_titles.get(run.question_id, "Unknown")
        student_name = submission_names.get(run.submission_id)
        for highlight in (run.result_json or {}).get("highlights") or []:
            role = _norm_role(highlight.get("role"))
            text = str(highlight.get("text") or "").strip()
            if not role or not text:
                continue
            if filled[role] >= MAX_SENTENCES_PER_ROLE:
                continue
            filled[role] += 1
            confidence = highlight.get("confidence")
            try:
                confidence_val = float(confidence) if confidence is not None else None
            except (TypeError, ValueError):
                confidence_val = None
            reason = highlight.get("reason")
            role_sentences.append(
                RoleSentenceItem(
                    analysisId=run.id,
                    questionTitle=question_title,
                    studentName=student_name,
                    text=text,
                    role=role,
                    confidence=confidence_val,
                    reason=str(reason).strip() if reason else None,
                )
            )

    n = len(all_runs)
    avg_coverage = round(sum(coverages) / len(coverages), 2) if coverages else 0.0

    return ApiResponse(
        data=DashboardStats(
            totalAnalyses=total_analyses,
            avgStars=round(float(avg_stars), 2),
            avgCoverage=avg_coverage,
            totalQuestions=total_questions,
            totalSubmissions=total_submissions,
            analysesThisWeek=analyses_this_week,
            starBands=_band_list(
                [
                    ("Needs work (below 2.5)", star_low),
                    ("Mixed (2.5–3.4)", star_mid),
                    ("Strong (3.5–5)", star_high),
                ],
                n,
            ),
            coverageBands=_band_list(
                [
                    ("Low (below 50%)", cov_low),
                    ("Partial (50–79%)", cov_mid),
                    ("Strong (80%+)", cov_high),
                ],
                n,
            ),
            recentAnalyses=recent_analyses,
            coverageTrend=coverage_trend,
            roleDistribution=role_distribution,
            roleSentences=role_sentences,
        ),
        success=True,
    )


def _student_dashboard(db: Session, user: User) -> ApiResponse[DashboardStats]:
    runs = (
        _student_runs_query(db, user)
        .order_by(AnalysisRun.created_at.asc())
        .all()
    )
    if not runs:
        return ApiResponse(
            data=DashboardStats(
                totalAnalyses=0,
                avgCoverage=0,
                totalQuestions=0,
                totalSubmissions=0,
                analysesThisWeek=0,
                recentAnalyses=[],
                coverageTrend=[],
                roleDistribution=[],
                empty=True,
            ),
            success=True,
        )

    question_ids = {run.question_id for run in runs if run.question_id}
    question_titles = {
        q.id: q.title
        for q in db.query(Question).filter(Question.id.in_(question_ids)).all()
    } if question_ids else {}

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    analyses_this_week = 0
    coverages: list[float] = []
    depths: list[float] = []
    coverage_by_day: dict[str, list[float]] = {}
    depth_by_day: dict[str, list[float]] = {}
    role_counter: Counter[str] = Counter()
    recent_analyses: list[RecentAnalysisItem] = []

    for run in runs:
        created = run.created_at
        if isinstance(created, datetime):
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if created >= week_ago:
                analyses_this_week += 1
            day_key = created.strftime("%Y-%m-%d")
        else:
            day_key = str(run.created_at)

        result = run.result_json or {}
        coverage_pct = float((result.get("concept_coverage") or {}).get("coverage_pct", 0.0) or 0.0)
        depth = float(result.get("reasoning_depth") or 0.0)
        coverages.append(coverage_pct)
        depths.append(depth)
        coverage_by_day.setdefault(day_key, []).append(coverage_pct)
        depth_by_day.setdefault(day_key, []).append(depth)
        for highlight in result.get("highlights") or []:
            role = _norm_role(highlight.get("role"))
            if role:
                role_counter[role] += 1

    for run in reversed(runs[-10:]):
        result = run.result_json or {}
        recent_analyses.append(
            RecentAnalysisItem(
                id=run.id,
                question_title=question_titles.get(run.question_id, "Unknown"),
                coverage=float((result.get("concept_coverage") or {}).get("coverage_pct", 0.0) or 0.0),
                depth=float(result.get("reasoning_depth") or 0.0),
                created_at=run.created_at,
            )
        )

    coverage_trend = [
        CoverageTrendPoint(
            date=day,
            avg_coverage=round(sum(values) / len(values), 2) if values else 0.0,
            avg_depth=round(
                sum(depth_by_day.get(day, [0])) / len(depth_by_day.get(day, [1])),
                2,
            ),
            count=len(values),
        )
        for day, values in sorted(coverage_by_day.items())
    ]
    role_distribution = [
        RoleDistributionItem(role=role, count=count)
        for role, count in sorted(role_counter.items(), key=lambda kv: -kv[1])
    ]

    filled: Counter[str] = Counter()
    role_sentences: list[RoleSentenceItem] = []
    for run in reversed(runs):
        if role_counter and all(filled[role] >= MAX_SENTENCES_PER_ROLE for role in role_counter):
            break
        question_title = question_titles.get(run.question_id, "Unknown")
        for highlight in (run.result_json or {}).get("highlights") or []:
            role = _norm_role(highlight.get("role"))
            text = str(highlight.get("text") or "").strip()
            if not role or not text or filled[role] >= MAX_SENTENCES_PER_ROLE:
                continue
            filled[role] += 1
            confidence = highlight.get("confidence")
            try:
                confidence_val = float(confidence) if confidence is not None else None
            except (TypeError, ValueError):
                confidence_val = None
            reason = highlight.get("reason")
            role_sentences.append(
                RoleSentenceItem(
                    analysisId=run.id,
                    questionTitle=question_title,
                    text=text,
                    role=role,
                    confidence=confidence_val,
                    reason=str(reason).strip() if reason else None,
                )
            )

    unique_questions = len({run.question_id for run in runs if run.question_id})
    return ApiResponse(
        data=DashboardStats(
            totalAnalyses=len(runs),
            avgCoverage=round(sum(coverages) / len(coverages), 2) if coverages else 0.0,
            avgDepth=round(sum(depths) / len(depths), 2) if depths else 0.0,
            totalQuestions=unique_questions,
            totalSubmissions=len(runs),
            analysesThisWeek=analyses_this_week,
            recentAnalyses=recent_analyses,
            coverageTrend=coverage_trend,
            roleDistribution=role_distribution,
            roleSentences=role_sentences,
            empty=False,
        ),
        success=True,
    )

