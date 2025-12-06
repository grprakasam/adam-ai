import React, { useState, useEffect } from 'react';
import { Button, Tooltip } from 'antd';
import {
    FolderOutlined,
    PlusOutlined,
    CloudUploadOutlined,
    InfoCircleOutlined,
    CloseOutlined
} from '@ant-design/icons';
import { useStudyStore } from '../store/studyStore';
import './StudyContextPrompt.css';

interface StudyContextPromptProps {
    /** Title for the prompt card */
    title?: string;
    /** Description text */
    description?: string;
    /** Whether to show the upload spec option */
    showUploadOption?: boolean;
    /** Callback when user clicks "Select Study" */
    onSelectStudy?: () => void;
    /** Callback when user clicks "Create Study" */
    onCreateStudy?: () => void;
    /** Callback when user clicks "Work Independently" */
    onWorkIndependently?: () => void;
    /** Callback when user uploads a spec file */
    onUploadSpec?: (file: File) => void;
    /** Module name for contextual messaging */
    moduleName?: string;
    /** Compact mode for smaller spaces */
    compact?: boolean;
}

const SESSION_KEY = 'adam_study_prompt_dismissed';

export const StudyContextPrompt: React.FC<StudyContextPromptProps> = ({
    title = "Quick Start",
    description,
    showUploadOption = true,
    onSelectStudy,
    onCreateStudy,
    onWorkIndependently,
    onUploadSpec,
    moduleName = "this module",
    compact = false
}) => {
    const [isDismissed, setIsDismissed] = useState(false);
    const { currentStudyId, studies } = useStudyStore();

    // Check session storage for dismissed state
    useEffect(() => {
        const dismissed = sessionStorage.getItem(SESSION_KEY);
        if (dismissed === 'true') {
            setIsDismissed(true);
        }
    }, []);

    // If study is already selected, don't show the prompt
    if (currentStudyId) return null;

    // If dismissed, don't show
    if (isDismissed) return null;

    const handleDismiss = () => {
        setIsDismissed(true);
        sessionStorage.setItem(SESSION_KEY, 'true');
        onWorkIndependently?.();
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && onUploadSpec) {
            onUploadSpec(file);
            handleDismiss();
        }
    };

    const defaultDescription = `You're working independently. Select a study to auto-load specifications and documents, or continue working manually.`;

    if (compact) {
        return (
            <div className="study-context-prompt compact">
                <div className="study-prompt-content">
                    <span className="study-prompt-text">
                        <InfoCircleOutlined /> No study selected
                    </span>
                    <div className="study-prompt-actions">
                        <Button size="small" onClick={onSelectStudy}>
                            Select Study
                        </Button>
                        <Button size="small" type="link" onClick={handleDismiss}>
                            Dismiss
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="study-context-prompt">
            <button className="study-prompt-dismiss" onClick={handleDismiss}>
                <CloseOutlined />
            </button>

            <div className="study-prompt-header">
                <div className="study-prompt-icon">
                    <FolderOutlined />
                </div>
                <div className="study-prompt-title-area">
                    <h3 className="study-prompt-title">{title}</h3>
                    <p className="study-prompt-description">
                        {description || defaultDescription}
                    </p>
                </div>
            </div>

            <div className="study-prompt-actions">
                {onSelectStudy && (
                    <Button
                        type="primary"
                        icon={<FolderOutlined />}
                        onClick={onSelectStudy}
                        className="study-prompt-btn primary"
                    >
                        Select Study {studies.length > 0 && `(${studies.length})`}
                    </Button>
                )}

                {onCreateStudy && (
                    <Button
                        icon={<PlusOutlined />}
                        onClick={onCreateStudy}
                        className="study-prompt-btn"
                    >
                        Create New Study
                    </Button>
                )}

                {showUploadOption && (
                    <Tooltip title="Upload an ADAM specification file to work independently">
                        <label className="study-prompt-upload-btn">
                            <CloudUploadOutlined />
                            <span>Upload Spec</span>
                            <input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </Tooltip>
                )}
            </div>

            <div className="study-prompt-tip">
                <InfoCircleOutlined />
                <span>
                    Working with a study lets you auto-load specifications, track progress, and use the Study ChatBot.
                </span>
            </div>
        </div>
    );
};

export default StudyContextPrompt;
