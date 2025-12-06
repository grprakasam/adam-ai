import React, { useState, useEffect } from 'react';
import { Button } from 'antd';
import {
    CloseOutlined,
    BulbOutlined,
    RightOutlined
} from '@ant-design/icons';
import './SmartBanner.css';

interface SmartBannerProps {
    /** Unique ID for storing dismiss state */
    id: string;
    /** Message to display */
    message: string;
    /** Type of banner */
    type?: 'tip' | 'info' | 'warning';
    /** Primary action button config */
    action?: {
        label: string;
        onClick: () => void;
    };
    /** Whether to show dismiss button */
    dismissable?: boolean;
    /** Icon to show (defaults based on type) */
    icon?: React.ReactNode;
}

export const SmartBanner: React.FC<SmartBannerProps> = ({
    id,
    message: bannerMessage,
    type = 'tip',
    action,
    dismissable = true,
    icon
}) => {
    const [isDismissed, setIsDismissed] = useState(false);
    const storageKey = `adam_banner_${id}`;

    useEffect(() => {
        const dismissed = sessionStorage.getItem(storageKey);
        if (dismissed === 'true') {
            setIsDismissed(true);
        }
    }, [storageKey]);

    if (isDismissed) return null;

    const handleDismiss = () => {
        setIsDismissed(true);
        sessionStorage.setItem(storageKey, 'true');
    };

    const getIcon = () => {
        if (icon) return icon;
        switch (type) {
            case 'tip':
                return <BulbOutlined />;
            case 'info':
                return <BulbOutlined />;
            case 'warning':
                return <BulbOutlined />;
            default:
                return <BulbOutlined />;
        }
    };

    return (
        <div className={`smart-banner smart-banner-${type}`}>
            <div className="smart-banner-icon">
                {getIcon()}
            </div>
            <div className="smart-banner-content">
                <span className="smart-banner-message">{bannerMessage}</span>
            </div>
            <div className="smart-banner-actions">
                {action && (
                    <Button
                        type="link"
                        size="small"
                        onClick={action.onClick}
                        className="smart-banner-action"
                    >
                        {action.label} <RightOutlined />
                    </Button>
                )}
                {dismissable && (
                    <button
                        className="smart-banner-dismiss"
                        onClick={handleDismiss}
                        aria-label="Dismiss"
                    >
                        <CloseOutlined />
                    </button>
                )}
            </div>
        </div>
    );
};

export default SmartBanner;
