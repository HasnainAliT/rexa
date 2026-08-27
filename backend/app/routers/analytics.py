"""Analytics / dashboard routes."""
from collections import Counter
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import AnalysisRun, Question, Submission, User
from app.schemas import (
    ApiResponse,
    CoverageTrendPoint,
    DashboardStats,
    RecentAnalysisItem,
    RoleDistributionItem,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=ApiResponse[DashboardStats])
def dashboard(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
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

    for run in all_runs:
        day_key = run.created_at.strftime("%Y-%m-%d") if isinstance(run.created_at, datetime) else str(run.created_at)
        coverage_pct = ((run.result_json or {}).get("concept_coverage") or {}).get("coverage_pct", 0.0)
        coverage_by_day.setdefault(day_key, []).append(coverage_pct)
        stars_by_day.setdefault(day_key, []).append(run.stars)

        for highlight in (run.result_json or {}).get("highlights") or []:
            role = highlight.get("role")
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
            avg_stars=round(sum(stars_by_day.get(day, [0])) / len(stars_by_day.get(day, [1])), 2),
        )
        for day, values in sorted(coverage_by_day.items())
    ]

    role_distribution = [
        RoleDistributionItem(role=role, count=count)
        for role, count in sorted(role_counter.items(), key=lambda kv: -kv[1])
    ]

    return ApiResponse(
        data=DashboardStats(
            totalAnalyses=total_analyses,
            avgStars=round(float(avg_stars), 2),
            totalQuestions=total_questions,
            totalSubmissions=total_submissions,
            recentAnalyses=recent_analyses,
            coverageTrend=coverage_trend,
            roleDistribution=role_distribution,
        ),
        success=True,
    )
