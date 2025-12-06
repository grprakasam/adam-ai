/**
 * Spec Gap Detector (Missing Spec Detector) Component
 * 
 * An innovative, SaaS-quality validation tool that compares datasets
 * against specifications to identify discrepancies, missing values,
 * and specification violations.
 * 
 * Key Features:
 * - Visual health score with animated ring
 * - Categorized issue panels (Critical, Warning, Info)
 * - AI-powered insights and recommendations
 * - Detailed variable-level analysis
 * - Export capabilities
 * 
 * Design Philosophy:
 * - Dark, premium SaaS aesthetic
 * - Intuitive visual hierarchy
 * - Actionable insights focus
 * - Progressive disclosure
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    Upload,
    Button,
    message,
    Tabs,
    Table,
    Tag,
    Tooltip,
    Spin,
    Empty,
    Dropdown,
    MenuProps,
} from 'antd';
import {
    FileSearchOutlined,
    DatabaseOutlined,
    FileExcelOutlined,
    DeleteOutlined,
    CheckCircleOutlined,
    WarningOutlined,
    CloseCircleOutlined,
    RobotOutlined,
    SendOutlined,
    DownloadOutlined,
    BulbOutlined,
    ThunderboltOutlined,
    SyncOutlined,
    InfoCircleOutlined,
    SafetyOutlined,
    LinkOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { PageHeader } from './PageHeader';
import './MissingSpecDetectorTab.css';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface DatasetMetadata {
    filename: string;
    observations: number;
    variables: number;
    domain: string;
    creationDate?: string;
}

interface SpecMetadata {
    filename: string;
    sheets: string[];
    selectedSheet: string;
    variablesCount: number;
}

interface GapIssue {
    id: string;
    variable: string;
    severity: 'critical' | 'warning' | 'info';
    category: string;
    issue: string;
    description: string;
    affectedRecords: number;
    affectedSubjects?: string[];
    specRequirement?: string;
    actualValue?: string;
    recommendation?: string;
}

interface ValidationResult {
    healthScore: number;
    healthStatus: 'excellent' | 'good' | 'warning' | 'critical';
    totalVariablesChecked: number;
    matchingVariables: number;
    datasetVariables: number;
    specVariables: number;
    issues: GapIssue[];
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    analysisTimestamp: string;
    recommendations: string[];
}

interface ChatMessage {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

// ============================================================================
// MOCK DATA GENERATOR
// ============================================================================

const generateMockValidation = (
    datasetMeta: DatasetMetadata,
    specMeta: SpecMetadata
): ValidationResult => {
    const issues: GapIssue[] = [
        // Critical Issues
        {
            id: 'crit-1',
            variable: 'SAFFL',
            severity: 'critical',
            category: 'Missing Variable',
            issue: 'Required variable not found in dataset',
            description: 'The Safety Population Flag (SAFFL) is defined in specification but missing from the dataset.',
            affectedRecords: datasetMeta.observations,
            specRequirement: 'Required (Core)',
            recommendation: 'Add SAFFL variable with proper derivation: Y if subject received any study treatment.',
        },
        {
            id: 'crit-2',
            variable: 'TRTSDT',
            severity: 'critical',
            category: 'Missing Values',
            issue: '23 missing values in required field',
            description: 'Treatment Start Date has missing values which is not allowed per specification.',
            affectedRecords: 23,
            affectedSubjects: ['SUBJ-001', 'SUBJ-045', 'SUBJ-078', 'SUBJ-102', 'SUBJ-156'],
            specRequirement: 'Required - No missing values allowed',
            actualValue: '23 of 450 records have missing values',
            recommendation: 'Review source data (EX domain) for these subjects or update specification to allow missing with justification.',
        },
        {
            id: 'crit-3',
            variable: 'AGE',
            severity: 'critical',
            category: 'Value Out of Range',
            issue: '5 values exceed specification limits',
            description: 'Age values found outside the specified range of 18-85.',
            affectedRecords: 5,
            affectedSubjects: ['SUBJ-234', 'SUBJ-456'],
            specRequirement: 'Range: 18-85 years',
            actualValue: 'Min: 16, Max: 92 found',
            recommendation: 'Verify age calculations and update derivation or specification acceptance criteria.',
        },
        // Warnings
        {
            id: 'warn-1',
            variable: 'AGEGR1',
            severity: 'warning',
            category: 'Codelist Mismatch',
            issue: 'Value not in controlled terminology',
            description: 'AGEGR1 contains value "18-64" but specification defines "18-65".',
            affectedRecords: 187,
            specRequirement: 'Codelist: <18, 18-65, >65',
            actualValue: 'Found: <18, 18-64, 65+',
            recommendation: 'Update derivation to match specification categories or request specification amendment.',
        },
        {
            id: 'warn-2',
            variable: 'RACE',
            severity: 'warning',
            category: 'Format Mismatch',
            issue: 'Variable length exceeds specification',
            description: 'RACE has length 40 but specification defines length 32.',
            affectedRecords: 12,
            specRequirement: 'Length: 32',
            actualValue: 'Actual Length: 40',
            recommendation: 'Truncate values or request specification update for longer length.',
        },
        {
            id: 'warn-3',
            variable: 'SITEID',
            severity: 'warning',
            category: 'Missing Values',
            issue: '8 records with missing Site ID',
            description: 'Site ID has missing values which may affect analysis grouping.',
            affectedRecords: 8,
            specRequirement: 'Expected - Minimal missing allowed',
            recommendation: 'Document justification for missing SITEID values.',
        },
        // Info
        {
            id: 'info-1',
            variable: 'RFSTDTC',
            severity: 'info',
            category: 'Extra Variable',
            issue: 'Variable in dataset but not in specification',
            description: 'RFSTDTC exists in dataset but is not defined in the current specification.',
            affectedRecords: 0,
            recommendation: 'Consider adding to specification or remove if not needed.',
        },
        {
            id: 'info-2',
            variable: 'STUDYID',
            severity: 'info',
            category: 'Label Mismatch',
            issue: 'Variable label differs from specification',
            description: 'Dataset label: "Study ID", Spec label: "Study Identifier".',
            affectedRecords: 0,
            specRequirement: 'Label: Study Identifier',
            actualValue: 'Label: Study ID',
            recommendation: 'Minor issue - update label for consistency.',
        },
        {
            id: 'info-3',
            variable: 'USUBJID',
            severity: 'info',
            category: 'Format Note',
            issue: 'Consider standardizing format',
            description: 'USUBJID format varies: some use dashes, some use underscores.',
            affectedRecords: 45,
            recommendation: 'Standardize USUBJID format for consistency across datasets.',
        },
    ];

    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    // Calculate health score
    let healthScore = 100;
    healthScore -= criticalCount * 15;
    healthScore -= warningCount * 5;
    healthScore -= infoCount * 1;
    healthScore = Math.max(0, Math.min(100, healthScore));

    let healthStatus: 'excellent' | 'good' | 'warning' | 'critical';
    if (healthScore >= 90) healthStatus = 'excellent';
    else if (healthScore >= 70) healthStatus = 'good';
    else if (healthScore >= 50) healthStatus = 'warning';
    else healthStatus = 'critical';

    return {
        healthScore,
        healthStatus,
        totalVariablesChecked: Math.max(datasetMeta.variables, specMeta.variablesCount),
        matchingVariables: Math.min(datasetMeta.variables, specMeta.variablesCount) - 3,
        datasetVariables: datasetMeta.variables,
        specVariables: specMeta.variablesCount,
        issues,
        criticalCount,
        warningCount,
        infoCount,
        analysisTimestamp: new Date().toISOString(),
        recommendations: [
            'Address critical SAFFL missing variable before submission',
            'Review and fix TRTSDT missing values - affects 5% of subjects',
            'Standardize AGEGR1 categories to match specification',
        ],
    };
};

// ============================================================================
// AI ASSISTANT
// ============================================================================

const sendAIQuery = async (
    message: string,
    validationContext: ValidationResult | null
): Promise<string> => {
    const messageLower = message.toLowerCase();

    // Simulate AI responses
    await new Promise(resolve => setTimeout(resolve, 800));

    if (messageLower.includes('saffl') || messageLower.includes('safety')) {
        return `**SAFFL (Safety Population Flag) Issue Analysis:**

The SAFFL variable is **critically missing** from your dataset but required by the specification.

**Why this matters:**
- SAFFL is used to identify the Safety Analysis Population
- Required for all safety summary tables
- Missing this flag blocks submission-ready status

**Recommended Derivation:**
\`\`\`sas
/* SAFFL - Safety Population Flag */
if TRTSDT ne . then SAFFL = 'Y';
else SAFFL = '';
\`\`\`

**Action Items:**
1. Add SAFFL to your ADAM derivation program
2. Verify all subjects with treatment start date are flagged
3. Document any exclusions in the ADRG

Would you like me to generate the complete derivation code?`;
    }

    if (messageLower.includes('trtsdt') || messageLower.includes('missing')) {
        return `**TRTSDT Missing Values Analysis:**

Found **23 records (5.1%)** with missing Treatment Start Date.

**Affected Subjects:**
- SUBJ-001, SUBJ-045, SUBJ-078, SUBJ-102, SUBJ-156 (and 18 more)

**Root Cause Investigation:**
1. Check EX domain - subjects may not have started treatment
2. Review screen failures vs. treated subjects
3. Verify join conditions in ADSL derivation

**Resolution Options:**
1. **If valid missing:** Update spec to allow missing with condition
2. **If data error:** Correct source data and re-derive
3. **If screen failures:** Exclude from analysis population

**Impact Assessment:**
- Safety analyses may be incomplete
- Population counts will be affected
- Review SAP for handling missing dates`;
    }

    if (messageLower.includes('fix') || messageLower.includes('resolve') || messageLower.includes('how')) {
        return `**Resolution Strategy for All Issues:**

**Priority 1: Critical Issues (Fix Immediately)**
1. ⛔ Create SAFFL derivation
2. ⛔ Address TRTSDT missing values
3. ⛔ Correct AGE out-of-range values

**Priority 2: Warnings (Fix Before Submission)**
4. ⚠️ Align AGEGR1 categories with spec
5. ⚠️ Adjust RACE variable length
6. ⚠️ Document SITEID missing justification

**Priority 3: Info Items (Nice to Have)**
7. ℹ️ Add RFSTDTC to spec or remove from dataset
8. ℹ️ Standardize variable labels
9. ℹ️ Normalize USUBJID format

**Estimated Effort:**
- Critical fixes: 2-3 hours
- Warnings: 1-2 hours
- Info items: 30 minutes

Shall I provide detailed code for any specific fix?`;
    }

    if (messageLower.includes('submission') || messageLower.includes('ready')) {
        return `**Submission Readiness Assessment:**

Based on current validation:

🔴 **NOT Ready for Submission**

**Blocking Issues:**
- 3 Critical issues must be resolved
- SAFFL missing - blocks population analysis
- TRTSDT missing affects 5% of subjects

**Required Actions Before Submission:**
1. Complete all critical issue fixes
2. Re-run validation to verify fixes
3. Document any specification waivers
4. Generate updated Define-XML
5. Create ADRG section for data issues

**Estimated Timeline:**
- Fix critical issues: 1 day
- Fix warnings: 0.5 days  
- Documentation: 0.5 days
- **Total: 2 working days**

Would you like me to create a detailed remediation plan?`;
    }

    // Default response
    return `Based on the validation analysis, here's what I found:

**Summary:**
- Health Score: ${validationContext?.healthScore || 64}%
- Critical Issues: ${validationContext?.criticalCount || 3}
- Warnings: ${validationContext?.warningCount || 3}
- Info Items: ${validationContext?.infoCount || 3}

**Top Priority Actions:**
1. Address missing SAFFL variable (Critical)
2. Fix TRTSDT missing values (Critical)
3. Correct AGE out-of-range values (Critical)

**I can help with:**
- Detailed analysis of any specific variable
- Code snippets for fixes
- Submission readiness assessment
- Priority ranking of issues

What would you like to explore?`;
};

// ============================================================================
// COMPONENT
// ============================================================================

const MissingSpecDetectorTab: React.FC = () => {
    // File State
    const [datasetFile, setDatasetFile] = useState<UploadFile | null>(null);
    const [specFile, setSpecFile] = useState<UploadFile | null>(null);
    const [datasetMeta, setDatasetMeta] = useState<DatasetMetadata | null>(null);
    const [specMeta, setSpecMeta] = useState<SpecMetadata | null>(null);

    // Analysis State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const [severityFilter, setSeverityFilter] = useState<string | null>(null);

    // AI Chat State
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isAILoading, setIsAILoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // Handle dataset upload
    const handleDatasetUpload = useCallback((file: UploadFile) => {
        setDatasetFile(file);
        setDatasetMeta({
            filename: file.name,
            observations: Math.floor(Math.random() * 300) + 200,
            variables: Math.floor(Math.random() * 30) + 40,
            domain: 'ADSL',
            creationDate: new Date().toISOString(),
        });
        setValidationResult(null);
        setChatMessages([]);
        message.success(`Dataset loaded: ${file.name}`);
        return false;
    }, []);

    // Handle spec upload
    const handleSpecUpload = useCallback((file: UploadFile) => {
        setSpecFile(file);
        setSpecMeta({
            filename: file.name,
            sheets: ['Variables', 'ValueLevel', 'Analysis'],
            selectedSheet: 'Variables',
            variablesCount: Math.floor(Math.random() * 20) + 45,
        });
        setValidationResult(null);
        setChatMessages([]);
        message.success(`Specification loaded: ${file.name}`);
        return false;
    }, []);

    // Remove files
    const handleRemoveDataset = useCallback(() => {
        setDatasetFile(null);
        setDatasetMeta(null);
        setValidationResult(null);
        setChatMessages([]);
    }, []);

    const handleRemoveSpec = useCallback(() => {
        setSpecFile(null);
        setSpecMeta(null);
        setValidationResult(null);
        setChatMessages([]);
    }, []);

    // Run analysis
    const handleAnalyze = useCallback(async () => {
        if (!datasetMeta || !specMeta) {
            message.warning('Please upload both dataset and specification files');
            return;
        }

        setIsAnalyzing(true);

        try {
            // Simulate analysis time
            await new Promise(resolve => setTimeout(resolve, 2500));

            const result = generateMockValidation(datasetMeta, specMeta);
            setValidationResult(result);
            setActiveTab('overview');

            // Add welcome message
            setChatMessages([
                {
                    id: 'welcome',
                    type: 'assistant',
                    content: `Analysis complete! Found **${result.criticalCount} critical issues**, **${result.warningCount} warnings**, and **${result.infoCount} informational items**. Your dataset health score is **${result.healthScore}%**. Ask me about any specific issues or how to fix them!`,
                    timestamp: new Date().toISOString(),
                },
            ]);

            message.success('Analysis completed!');
        } catch (error: any) {
            message.error(error.message || 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    }, [datasetMeta, specMeta]);

    // AI Chat
    const handleSendMessage = useCallback(async () => {
        if (!chatInput.trim()) return;

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            type: 'user',
            content: chatInput,
            timestamp: new Date().toISOString(),
        };

        setChatMessages(prev => [...prev, userMessage]);
        setChatInput('');
        setIsAILoading(true);

        try {
            const response = await sendAIQuery(chatInput, validationResult);
            setChatMessages(prev => [
                ...prev,
                {
                    id: `assistant-${Date.now()}`,
                    type: 'assistant',
                    content: response,
                    timestamp: new Date().toISOString(),
                },
            ]);
        } catch (error) {
            message.error('Failed to get AI response');
        } finally {
            setIsAILoading(false);
        }
    }, [chatInput, validationResult]);

    // Quick prompts
    const quickPrompts = [
        'Explain SAFFL issue',
        'How to fix missing values?',
        'Is this submission ready?',
        'Show resolution plan',
    ];

    // Filter issues
    const filteredIssues = validationResult?.issues.filter(issue => {
        if (severityFilter && issue.severity !== severityFilter) return false;
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            return (
                issue.variable.toLowerCase().includes(search) ||
                issue.issue.toLowerCase().includes(search) ||
                issue.description.toLowerCase().includes(search)
            );
        }
        return true;
    }) || [];

    // Export menu
    const exportMenu: MenuProps = {
        items: [
            { key: 'pdf', label: 'Export PDF Report', icon: <DownloadOutlined /> },
            { key: 'excel', label: 'Export to Excel', icon: <FileExcelOutlined /> },
            { key: 'csv', label: 'Export Issues CSV', icon: <DownloadOutlined /> },
        ],
        onClick: ({ key }) => message.info(`${key.toUpperCase()} export coming soon`),
    };

    // Render health ring
    const renderHealthRing = () => {
        if (!validationResult) return null;

        const radius = 70;
        const circumference = 2 * Math.PI * radius;
        const progress = (validationResult.healthScore / 100) * circumference;
        const offset = circumference - progress;

        return (
            <div className="spec-gap-health-score">
                <svg className="spec-gap-health-ring" viewBox="0 0 180 180">
                    <defs>
                        <linearGradient id="excellentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#22c55e" />
                            <stop offset="100%" stopColor="#16a34a" />
                        </linearGradient>
                        <linearGradient id="goodGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#38bdf8" />
                            <stop offset="100%" stopColor="#0ea5e9" />
                        </linearGradient>
                        <linearGradient id="warningGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#d97706" />
                        </linearGradient>
                        <linearGradient id="criticalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="100%" stopColor="#dc2626" />
                        </linearGradient>
                    </defs>
                    <circle
                        className="spec-gap-health-ring-bg"
                        cx="90"
                        cy="90"
                        r={radius}
                    />
                    <circle
                        className={`spec-gap-health-ring-progress ${validationResult.healthStatus}`}
                        cx="90"
                        cy="90"
                        r={radius}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                    />
                </svg>
                <div className="spec-gap-health-score-text">
                    <div className="spec-gap-health-score-value">{validationResult.healthScore}</div>
                    <div className="spec-gap-health-score-label">Score</div>
                </div>
            </div>
        );
    };

    // Render upload card
    const renderUploadCard = (
        type: 'dataset' | 'specification',
        file: UploadFile | null,
        meta: DatasetMetadata | SpecMetadata | null,
        onUpload: (file: UploadFile) => boolean,
        onRemove: () => void
    ) => (
        <div className={`spec-gap-upload-card ${type} ${file ? 'has-file' : ''}`}>
            <div className="spec-gap-upload-header">
                <span className={`spec-gap-upload-badge ${type}`}>
                    {type === 'dataset' ? <DatabaseOutlined /> : <FileExcelOutlined />}
                    {type === 'dataset' ? 'Dataset' : 'Specification'}
                </span>
                {file && (
                    <Tooltip title="Remove file">
                        <DeleteOutlined className="spec-gap-upload-remove" onClick={onRemove} />
                    </Tooltip>
                )}
            </div>

            {!file ? (
                <Upload
                    beforeUpload={onUpload}
                    accept={type === 'dataset' ? '.sas7bdat,.xpt,.csv,.rds' : '.xlsx,.xls'}
                    showUploadList={false}
                    maxCount={1}
                >
                    <div className="spec-gap-upload-zone">
                        {type === 'dataset' ? (
                            <DatabaseOutlined className="spec-gap-upload-icon" />
                        ) : (
                            <FileExcelOutlined className="spec-gap-upload-icon" />
                        )}
                        <div className="spec-gap-upload-text">
                            {type === 'dataset' ? 'Upload ADAM Dataset' : 'Upload Specification'}
                        </div>
                        <div className="spec-gap-upload-subtext">
                            {type === 'dataset'
                                ? 'SAS7BDAT, XPT, CSV, or RDS'
                                : 'Excel format (.xlsx, .xls)'}
                        </div>
                        <div className="spec-gap-upload-formats">
                            {type === 'dataset' ? (
                                <>
                                    <span className="spec-gap-format-tag">.sas7bdat</span>
                                    <span className="spec-gap-format-tag">.xpt</span>
                                    <span className="spec-gap-format-tag">.csv</span>
                                </>
                            ) : (
                                <>
                                    <span className="spec-gap-format-tag">.xlsx</span>
                                    <span className="spec-gap-format-tag">.xls</span>
                                </>
                            )}
                        </div>
                    </div>
                </Upload>
            ) : (
                <div className="spec-gap-file-preview">
                    <div className="spec-gap-file-info">
                        <CheckCircleOutlined className="spec-gap-file-icon" />
                        <div className="spec-gap-file-details">
                            <div className="spec-gap-file-name">{meta && 'filename' in meta ? meta.filename : ''}</div>
                            <div className="spec-gap-file-meta">
                                <span>Ready for analysis</span>
                            </div>
                        </div>
                    </div>
                    <div className="spec-gap-file-stats">
                        {type === 'dataset' && datasetMeta && (
                            <>
                                <div className="spec-gap-file-stat">
                                    <div className="spec-gap-file-stat-value">{datasetMeta.observations}</div>
                                    <div className="spec-gap-file-stat-label">Records</div>
                                </div>
                                <div className="spec-gap-file-stat">
                                    <div className="spec-gap-file-stat-value">{datasetMeta.variables}</div>
                                    <div className="spec-gap-file-stat-label">Variables</div>
                                </div>
                            </>
                        )}
                        {type === 'specification' && specMeta && (
                            <>
                                <div className="spec-gap-file-stat">
                                    <div className="spec-gap-file-stat-value">{specMeta.variablesCount}</div>
                                    <div className="spec-gap-file-stat-label">Variables</div>
                                </div>
                                <div className="spec-gap-file-stat">
                                    <div className="spec-gap-file-stat-value">{specMeta.sheets.length}</div>
                                    <div className="spec-gap-file-stat-label">Sheets</div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    // Render issues panel
    const renderIssuesPanel = (
        title: string,
        severity: 'critical' | 'warning' | 'info',
        issues: GapIssue[]
    ) => {
        const severityIssues = issues.filter(i => i.severity === severity);
        const icon =
            severity === 'critical' ? (
                <CloseCircleOutlined />
            ) : severity === 'warning' ? (
                <WarningOutlined />
            ) : (
                <InfoCircleOutlined />
            );

        return (
            <div className="spec-gap-issue-category">
                <div className={`spec-gap-issue-header ${severity}`}>
                    <span className="spec-gap-issue-title">
                        <span className={`spec-gap-issue-title-icon ${severity}`}>{icon}</span>
                        {title}
                    </span>
                    <span className={`spec-gap-issue-count ${severity}`}>{severityIssues.length}</span>
                </div>
                <div className="spec-gap-issue-body">
                    {severityIssues.length === 0 ? (
                        <Empty
                            description={`No ${severity} issues`}
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            style={{ padding: '20px 0' }}
                        />
                    ) : (
                        severityIssues.map(issue => (
                            <div key={issue.id} className={`spec-gap-issue-item ${severity}`}>
                                <div className="spec-gap-issue-var">{issue.variable}</div>
                                <div className="spec-gap-issue-desc">{issue.issue}</div>
                                {issue.affectedRecords > 0 && (
                                    <div className="spec-gap-issue-affected">
                                        Affects {issue.affectedRecords} records
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    // Render AI panel
    const renderAIPanel = () => (
        <div className="spec-gap-ai-panel">
            <div className="spec-gap-ai-header">
                <div className="spec-gap-ai-icon">
                    <RobotOutlined />
                </div>
                <div className="spec-gap-ai-title-group">
                    <div className="spec-gap-ai-title">AI Resolution Assistant</div>
                    <div className="spec-gap-ai-subtitle">
                        Ask questions about issues and get fix recommendations
                    </div>
                </div>
            </div>
            <div className="spec-gap-ai-body">
                {/* Quick actions */}
                <div className="spec-gap-quick-actions">
                    {quickPrompts.map((prompt, idx) => (
                        <button
                            key={idx}
                            className="spec-gap-quick-btn"
                            onClick={() => {
                                setChatInput(prompt);
                                setTimeout(() => {
                                    const input = prompt;
                                    setChatInput('');
                                    const userMsg: ChatMessage = {
                                        id: `user-${Date.now()}`,
                                        type: 'user',
                                        content: input,
                                        timestamp: new Date().toISOString(),
                                    };
                                    setChatMessages(prev => [...prev, userMsg]);
                                    setIsAILoading(true);
                                    sendAIQuery(input, validationResult)
                                        .then(response => {
                                            setChatMessages(prev => [
                                                ...prev,
                                                {
                                                    id: `assistant-${Date.now()}`,
                                                    type: 'assistant',
                                                    content: response,
                                                    timestamp: new Date().toISOString(),
                                                },
                                            ]);
                                        })
                                        .finally(() => setIsAILoading(false));
                                }, 100);
                            }}
                            disabled={!validationResult || isAILoading}
                        >
                            {prompt}
                        </button>
                    ))}
                </div>

                {/* Chat messages */}
                <div className="spec-gap-ai-chat">
                    {chatMessages.length === 0 ? (
                        <div className="spec-gap-empty" style={{ padding: '40px 20px' }}>
                            <BulbOutlined className="spec-gap-empty-icon" style={{ fontSize: 48 }} />
                            <div className="spec-gap-empty-title">AI Assistant Ready</div>
                            <div className="spec-gap-empty-text">
                                Run the analysis first, then ask about specific issues or fixes
                            </div>
                        </div>
                    ) : (
                        chatMessages.map(msg => (
                            <div key={msg.id} className={`spec-gap-ai-message ${msg.type}`}>
                                <div className="spec-gap-ai-message-header">
                                    {msg.type === 'user' ? '👤 You' : '🤖 AI Assistant'}
                                </div>
                                <div
                                    className="spec-gap-ai-message-content"
                                    dangerouslySetInnerHTML={{
                                        __html: msg.content
                                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                            .replace(/`([^`]+)`/g, '<code>$1</code>')
                                            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
                                            .replace(/\n/g, '<br />'),
                                    }}
                                />
                            </div>
                        ))
                    )}
                    {isAILoading && (
                        <div className="spec-gap-ai-message assistant">
                            <div className="spec-gap-ai-message-header">🤖 AI Assistant</div>
                            <div className="spec-gap-ai-message-content">
                                <Spin size="small" /> Analyzing...
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="spec-gap-ai-input-area">
                    <input
                        type="text"
                        className="spec-gap-ai-input"
                        placeholder="Ask about issues, fixes, or submission readiness..."
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                        disabled={!validationResult || isAILoading}
                    />
                    <button
                        className="spec-gap-ai-send-btn"
                        onClick={handleSendMessage}
                        disabled={!validationResult || isAILoading || !chatInput.trim()}
                    >
                        <SendOutlined />
                        Send
                    </button>
                </div>
            </div>
        </div>
    );

    // Render detailed table
    const renderDetailedTable = () => {
        const columns = [
            {
                title: 'Variable',
                dataIndex: 'variable',
                key: 'variable',
                render: (text: string) => <code style={{ color: '#38bdf8' }}>{text}</code>,
                sorter: (a: GapIssue, b: GapIssue) => a.variable.localeCompare(b.variable),
            },
            {
                title: 'Severity',
                dataIndex: 'severity',
                key: 'severity',
                render: (severity: string) => (
                    <Tag
                        color={
                            severity === 'critical' ? 'error' : severity === 'warning' ? 'warning' : 'processing'
                        }
                    >
                        {severity.toUpperCase()}
                    </Tag>
                ),
                filters: [
                    { text: 'Critical', value: 'critical' },
                    { text: 'Warning', value: 'warning' },
                    { text: 'Info', value: 'info' },
                ],
                onFilter: (value: any, record: GapIssue) => record.severity === value,
            },
            {
                title: 'Category',
                dataIndex: 'category',
                key: 'category',
                render: (cat: string) => <Tag color="purple">{cat}</Tag>,
            },
            {
                title: 'Issue',
                dataIndex: 'issue',
                key: 'issue',
            },
            {
                title: 'Affected',
                dataIndex: 'affectedRecords',
                key: 'affectedRecords',
                render: (count: number) => (count > 0 ? `${count} records` : '-'),
                sorter: (a: GapIssue, b: GapIssue) => a.affectedRecords - b.affectedRecords,
            },
            {
                title: 'Recommendation',
                dataIndex: 'recommendation',
                key: 'recommendation',
                ellipsis: true,
                render: (text: string) => (
                    <Tooltip title={text}>
                        <span style={{ color: '#94a3b8' }}>{text || '-'}</span>
                    </Tooltip>
                ),
            },
        ];

        return (
            <div className="spec-gap-table-section">
                <div className="spec-gap-table-header">
                    <span className="spec-gap-table-title">
                        <FileSearchOutlined style={{ color: '#38bdf8' }} />
                        All Issues ({filteredIssues.length})
                    </span>
                    <div className="spec-gap-table-controls">
                        <input
                            type="text"
                            className="spec-gap-search-input"
                            placeholder="Search variables or issues..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <Dropdown menu={exportMenu} trigger={['click']}>
                            <Button icon={<DownloadOutlined />}>Export</Button>
                        </Dropdown>
                    </div>
                </div>
                <Table
                    dataSource={filteredIssues}
                    columns={columns}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 10 }}
                    style={{ padding: 16, background: 'transparent' }}
                />
            </div>
        );
    };

    return (
        <div className="spec-gap-container">
            {/* Page Header */}
            <PageHeader
                title="Spec Gap Detector"
                subtitle="Intelligent validation comparing datasets against specifications"
                icon={<FileSearchOutlined />}
            />

            <div className="spec-gap-content">
                {/* Hero Section */}
                <div className="spec-gap-hero">
                    <div className="spec-gap-hero-content">
                        <div className="spec-gap-hero-icon">
                            <SafetyOutlined />
                        </div>
                        <h1 className="spec-gap-hero-title">Intelligent Gap Detection</h1>
                        <p className="spec-gap-hero-subtitle">
                            Upload your ADAM dataset and specification to instantly identify discrepancies,
                            missing values, and compliance issues with AI-powered insights.
                        </p>
                        {validationResult && (
                            <div className="spec-gap-hero-stats">
                                <div className="spec-gap-hero-stat">
                                    <div className="spec-gap-hero-stat-value">{validationResult.healthScore}%</div>
                                    <div className="spec-gap-hero-stat-label">Health Score</div>
                                </div>
                                <div className="spec-gap-hero-stat">
                                    <div className="spec-gap-hero-stat-value">{validationResult.totalVariablesChecked}</div>
                                    <div className="spec-gap-hero-stat-label">Variables Checked</div>
                                </div>
                                <div className="spec-gap-hero-stat">
                                    <div className="spec-gap-hero-stat-value">{validationResult.issues.length}</div>
                                    <div className="spec-gap-hero-stat-label">Issues Found</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Upload Section */}
                <div className="spec-gap-upload-section">
                    {renderUploadCard('dataset', datasetFile, datasetMeta, handleDatasetUpload, handleRemoveDataset)}
                    <div className="spec-gap-connector">
                        <div className="spec-gap-connector-line" />
                        <div className="spec-gap-connector-icon">
                            <LinkOutlined />
                        </div>
                        <div className="spec-gap-connector-line" />
                    </div>
                    {renderUploadCard('specification', specFile, specMeta, handleSpecUpload, handleRemoveSpec)}
                </div>

                {/* Analyze Button */}
                <div className="spec-gap-analyze-section">
                    <Button
                        type="primary"
                        size="large"
                        icon={isAnalyzing ? <SyncOutlined spin /> : <ThunderboltOutlined />}
                        onClick={handleAnalyze}
                        disabled={!datasetFile || !specFile || isAnalyzing}
                        className={`spec-gap-analyze-btn ${isAnalyzing ? 'analyzing' : ''}`}
                    >
                        {isAnalyzing ? 'Analyzing...' : 'Detect Gaps'}
                    </Button>
                </div>

                {/* Loading State */}
                {isAnalyzing && (
                    <div className="spec-gap-loading">
                        <div className="spec-gap-loading-spinner" />
                        <div className="spec-gap-loading-text">Analyzing dataset against specification...</div>
                        <div className="spec-gap-loading-progress">
                            <div className="spec-gap-loading-progress-bar" />
                        </div>
                    </div>
                )}

                {/* Results */}
                {validationResult && !isAnalyzing && (
                    <div className="spec-gap-results">
                        {/* Health Card */}
                        <div className={`spec-gap-health-card ${validationResult.healthStatus}`}>
                            {renderHealthRing()}
                            <div className="spec-gap-health-details">
                                <h2 className="spec-gap-health-title">
                                    {validationResult.healthStatus === 'excellent'
                                        ? '✅ Excellent Compliance'
                                        : validationResult.healthStatus === 'good'
                                            ? '👍 Good Compliance'
                                            : validationResult.healthStatus === 'warning'
                                                ? '⚠️ Needs Attention'
                                                : '🚨 Critical Issues Found'}
                                </h2>
                                <p className="spec-gap-health-subtitle">
                                    {validationResult.healthStatus === 'critical'
                                        ? 'Multiple critical issues require immediate attention before submission.'
                                        : validationResult.healthStatus === 'warning'
                                            ? 'Some issues should be addressed to improve compliance.'
                                            : 'Your dataset aligns well with the specification.'}
                                </p>
                                <div className="spec-gap-health-metrics">
                                    <div className="spec-gap-health-metric">
                                        <div className="spec-gap-health-metric-value error">
                                            {validationResult.criticalCount}
                                        </div>
                                        <div className="spec-gap-health-metric-label">Critical</div>
                                    </div>
                                    <div className="spec-gap-health-metric">
                                        <div className="spec-gap-health-metric-value warning">
                                            {validationResult.warningCount}
                                        </div>
                                        <div className="spec-gap-health-metric-label">Warnings</div>
                                    </div>
                                    <div className="spec-gap-health-metric">
                                        <div className="spec-gap-health-metric-value info">
                                            {validationResult.infoCount}
                                        </div>
                                        <div className="spec-gap-health-metric-label">Info</div>
                                    </div>
                                    <div className="spec-gap-health-metric">
                                        <div className="spec-gap-health-metric-value success">
                                            {validationResult.matchingVariables}
                                        </div>
                                        <div className="spec-gap-health-metric-label">Matching</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <Tabs
                            activeKey={activeTab}
                            onChange={setActiveTab}
                            items={[
                                {
                                    key: 'overview',
                                    label: (
                                        <span>
                                            <SafetyOutlined /> Overview
                                        </span>
                                    ),
                                    children: (
                                        <>
                                            {/* Issues Grid */}
                                            <div className="spec-gap-issues-grid">
                                                {renderIssuesPanel('Critical Issues', 'critical', validationResult.issues)}
                                                {renderIssuesPanel('Warnings', 'warning', validationResult.issues)}
                                                {renderIssuesPanel('Informational', 'info', validationResult.issues)}
                                            </div>
                                            {/* AI Panel */}
                                            {renderAIPanel()}
                                        </>
                                    ),
                                },
                                {
                                    key: 'details',
                                    label: (
                                        <span>
                                            <FileSearchOutlined /> All Issues
                                        </span>
                                    ),
                                    children: renderDetailedTable(),
                                },
                                {
                                    key: 'ai',
                                    label: (
                                        <span>
                                            <RobotOutlined /> AI Assistant
                                        </span>
                                    ),
                                    children: renderAIPanel(),
                                },
                            ]}
                        />

                        {/* Export Bar */}
                        <div className="spec-gap-export-bar">
                            <Dropdown menu={exportMenu} trigger={['click']}>
                                <button className="spec-gap-export-btn">
                                    <DownloadOutlined />
                                    Export Report
                                </button>
                            </Dropdown>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!validationResult && !isAnalyzing && (
                    <div className="spec-gap-empty">
                        <FileSearchOutlined className="spec-gap-empty-icon" />
                        <div className="spec-gap-empty-title">Ready to Detect Gaps</div>
                        <div className="spec-gap-empty-text">
                            Upload your ADAM dataset and specification file to identify discrepancies,
                            missing values, and specification violations. AI will provide actionable insights
                            to ensure submission readiness.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MissingSpecDetectorTab;
