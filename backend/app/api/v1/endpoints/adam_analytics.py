"""
ADaM Analytics API Endpoints

Provides role-aware analytics stubs for ADaM datasets.
Currently returns mocked data structures that the frontend can consume while
the full analytics pipeline is being implemented.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Literal, Dict, Any
from uuid import uuid4
from pathlib import Path
import pandas as pd

try:
    import pyreadstat  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    pyreadstat = None

router = APIRouter(prefix="/adam-analytics", tags=["adam-analytics"])


class DatasetSummary(BaseModel):
    name: str
    records: int
    subjects: int
    variables: int
    domain_type: Literal["ADSL", "BDS", "OCCDS", "Other"]
    status: Literal["Analyzed", "Pending"]


class InsightItem(BaseModel):
    title: str
    text: str
    category: Literal[
        "about",
        "variables",
        "insights",
        "trends",
        "outliers",
        "correlations",
        "patterns",
        "anomalies",
        "recommendations",
    ]
    citations: List[str] = Field(default_factory=list)


class RoleInsights(BaseModel):
    role: str
    dataset: str
    items: List[InsightItem]


class AnalyticsOverview(BaseModel):
    study_id: str
    datasets: List[DatasetSummary]


class UploadAnalyticsResponse(BaseModel):
    session_id: str
    datasets: List[DatasetSummary]
    files: List[str]


class TrendPoint(BaseModel):
    x: float | int | str
    y: float


class TrendSeries(BaseModel):
    label: str
    points: List[TrendPoint]


class TrendResponse(BaseModel):
    dataset: str
    series: List[TrendSeries]


class OutlierRecord(BaseModel):
    variable: str
    value: float
    z_score: float
    index: int


class OutlierVariableSummary(BaseModel):
    variable: str
    total_outliers: int
    examples: List[OutlierRecord]


class OutlierResponse(BaseModel):
    dataset: str
    variables: List[OutlierVariableSummary]


class CorrelationPair(BaseModel):
    var_x: str
    var_y: str
    coefficient: float


class CorrelationResponse(BaseModel):
    dataset: str
    pairs: List[CorrelationPair]


BASE_ANALYTICS_DIR = Path("backend") / "temp_executions" / "adam_analytics"
BASE_ANALYTICS_DIR.mkdir(parents=True, exist_ok=True)


def _infer_domain_type(name: str) -> Literal["ADSL", "BDS", "OCCDS", "Other"]:
    upper = name.upper()
    if upper == "ADSL":
        return "ADSL"
    if upper.startswith("AD") and upper not in {"ADSL"}:
        # Very rough heuristic: treat typical ADaM ADxx as BDS/OCCDS
        if upper in {"ADAE", "ADSU", "ADMH"}:
            return "OCCDS"
        return "BDS"
    return "Other"


def _load_dataframe(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix in {".csv"}:
        return pd.read_csv(path)
    if suffix in {".xlsx", ".xls"}:
        return pd.read_excel(path)
    if suffix in {".xpt", ".sas7bdat"}:
        if pyreadstat is None:
            raise HTTPException(
                status_code=500,
                detail="Reading SAS transport/binary files requires pyreadstat to be installed.",
            )
        df, _meta = pyreadstat.read_file(pyreadstat.read_xpt if suffix == ".xpt" else pyreadstat.read_sas7bdat, str(path))
        return df
    # R formats and others are not yet supported
    raise HTTPException(
        status_code=400,
        detail=f"Unsupported file format for analytics: {suffix}. Supported: csv, xlsx, xls, xpt, sas7bdat.",
    )


def _summarize_dataframe(name: str, df: pd.DataFrame) -> DatasetSummary:
    records = int(len(df))
    variables = int(df.shape[1])
    subjects = int(df["USUBJID"].nunique()) if "USUBJID" in df.columns else records
    domain_type = _infer_domain_type(name)
    status: Literal["Analyzed", "Pending"] = "Analyzed"
    return DatasetSummary(
        name=name,
        records=records,
        subjects=subjects,
        variables=variables,
        domain_type=domain_type,
        status=status,
    )


def _get_session_dir(session_id: str) -> Path:
    return BASE_ANALYTICS_DIR / session_id


def _get_dataset_path(session_id: str, dataset_name: str) -> Path:
    # store as dataset_name with original extension preserved; pick first match
    session_dir = _get_session_dir(session_id)
    for p in session_dir.glob(f"{dataset_name}.*"):
        if p.is_file():
            return p
    raise HTTPException(status_code=404, detail="Dataset not found for analytics session")


@router.post("/upload", response_model=UploadAnalyticsResponse)
async def upload_analytics_files(files: List[UploadFile] = File(...)) -> UploadAnalyticsResponse:
    """
    Upload one or more datasets for analytics.

    Files are stored in a session-specific directory and lightly summarized.
    """
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required")

    session_id = str(uuid4())
    session_dir = _get_session_dir(session_id)
    session_dir.mkdir(parents=True, exist_ok=True)

    datasets: List[DatasetSummary] = []
    saved_files: List[str] = []

    for f in files:
        raw_name = f.filename or "dataset"
        path = session_dir / raw_name
        content = await f.read()
        path.write_bytes(content)
        saved_files.append(raw_name)

        try:
            df = _load_dataframe(path)
            dataset_name = path.stem
            summary = _summarize_dataframe(dataset_name, df)
            datasets.append(summary)
        except HTTPException:
            # propagate format errors
            raise
        except Exception as exc:  # pragma: no cover - defensive
            raise HTTPException(status_code=500, detail=f"Failed to analyze file {raw_name}: {exc}") from exc

    return UploadAnalyticsResponse(session_id=session_id, datasets=datasets, files=saved_files)


@router.get("/overview", response_model=AnalyticsOverview)
async def get_overview(session_id: str, study_id: str = "ADAM-AI-STUDY") -> AnalyticsOverview:
    """
    Return an overview of uploaded ADaM datasets for a session.
    """
    session_dir = _get_session_dir(session_id)
    if not session_dir.exists():
        raise HTTPException(status_code=404, detail="Analytics session not found")

    datasets: List[DatasetSummary] = []
    for path in session_dir.iterdir():
        if not path.is_file():
            continue
        try:
            df = _load_dataframe(path)
            datasets.append(_summarize_dataframe(path.stem, df))
        except Exception:
            continue

    return AnalyticsOverview(study_id=study_id, datasets=datasets)


@router.get("/insights/{dataset_name}", response_model=RoleInsights)
async def get_role_insights(
    dataset_name: str,
    role: str,
    session_id: str,
) -> RoleInsights:
    """
    Return mocked, role-specific insights for the requested dataset.

    This endpoint is intentionally lightweight and template-based so that
    it can be replaced later with a real analytics engine that derives
    metrics directly from the uploaded ADaM files.
    """
    allowed_roles = {
        "developerStatistician",
        "clinician",
        "standardsProgrammer",
        "studyProgrammer",
        "clinicalDataManager",
        "dataScientist",
    }

    if role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Unsupported analytics role")

    # For now, we only need the name for citations; in future, metrics will be derived from df
    try:
        _ = _load_dataframe(_get_dataset_path(session_id, dataset_name))
    except HTTPException:
        # surface dataset issues directly
        raise

    base_citation = f"{dataset_name}"

    templates: Dict[str, List[Dict[str, Any]]] = {
        "clinician": [
            {
                "title": "What is the dataset about?",
                "text": "Patient-level longitudinal safety and efficacy data across visits.",
                "category": "about",
            },
            {
                "title": "Key trends",
                "text": "Most patients show early response by Week 12 with stable maintenance thereafter.",
                "category": "trends",
            },
            {
                "title": "Key outliers",
                "text": "A small subset shows rapid deterioration after dose escalation.",
                "category": "outliers",
            },
            {
                "title": "Recommendations",
                "text": "Consider enhanced monitoring for patients with baseline hepatic impairment.",
                "category": "recommendations",
            },
        ],
        "developerStatistician": [
            {
                "title": "Key variables",
                "text": "USUBJID, TRTxxP/TRTxxA, PARAMCD, AVAL, CHG, BASE, AVISITN, ANL01FL.",
                "category": "variables",
            },
            {
                "title": "Key insights",
                "text": "Treatment arm separation becomes evident from Week 8 onwards.",
                "category": "insights",
            },
            {
                "title": "Key correlations",
                "text": "Baseline severity strongly correlates with Week 12 change from baseline.",
                "category": "correlations",
            },
            {
                "title": "Recommendations",
                "text": "Include baseline severity and region as covariates in primary models.",
                "category": "recommendations",
            },
        ],
        "standardsProgrammer": [
            {
                "title": "What is the dataset about?",
                "text": "ADaM BDS structure with subject-level keys and analysis flags.",
                "category": "about",
            },
            {
                "title": "Key patterns",
                "text": "Timing variables and flags mostly align with ADaM IG guidance.",
                "category": "patterns",
            },
            {
                "title": "Key anomalies",
                "text": "Minor VISIT/AVISIT mismatches detected in a small subset of records.",
                "category": "anomalies",
            },
            {
                "title": "Recommendations",
                "text": "Harmonize visit labels and ensure all analysis flags are derived for TLF endpoints.",
                "category": "recommendations",
            },
        ],
        "studyProgrammer": [
            {
                "title": "Key variables for programming",
                "text": "Treatment, visit, endpoints, and key derived flags are present.",
                "category": "variables",
            },
            {
                "title": "Key trends",
                "text": "Endpoint distributions are stable across programming iterations.",
                "category": "trends",
            },
            {
                "title": "Key anomalies",
                "text": "A small number of records lack expected derivation flags.",
                "category": "anomalies",
            },
            {
                "title": "Recommendations",
                "text": "Review derivation programs for endpoints with missing ANLxxFL flags.",
                "category": "recommendations",
            },
        ],
        "clinicalDataManager": [
            {
                "title": "What is the dataset about?",
                "text": "Curated subject data prepared for analysis, derived from SDTM.",
                "category": "about",
            },
            {
                "title": "Key anomalies",
                "text": "Edit check failures cluster in a small number of sites.",
                "category": "anomalies",
            },
            {
                "title": "Key patterns",
                "text": "Missingness peaks at certain visits, likely linked to scheduling.",
                "category": "patterns",
            },
            {
                "title": "Recommendations",
                "text": "Target data cleaning on high‑issue sites and visits before database lock.",
                "category": "recommendations",
            },
        ],
        "dataScientist": [
            {
                "title": "Key correlations",
                "text": "Strong multi‑variable relationship between exposure, baseline severity, and response.",
                "category": "correlations",
            },
            {
                "title": "Key patterns",
                "text": "Three subject segments emerge based on response trajectories.",
                "category": "patterns",
            },
            {
                "title": "Key anomalies",
                "text": "A small cluster exhibits high exposure but limited response.",
                "category": "anomalies",
            },
            {
                "title": "Recommendations",
                "text": "Engineer exposure and baseline features; prototype tree‑based models for prediction.",
                "category": "recommendations",
            },
        ],
    }

    template_items = templates.get(role, [])

    items: List[InsightItem] = [
        InsightItem(
            title=item["title"],
            text=item["text"],
            category=item["category"],
            citations=[base_citation],
        )
        for item in template_items
    ]

    return RoleInsights(role=role, dataset=dataset_name, items=items)


@router.get("/trend-series/{dataset_name}", response_model=TrendResponse)
async def get_trend_series(dataset_name: str, session_id: str) -> TrendResponse:
    """
    Compute a simple time-trend series for visualization.

    Heuristic:
    - Prefer AVISITN as time axis, else ADY, else record index.
    - Use AVAL as the numeric measure when present, else first numeric column.
    """
    path = _get_dataset_path(session_id, dataset_name)
    df = _load_dataframe(path)

    if df.empty:
        return TrendResponse(dataset=dataset_name, series=[])

    time_col = None
    for cand in ["AVISITN", "ADY", "ADTM", "ADT"]:
        if cand in df.columns:
            time_col = cand
            break

    value_col = "AVAL" if "AVAL" in df.columns else None
    if value_col is None:
        numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
        if numeric_cols:
            value_col = numeric_cols[0]

    if time_col is None or value_col is None:
        # Fallback to simple index-based trend
        df = df.reset_index().rename(columns={"index": "ROW"})
        time_col = "ROW"
        numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
        value_col = numeric_cols[0]

    # Aggregate
    grouped = df.groupby(time_col)[value_col].mean().reset_index()

    points: List[TrendPoint] = []
    for _, row in grouped.iterrows():
        x_val = row[time_col]
        if isinstance(x_val, (pd.Timestamp,)):
            x = x_val.isoformat()
        else:
            x = x_val
        points.append(TrendPoint(x=x, y=float(row[value_col])))

    series = TrendSeries(label=f"{dataset_name} {value_col} mean", points=points)
    return TrendResponse(dataset=dataset_name, series=[series])


@router.get("/outliers/{dataset_name}", response_model=OutlierResponse)
async def get_outliers(
    dataset_name: str,
    session_id: str,
    max_variables: int = 5,
    max_examples: int = 5,
) -> OutlierResponse:
    """
    Detect simple univariate outliers based on z-scores > 3.

    Returns the variables with the largest number of outliers and a few example records.
    """
    path = _get_dataset_path(session_id, dataset_name)
    df = _load_dataframe(path)

    numeric_df = df.select_dtypes(include=["number"]).copy()
    if numeric_df.empty:
        return OutlierResponse(dataset=dataset_name, variables=[])

    summaries: List[OutlierVariableSummary] = []

    for col in numeric_df.columns:
        series = numeric_df[col].dropna()
        if series.empty:
            continue
        mean = series.mean()
        std = series.std()
        if std == 0 or pd.isna(std):
            continue
        z_scores = (series - mean) / std
        mask = z_scores.abs() > 3.0
        if not mask.any():
            continue
        outlier_idx = series.index[mask]
        total_outliers = int(mask.sum())

        # Take top examples by absolute z-score
        top_idx = (
            z_scores.loc[outlier_idx]
            .abs()
            .sort_values(ascending=False)
            .head(max_examples)
            .index
        )

        examples: List[OutlierRecord] = []
        for idx in top_idx:
            examples.append(
                OutlierRecord(
                    variable=col,
                    value=float(series.loc[idx]),
                    z_score=float(z_scores.loc[idx]),
                    index=int(idx),
                )
            )

        summaries.append(
            OutlierVariableSummary(
                variable=col,
                total_outliers=total_outliers,
                examples=examples,
            )
        )

    # Sort by total outliers and limit number of variables
    summaries.sort(key=lambda s: s.total_outliers, reverse=True)
    return OutlierResponse(dataset=dataset_name, variables=summaries[:max_variables])


@router.get("/correlations/{dataset_name}", response_model=CorrelationResponse)
async def get_correlations(
    dataset_name: str,
    session_id: str,
    top_n: int = 10,
) -> CorrelationResponse:
    """
    Compute pairwise Pearson correlations between numeric variables.

    Returns the strongest pairs by absolute correlation (excluding self-correlations).
    """
    path = _get_dataset_path(session_id, dataset_name)
    df = _load_dataframe(path)

    numeric_df = df.select_dtypes(include=["number"]).copy()
    if numeric_df.shape[1] < 2:
        return CorrelationResponse(dataset=dataset_name, pairs=[])

    corr = numeric_df.corr()

    pairs: List[CorrelationPair] = []

    cols = corr.columns.tolist()
    for i, col_i in enumerate(cols):
        for j in range(i + 1, len(cols)):
            col_j = cols[j]
            coef = corr.at[col_i, col_j]
            if pd.isna(coef):
                continue
            pairs.append(
                CorrelationPair(
                    var_x=col_i,
                    var_y=col_j,
                    coefficient=float(coef),
                )
            )

    pairs.sort(key=lambda p: abs(p.coefficient), reverse=True)
    return CorrelationResponse(dataset=dataset_name, pairs=pairs[:top_n])
