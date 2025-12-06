
import {
    RocketOutlined,
    CodeOutlined,
    BranchesOutlined,
    ExperimentOutlined,
    FileTextOutlined,
    ToolOutlined,
    SwapOutlined,
    ThunderboltOutlined,
    BugOutlined,
    ThunderboltFilled,
    SafetyOutlined,
    CheckCircleOutlined,
    AuditOutlined,
    UserSwitchOutlined,
    BulbOutlined,
    RobotOutlined,
    ReadOutlined,
    RobotFilled,
    DashboardOutlined,
    DeploymentUnitOutlined,
    HighlightOutlined,
    DiffOutlined,
    FileSearchOutlined
} from '@ant-design/icons';
import React from 'react';

export interface UtilityFeature {
    key: string;
    name: string;
    path: string;
    icon?: React.ReactNode;
    status?: 'Live' | 'Preview' | 'Coming Soon';
    statusColor?: string;
    actionLabel?: string;
    tagline?: string;
    subPages?: { name: string; path: string }[];
}

export interface WorkflowGroup {
    key: string;
    name: string;
    shortName?: string; // Shorter name for header
    description?: string;
    icon?: React.ReactNode;
    gradient?: string;
    accentColor?: string;
    features: UtilityFeature[];
}

export const workflowGroups: WorkflowGroup[] = [
    {
        key: 'core-workflow',
        name: 'SDTM ADAM TLF Programming',
        shortName: 'ADAM Coding',
        description: 'End-to-end SDTM test data, ADaM builds, and TLF generation',
        icon: React.createElement(RocketOutlined),
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        accentColor: '#667eea',
        features: [
            {
                key: 'sdtm-generator',
                name: 'SDTM Test Data Generator',
                path: '/test-with-data',
                icon: React.createElement(ExperimentOutlined),
                status: 'Live',
                statusColor: 'green',
                actionLabel: 'Launch',
                tagline: 'Generate SDTM-like sample data for dry runs and testing',
            },
            {
                key: 'pair-programmer',
                name: 'ADAM AI Pair Programmer',
                path: '/workspace', // Default path if clicked parent
                icon: React.createElement(CodeOutlined),
                status: 'Live',
                statusColor: 'green',
                actionLabel: 'Launch',
                tagline: 'AI-assisted code generation for ADAM specifications',
                subPages: [
                    { name: 'Pair Programming', path: '/pair-programming' },
                    { name: 'Code Review', path: '/code-review' },
                    { name: 'Consolidated Code', path: '/consolidated-code' },
                ]
            },
            {
                key: 'adam-generator',
                name: 'ADAM Generator',
                path: '/adam-generator',
                icon: React.createElement(RocketOutlined),
                status: 'Live',
                statusColor: 'green',
                actionLabel: 'Launch',
                tagline: 'Generate ADAM datasets from SDTM + code',
            },
            {
                key: 'tlf-generator',
                name: 'TLF Generator',
                path: '/tlf-generator',
                icon: React.createElement(FileTextOutlined),
                status: 'Live',
                statusColor: 'green',
                actionLabel: 'Launch',
                tagline: 'Create Tables, Listings, Figures from mockshells',
            },
            {
                key: 'traceability',
                name: 'Traceability Matrix',
                path: '/traceability',
                icon: React.createElement(BranchesOutlined),
                status: 'Live',
                statusColor: 'green',
                actionLabel: 'Launch',
                tagline: 'ADAM specification traceability to SDTM',
            },
        ],
    },
    {
        key: 'development-tools',
        name: 'Development Tools',
        description: 'Build, test, and optimize your clinical code',
        icon: React.createElement(ToolOutlined),
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        accentColor: '#f5576c',
        features: [
            {
                key: 'code-converter',
                name: 'SAS to R Migration',
                path: '/migration',
                icon: React.createElement(SwapOutlined),
                status: 'Live',
                statusColor: 'green',
                actionLabel: 'Launch',
                tagline: 'AI-powered SAS to R code migration framework',
            },
            {
                key: 'r-frontend',
                name: 'R Frontend',
                path: '/r-frontend',
                icon: React.createElement(ThunderboltOutlined),
                status: 'Live',
                statusColor: 'green',
                actionLabel: 'Launch',
                tagline: 'Execute R programs in browser',
            },
            {
                key: 'ai-code-debugger',
                name: 'AI Code Debugger',
                path: '/ai-code-debugger',
                icon: React.createElement(BugOutlined),
                status: 'Preview',
                statusColor: 'blue',
                actionLabel: 'Try Now',
                tagline: 'AI explains error logs and suggests fixes',
            },
            {
                key: 'code-refactorer',
                name: 'Code Refactorer',
                path: '/code-refactorer',
                icon: React.createElement(ThunderboltFilled),
                status: 'Preview',
                statusColor: 'blue',
                actionLabel: 'Try Now',
                tagline: 'AI suggests code optimizations',
            },
        ],
    },
    {
        key: 'quality-compliance',
        name: 'Quality & Compliance',
        description: 'Validate and prepare for submission',
        icon: React.createElement(SafetyOutlined),
        gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        accentColor: '#4facfe',
        features: [
            {
                key: 'submission',
                name: 'Submission Dashboard',
                path: '/submission-dashboard',
                icon: React.createElement(CheckCircleOutlined),
                status: 'Live',
                statusColor: 'green',
                actionLabel: 'Launch',
                tagline: 'AI-powered submission readiness tracking',
            },
            {
                key: 'esubmission-checker',
                name: 'eSubmission Checker',
                path: '/esubmission-checker',
                icon: React.createElement(AuditOutlined),
                status: 'Preview',
                statusColor: 'blue',
                actionLabel: 'Try Now',
                tagline: 'FDA eSubmission conformance scan',
            },
            {
                key: 'fda-reviewer-preview',
                name: 'FDA Reviewer Persona',
                path: '/fda-reviewer-preview',
                icon: React.createElement(UserSwitchOutlined),
                status: 'Preview',
                statusColor: 'blue',
                actionLabel: 'Try Now',
                tagline: 'AI simulates FDA reviewer feedback',
            },
        ],
    },
    {
        key: 'intelligence-learning',
        name: 'Intelligence & Learning',
        description: 'AI assistants and educational resources',
        icon: React.createElement(BulbOutlined),
        gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        accentColor: '#43e97b',
        features: [
            {
                key: 'chatbot',
                name: 'Study ChatBot',
                path: '/study-chatbot',
                icon: React.createElement(RobotOutlined),
                status: 'Preview',
                statusColor: 'blue',
                actionLabel: 'Try Now',
                tagline: 'AI answers about study documents',
            },
            {
                key: 'adam-tutor',
                name: 'ADAM Tutor',
                path: '/adam-tutor',
                icon: React.createElement(ReadOutlined),
                status: 'Preview',
                statusColor: 'blue upbeat',
                actionLabel: 'Try Now',
                tagline: 'Interactive ADAM programming tutorials',
            },
            {
                key: 'agentic-ai',
                name: 'Agentic AI',
                path: '/agentic-ai',
                icon: React.createElement(RobotFilled),
                status: 'Preview',
                statusColor: 'blue',
                actionLabel: 'Try Now',
                tagline: 'Autonomous AI agents for complex tasks',
            },
            {
                key: 'analytics',
                name: 'Role-based Analytics',
                path: '/adam-data-analytics',
                icon: React.createElement(DashboardOutlined),
                status: 'Coming Soon',
                statusColor: 'orange',
                actionLabel: 'Coming Soon',
                tagline: 'Analyze data as Statistician or Clinician',
            },
        ],
    },
    {
        key: 'utilities-ai',
        name: 'Utilities.AI',
        description: 'Quick AI helpers for comparisons and gap checks',
        icon: React.createElement(ExperimentOutlined),
        gradient: 'linear-gradient(135deg, #b5fffc 0%, #ffdee9 100%)',
        accentColor: '#8b5cf6',
        features: [
            {
                key: 'dataset-comparer',
                name: 'Dataset Comparer',
                path: '/adam-dataset-comparer',
                icon: React.createElement(DeploymentUnitOutlined),
                status: 'Preview',
                statusColor: 'blue',
                actionLabel: 'Try Now',
                tagline: 'Compare datasets and identify differences',
            },
            {
                key: 'code-comparer',
                name: 'Code Comparer',
                path: '/code-comparer',
                icon: React.createElement(HighlightOutlined),
                status: 'Preview',
                statusColor: 'blue',
                actionLabel: 'Try Now',
                tagline: 'Compare development and validation code',
            },
            {
                key: 'spec-comparison',
                name: 'Spec Comparison',
                path: '/spec-comparison',
                icon: React.createElement(DiffOutlined),
                status: 'Preview',
                statusColor: 'blue',
                actionLabel: 'Try Now',
                tagline: 'Compare specification versions semantically',
            },
            {
                key: 'missing-spec-detector',
                name: 'Spec Gap Detector',
                path: '/missing-spec-detector',
                icon: React.createElement(FileSearchOutlined),
                status: 'Preview',
                statusColor: 'blue',
                actionLabel: 'Try Now',
                tagline: 'Find discrepancies between dataset and spec',
            },
        ],
    },
];
