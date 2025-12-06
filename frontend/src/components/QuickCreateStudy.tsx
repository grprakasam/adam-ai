import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, message } from 'antd';
import {
    CloseOutlined,
    SettingOutlined
} from '@ant-design/icons';
import { useStudyStore } from '../store/studyStore';
import './QuickCreateStudy.css';

interface QuickCreateStudyProps {
    /** Whether the modal is visible */
    visible: boolean;
    /** Callback when modal closes */
    onClose: () => void;
    /** Callback when study is created successfully */
    onStudyCreated?: (studyId: string) => void;
    /** Callback to navigate to full study details page */
    onAdvancedOptions?: () => void;
}

export const QuickCreateStudy: React.FC<QuickCreateStudyProps> = ({
    visible,
    onClose,
    onStudyCreated,
    onAdvancedOptions
}) => {
    const [studyName, setStudyName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const inputRef = useRef<any>(null);
    const { createStudy, setCurrentStudy } = useStudyStore();

    // Focus input when modal opens
    useEffect(() => {
        if (visible) {
            setStudyName('');
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [visible]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && visible) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [visible, onClose]);

    const handleCreate = async () => {
        if (!studyName.trim()) {
            message.warning('Please enter a study name');
            return;
        }

        setIsCreating(true);
        try {
            const study = await createStudy({
                name: studyName.trim(),
                description: 'Created via Quick Create'
            });

            await setCurrentStudy(study.id);
            message.success(`Study "${study.name}" created successfully!`);
            onStudyCreated?.(study.id);
            onClose();
        } catch (error) {
            console.error('Error creating study:', error);
            message.error('Failed to create study. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isCreating) {
            handleCreate();
        }
    };

    if (!visible) return null;

    return (
        <>
            <div className="quick-create-overlay" onClick={onClose} />
            <div className="quick-create-modal">
                <div className="quick-create-header">
                    <h3 className="quick-create-title">Quick Create Study</h3>
                    <button className="quick-create-close" onClick={onClose}>
                        <CloseOutlined />
                    </button>
                </div>

                <div className="quick-create-body">
                    <label className="quick-create-label">Study Name</label>
                    <Input
                        ref={inputRef}
                        placeholder="e.g., PROTOCOL-2024-001"
                        value={studyName}
                        onChange={(e) => setStudyName(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isCreating}
                        size="large"
                        autoComplete="off"
                    />
                </div>

                <div className="quick-create-footer">
                    <Button
                        type="primary"
                        onClick={handleCreate}
                        loading={isCreating}
                        disabled={!studyName.trim()}
                        className="quick-create-btn"
                    >
                        {isCreating ? 'Creating...' : 'Create Study'}
                    </Button>

                    {onAdvancedOptions && (
                        <Button
                            type="link"
                            icon={<SettingOutlined />}
                            onClick={() => {
                                onClose();
                                onAdvancedOptions();
                            }}
                            className="quick-create-advanced"
                        >
                            Advanced Options
                        </Button>
                    )}
                </div>
            </div>
        </>
    );
};

export default QuickCreateStudy;
