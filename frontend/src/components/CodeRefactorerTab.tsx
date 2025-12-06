import { useState, useCallback } from 'react';
import { message, Tooltip } from 'antd';
import {
    ThunderboltOutlined,
    CodeOutlined,
    RocketOutlined,
    BulbOutlined,
    CheckCircleOutlined,
    CopyOutlined,
    ClearOutlined,
    ArrowRightOutlined,
    SafetyCertificateOutlined,
    SyncOutlined,
    UploadOutlined,
} from '@ant-design/icons';
import './CodeRefactorerTab.css';

interface Suggestion {
    id: number;
    type: 'performance' | 'readability' | 'best-practice';
    title: string;
    description: string;
    impact: string;
    originalCode?: string;
    suggestedCode?: string;
}

const SAMPLE_SUGGESTIONS: Suggestion[] = [
    {
        id: 1,
        type: 'performance',
        title: 'Replace nested DO loop with HASH object',
        description: 'The current nested DO loop performs sequential reads which is inefficient for large datasets. Using a HASH object will provide O(1) lookup time.',
        impact: '+30% faster execution',
    },
    {
        id: 2,
        type: 'readability',
        title: 'Add meaningful variable labels',
        description: 'Clinical datasets require proper labels for regulatory submissions. Missing labels detected for TRTSDT, TRTEDT, and SAFFL.',
        impact: 'Improved documentation',
    },
    {
        id: 3,
        type: 'best-practice',
        title: 'Use explicit LENGTH statements',
        description: 'Define character variable lengths explicitly before assignment to prevent truncation issues and improve code maintainability.',
        impact: '100% compliance',
    },
];

const sampleSASCode = `/* Original ADSL derivation with performance issues */
data ADSL;
  set SDTM.DM;
  do i = 1 to nobs;
    set SDTM.EX point=i nobs=nobs;
    if DM.USUBJID = EX.USUBJID then do;
      TRTSDT = EX.EXSTDTC;
      TRTEDT = EX.EXENDTC;
    end;
  end;
  drop i;
run;`;

const sampleRCode = `# Original ADSL derivation with performance issues
library(dplyr)

adsl <- dm %>%
  rowwise() %>%
  mutate(
    trtsdt = {
      match_row <- ex[ex$USUBJID == USUBJID, ]
      if(nrow(match_row) > 0) match_row$EXSTDTC[1] else NA
    },
    trtedt = {
      match_row <- ex[ex$USUBJID == USUBJID, ]
      if(nrow(match_row) > 0) match_row$EXENDTC[1] else NA
    }
  )`;

const optimizedSASCode = `/* Optimized ADSL derivation using HASH object */
data ADSL;
  if _n_ = 1 then do;
    declare hash h(dataset: 'SDTM.EX');
    h.defineKey('USUBJID');
    h.defineData('EXSTDTC', 'EXENDTC');
    h.defineDone();
  end;
  
  set SDTM.DM;
  
  /* HASH lookup - O(1) performance */
  length TRTSDT TRTEDT $10;
  label TRTSDT = 'Date of First Exposure to Treatment'
        TRTEDT = 'Date of Last Exposure to Treatment';
  
  if h.find(key: USUBJID) = 0 then do;
    TRTSDT = EXSTDTC;
    TRTEDT = EXENDTC;
  end;
run;`;

const optimizedRCode = `# Optimized ADSL derivation using dplyr join
library(dplyr)

# Prepare exposure data with first/last dates per subject
ex_summary <- ex %>%
  group_by(USUBJID) %>%
  summarise(
    TRTSDT = min(EXSTDTC, na.rm = TRUE),
    TRTEDT = max(EXENDTC, na.rm = TRUE),
    .groups = 'drop'
  )

# Efficient left join - vectorized operation
adsl <- dm %>%
  left_join(ex_summary, by = "USUBJID") %>%
  mutate(
    TRTSDT = as.character(TRTSDT),
    TRTEDT = as.character(TRTEDT)
  )`;

const CodeRefactorerTab = () => {
    const [language, setLanguage] = useState<'SAS' | 'R'>('SAS');
    const [inputCode, setInputCode] = useState('');
    const [outputCode, setOutputCode] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [optimizationScore, setOptimizationScore] = useState<number | null>(null);

    const handleAnalyze = useCallback(async () => {
        if (!inputCode.trim()) {
            message.warning('Please enter some code to analyze');
            return;
        }

        setIsAnalyzing(true);
        setSuggestions([]);
        setOptimizationScore(null);
        setOutputCode('');

        // Simulate AI analysis
        await new Promise(resolve => setTimeout(resolve, 2000));

        setSuggestions(SAMPLE_SUGGESTIONS);
        setOptimizationScore(87);
        setOutputCode(language === 'SAS' ? optimizedSASCode : optimizedRCode);
        setIsAnalyzing(false);

        message.success('Analysis complete! Found 3 optimization opportunities.');
    }, [inputCode, language]);

    const handleLoadSample = useCallback(() => {
        setInputCode(language === 'SAS' ? sampleSASCode : sampleRCode);
        setOutputCode('');
        setSuggestions([]);
        setOptimizationScore(null);
        message.info(`Sample ${language} code loaded`);
    }, [language]);

    const handleClear = useCallback(() => {
        setInputCode('');
        setOutputCode('');
        setSuggestions([]);
        setOptimizationScore(null);
    }, []);

    const handleCopyOutput = useCallback(() => {
        if (outputCode) {
            navigator.clipboard.writeText(outputCode);
            message.success('Optimized code copied to clipboard!');
        }
    }, [outputCode]);

    const handleApplySuggestion = useCallback((suggestion: Suggestion) => {
        message.success(`Applied: ${suggestion.title}`);
    }, []);

    const getSuggestionTypeLabel = (type: Suggestion['type']) => {
        switch (type) {
            case 'performance': return '⚡ Performance';
            case 'readability': return '📖 Readability';
            case 'best-practice': return '✓ Best Practice';
        }
    };

    return (
        <div className="code-refactorer">
            {/* Hero Section */}
            <div className="code-refactorer__hero">
                <div className="code-refactorer__hero-content">
                    <div className="code-refactorer__hero-badge">
                        <ThunderboltOutlined />
                        AI-Powered Optimization
                    </div>
                    <h1 className="code-refactorer__hero-title">
                        Code Refactorer
                    </h1>
                    <p className="code-refactorer__hero-subtitle">
                        Analyze your SAS or R scripts and get AI-powered recommendations for better
                        performance, readability, and maintainability. Optimized for clinical
                        programming best practices.
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="code-refactorer__main">
                {/* Feature Cards */}
                <div className="code-refactorer__features">
                    <div className="code-refactorer__feature-card">
                        <div className="code-refactorer__feature-icon code-refactorer__feature-icon--performance">
                            <RocketOutlined />
                        </div>
                        <h3 className="code-refactorer__feature-title">Performance Boost</h3>
                        <p className="code-refactorer__feature-desc">
                            Identify slow code patterns and get recommendations for 30-50% faster
                            execution with optimized data structures.
                        </p>
                    </div>

                    <div className="code-refactorer__feature-card">
                        <div className="code-refactorer__feature-icon code-refactorer__feature-icon--readability">
                            <BulbOutlined />
                        </div>
                        <h3 className="code-refactorer__feature-title">Enhanced Readability</h3>
                        <p className="code-refactorer__feature-desc">
                            Get suggestions for cleaner code structure, better naming conventions,
                            and improved documentation.
                        </p>
                    </div>

                    <div className="code-refactorer__feature-card">
                        <div className="code-refactorer__feature-icon code-refactorer__feature-icon--best-practices">
                            <SafetyCertificateOutlined />
                        </div>
                        <h3 className="code-refactorer__feature-title">Clinical Best Practices</h3>
                        <p className="code-refactorer__feature-desc">
                            Ensure compliance with CDISC standards, ADAM IG guidelines, and
                            regulatory submission requirements.
                        </p>
                    </div>
                </div>

                {/* Upload Section */}
                <div className="code-refactorer__upload-section">
                    <div className="code-refactorer__section-header">
                        <div className="code-refactorer__section-icon">
                            <CodeOutlined />
                        </div>
                        <div>
                            <h2 className="code-refactorer__section-title">Analyze Your Code</h2>
                            <p className="code-refactorer__section-subtitle">
                                Select your programming language and paste your code for AI analysis
                            </p>
                        </div>
                    </div>

                    {/* Language Selector */}
                    <div className="code-refactorer__language-selector">
                        <button
                            className={`code-refactorer__language-btn ${language === 'SAS' ? 'code-refactorer__language-btn--active' : ''}`}
                            onClick={() => {
                                setLanguage('SAS');
                                handleClear();
                            }}
                        >
                            <div className="code-refactorer__language-icon code-refactorer__language-icon--sas">
                                SAS
                            </div>
                            <div className="code-refactorer__language-info">
                                <h4>SAS Programming</h4>
                                <p>DATA steps, PROC SQL, Macros</p>
                            </div>
                        </button>

                        <button
                            className={`code-refactorer__language-btn ${language === 'R' ? 'code-refactorer__language-btn--active' : ''}`}
                            onClick={() => {
                                setLanguage('R');
                                handleClear();
                            }}
                        >
                            <div className="code-refactorer__language-icon code-refactorer__language-icon--r">
                                R
                            </div>
                            <div className="code-refactorer__language-info">
                                <h4>R Programming</h4>
                                <p>tidyverse, dplyr, haven</p>
                            </div>
                        </button>
                    </div>

                    {/* Code Editors */}
                    <div className="code-refactorer__editor-wrapper">
                        <div className="code-refactorer__editor-panel">
                            <div className="code-refactorer__editor-label">
                                <span className="code-refactorer__editor-label-text">
                                    <UploadOutlined />
                                    Input Code
                                </span>
                                <span className="code-refactorer__editor-badge code-refactorer__editor-badge--input">
                                    Original
                                </span>
                            </div>
                            <textarea
                                className="code-refactorer__textarea"
                                value={inputCode}
                                onChange={(e) => setInputCode(e.target.value)}
                                placeholder={`Paste your ${language} code here for optimization analysis...`}
                                spellCheck={false}
                            />
                        </div>

                        <div className="code-refactorer__editor-panel">
                            <div className="code-refactorer__editor-label">
                                <span className="code-refactorer__editor-label-text">
                                    <CheckCircleOutlined />
                                    Optimized Code
                                </span>
                                <span className="code-refactorer__editor-badge code-refactorer__editor-badge--output">
                                    Improved
                                </span>
                            </div>
                            <textarea
                                className="code-refactorer__textarea code-refactorer__textarea--output"
                                value={outputCode}
                                readOnly
                                placeholder="Optimized code will appear here after analysis..."
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="code-refactorer__actions">
                        <button
                            className="code-refactorer__btn code-refactorer__btn--secondary"
                            onClick={handleLoadSample}
                        >
                            <CodeOutlined />
                            Load Sample
                        </button>

                        <button
                            className="code-refactorer__btn code-refactorer__btn--secondary"
                            onClick={handleClear}
                        >
                            <ClearOutlined />
                            Clear
                        </button>

                        <button
                            className="code-refactorer__btn code-refactorer__btn--primary"
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || !inputCode.trim()}
                        >
                            {isAnalyzing ? (
                                <>
                                    <SyncOutlined spin />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <ThunderboltOutlined />
                                    Analyze & Optimize
                                </>
                            )}
                        </button>

                        {outputCode && (
                            <Tooltip title="Copy optimized code">
                                <button
                                    className="code-refactorer__btn code-refactorer__btn--secondary"
                                    onClick={handleCopyOutput}
                                >
                                    <CopyOutlined />
                                    Copy Result
                                </button>
                            </Tooltip>
                        )}
                    </div>
                </div>

                {/* Loading State */}
                {isAnalyzing && (
                    <div className="code-refactorer__loading">
                        <div className="code-refactorer__loading-spinner" />
                        <div className="code-refactorer__loading-text">
                            Analyzing your code with AI...
                        </div>
                        <div className="code-refactorer__loading-subtext">
                            Checking for performance bottlenecks, readability issues, and best practices
                        </div>
                    </div>
                )}

                {/* Suggestions Section */}
                {suggestions.length > 0 && !isAnalyzing && (
                    <div className="code-refactorer__suggestions">
                        <div className="code-refactorer__suggestions-header">
                            <div className="code-refactorer__suggestions-title">
                                <div className="code-refactorer__suggestions-icon">
                                    <BulbOutlined />
                                </div>
                                <div>
                                    <h2 className="code-refactorer__section-title">
                                        AI Recommendations
                                    </h2>
                                    <p className="code-refactorer__section-subtitle">
                                        {suggestions.length} optimization opportunities found
                                    </p>
                                </div>
                            </div>

                            {optimizationScore !== null && (
                                <div className="code-refactorer__score">
                                    <span className="code-refactorer__score-label">
                                        Optimization Score
                                    </span>
                                    <span className="code-refactorer__score-value">
                                        {optimizationScore}%
                                    </span>
                                    <span className="code-refactorer__score-change">
                                        ↑ +23%
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="code-refactorer__suggestion-list">
                            {suggestions.map((suggestion, index) => (
                                <div
                                    key={suggestion.id}
                                    className="code-refactorer__suggestion-card"
                                >
                                    <div className="code-refactorer__suggestion-number">
                                        {index + 1}
                                    </div>
                                    <div className="code-refactorer__suggestion-content">
                                        <span className={`code-refactorer__suggestion-type code-refactorer__suggestion-type--${suggestion.type}`}>
                                            {getSuggestionTypeLabel(suggestion.type)}
                                        </span>
                                        <h4 className="code-refactorer__suggestion-title">
                                            {suggestion.title}
                                        </h4>
                                        <p className="code-refactorer__suggestion-desc">
                                            {suggestion.description}
                                        </p>
                                        <div className="code-refactorer__suggestion-impact">
                                            <CheckCircleOutlined />
                                            Expected impact: {suggestion.impact}
                                        </div>
                                    </div>
                                    <div className="code-refactorer__suggestion-apply">
                                        <button
                                            className="code-refactorer__apply-btn"
                                            onClick={() => handleApplySuggestion(suggestion)}
                                        >
                                            Apply
                                            <ArrowRightOutlined />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!isAnalyzing && suggestions.length === 0 && !inputCode && (
                    <div className="code-refactorer__empty">
                        <div className="code-refactorer__empty-icon">
                            <CodeOutlined />
                        </div>
                        <h3 className="code-refactorer__empty-title">
                            Ready to Optimize Your Code
                        </h3>
                        <p className="code-refactorer__empty-desc">
                            Paste your SAS or R code above, or load a sample to see how the AI
                            refactorer works. Get instant recommendations for better performance
                            and cleaner code.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CodeRefactorerTab;
