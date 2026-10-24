# ADAM Analytics - Design Specification

## Overview

The **ADAM Analytics** module is an innovative, AI-powered analytics dashboard that provides **multi-perspective analysis** of the same clinical dataset. It enables different stakeholders (statisticians, clinicians, programmers, etc.) to view data through their unique professional lens.

## Core Innovation

**"Same Data, Different Perspectives"**

A single ADaM dataset can tell different stories depending on who's viewing it:
- A **Statistician** sees treatment effects and p-values
- A **Clinician** sees patient outcomes and safety signals
- A **Data Manager** sees quality issues and missing values
- A **Programmer** sees structure and derivation patterns

## Architecture

### Frontend Components

```
frontend/src/components/
├── AdamAnalyticsTab.tsx    # Main component (750+ lines)
└── AdamAnalyticsTab.css    # Premium styling (650+ lines)
```

## Feature Breakdown

### 1. Role-Based Perspectives

**Six Professional Viewpoints:**

| Role | Focus Areas | Color |
|------|-------------|-------|
| **Developer Statistician** | Endpoints, Treatment Effects, Power | Purple |
| **Clinician** | Patient Safety, Outcomes, AE Rates | Green |
| **Standards Programmer** | CDISC Compliance, CT, IG Alignment | Cyan |
| **Study Programmer** | Key Variables, Merge Keys, TLF Ready | Amber |
| **Clinical Data Manager** | Data Quality, Missing Values, Anomalies | Red |
| **Data Scientist** | Correlations, Patterns, ML Readiness | Pink |

### 2. Dynamic Metrics Cards

Role-specific KPIs that update when perspective changes:

**Developer Statistician:**
- Subjects, Effect Size, Statistical Power, P-value

**Clinician:**
- Patients, Response Rate, AE Rate, Completion

**Clinical Data Manager:**
- Records, Completeness, Missing Critical, Anomalies

### 3. AI-Generated Insights

**Four insight types per role:**

| Type | Icon | Example |
|------|------|---------|
| Critical | ⚠️ | "23 subjects missing TRTSDT" |
| Warning | ⚡ | "High variability in elderly subgroup" |
| Success | ✅ | "Treatment effect detected (p < 0.05)" |
| Insight | 💡 | "3 distinct patient clusters found" |

### 4. Interactive AI Chat

**Features:**
- Role-aware responses
- Quick prompt buttons
- Markdown formatting
- Real-time analysis

**Quick Prompts:**
1. "Give me a summary"
2. "Check data quality"
3. "Find outliers"
4. "Show correlations"

**Sample AI Responses:**
- Data quality tables with percentages
- Outlier detection with variable names
- Correlation matrices with r-values
- Action recommendations

## Design System

### Color Palette (Dark Theme)

| Element | Hex | Usage |
|---------|-----|-------|
| Background | #0f172a | Main container |
| Surface | #1e1b4b | Cards, panels |
| Primary | #8b5cf6 | Accent, buttons |
| Success | #22c55e | Positive metrics |
| Warning | #f59e0b | Concerns |
| Error | #ef4444 | Critical issues |
| Info | #22d3ee | Informational |
| Text Primary | #f8fafc | Headlines |
| Text Secondary | #94a3b8 | Body text |

### Visual Elements

1. **Role Tab Bar** - Horizontal selector with icons
2. **Metric Cards** - 4-column grid with trend indicators
3. **AI Insights Panel** - 2-column grid with type badges
4. **Chat Interface** - Bubbles with user/assistant styling

### Animations

| Animation | Duration | Usage |
|-----------|----------|-------|
| messageEnter | 0.3s | Chat messages |
| spinGradient | 1.5s | Loading spinner |
| hover transform | 0.3s | Card interactions |

## Role-Specific Insights

### Developer Statistician
- Primary endpoint distribution analysis
- Treatment effect significance
- Subgroup variability warnings
- Sample size adequacy

### Clinician
- Safety signal detection
- Clinical response rates
- Treatment discontinuations
- Time to response metrics

### Standards Programmer
- CDISC IG compliance scoring
- Controlled terminology gaps
- BDS structure verification
- Core variable completeness

### Study Programmer
- Key variable coverage
- Derivation logic summary
- Duplicate key detection
- TLF readiness assessment

### Clinical Data Manager
- Critical missing data alerts
- Date inconsistencies
- Overall completeness scoring
- Outlier detection

### Data Scientist
- Correlation strength analysis
- Feature distribution assessment
- Natural cluster detection
- Class imbalance warnings

## User Flow

```
1. Upload Dataset
      ↓
2. Select Role/Perspective
      ↓
3. View Role-Specific Metrics
      ↓
4. Review AI Insights
      ↓
5. Ask Questions via Chat
      ↓
6. Get Actionable Recommendations
```

## AI Chat Capabilities

**Supported Query Types:**

1. **Summary** - Overall dataset overview
2. **Quality** - Completeness and missing value analysis
3. **Outliers** - Statistical anomaly detection
4. **Correlations** - Variable relationship analysis
5. **Role-Specific** - Tailored to selected perspective

**Response Format:**
- Markdown with bold/code formatting
- Tables for structured data
- Action items and recommendations
- Variable tags for quick reference

## Responsive Breakpoints

| Breakpoint | Layout Changes |
|------------|----------------|
| 1400px | Insights grid → 2 columns |
| 1024px | Dashboard → single column |
| 768px | Role tabs → vertical stack |

## Future Enhancements

1. **Export Insights** - PDF/Excel reports by role
2. **Custom Roles** - User-defined perspectives
3. **Trend Comparison** - Multiple dataset analysis
4. **Saved Views** - Bookmark favorite analyses
5. **Team Sharing** - Collaborate on findings
6. **Chart Visualization** - Interactive data plots
7. **Regulatory Templates** - Pre-built analysis sets

## Technical Notes

### State Management
- `activeRole` - Current perspective
- `datasetMeta` - Uploaded file metadata
- `insights` - Generated AI insights
- `chatMessages` - Conversation history

### AI Integration Points
- `generateRoleInsights()` - Role-specific findings
- `generateRoleMetrics()` - KPI calculations
- `sendAIQuery()` - Chat response handler

### Performance Considerations
- Insights are cached per role
- Chat history limited to session
- Lazy loading for large datasets

---

*Module designed for ADAM AI - Clinical Programming Intelligence Platform*
*Unique value proposition: Multi-perspective analysis from a single data source*
