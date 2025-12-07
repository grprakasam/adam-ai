/**
 * System Health Panel Component
 * 
 * Displays Docker connection status, R version info, file format requirements,
 * and other system health indicators for the ADAM Generator
 */

import React, { useState, useEffect } from 'react';
import {
    Card,
    Row,
    Col,
    Badge,
    Descriptions,
    Alert,
    Button,
    Tooltip,
    Space,
    Tag,
    Spin,
    Progress,
    Divider,
} from 'antd';
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    SyncOutlined,
    InfoCircleOutlined,
    DockerOutlined,
    CodeOutlined,
    FileTextOutlined,
    CloudDownloadOutlined,
    ExperimentOutlined,
} from '@ant-design/icons';
import './SystemHealthPanel.css';

interface DockerEnvironmentStatus {
    docker_available: boolean;
    r_image_available: boolean;
    sas_image_available: boolean;
    r_image_name?: string;
    sas_image_name?: string;
    error_message?: string;
}

interface RVersionInfo {
    version: string;
    image: string;
    is_default: boolean;
    description?: string;
}

interface SystemHealthPanelProps {
    refreshInterval?: number; // Auto-refresh interval in seconds (0 = no auto-refresh)
    compact?: boolean; // Compact view mode
}

export const SystemHealthPanel: React.FC<SystemHealthPanelProps> = ({
    refreshInterval = 30,
    compact = false,
}) => {
    const [loading, setLoading] = useState(true);
    const [dockerStatus, setDockerStatus] = useState<DockerEnvironmentStatus | null>(null);
    const [rVersions, setRVersions] = useState<RVersionInfo[]>([]);
    const [lastCheck, setLastCheck] = useState<Date | null>(null);
    const autoRefreshEnabled = refreshInterval > 0;

    const checkSystemHealth = async () => {
        setLoading(true);
        try {
            // Check Docker environment
            const dockerResponse = await fetch('/api/v1/code-execution/environment-status');
            const dockerData: DockerEnvironmentStatus = await dockerResponse.json();
            setDockerStatus(dockerData);

            // Get R versions
            const versionsResponse = await fetch('/api/v1/r-execution/versions');
            const versionsData: RVersionInfo[] = await versionsResponse.json();
            setRVersions(versionsData);

            setLastCheck(new Date());
        } catch (error) {
            console.error('Failed to check system health:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkSystemHealth();

        // Auto-refresh if enabled
        if (autoRefreshEnabled && refreshInterval > 0) {
            const interval = setInterval(checkSystemHealth, refreshInterval * 1000);
            return () => clearInterval(interval);
        }
    }, [autoRefreshEnabled, refreshInterval]);

    const getStatusBadge = (isAvailable: boolean, label: string) => {
        if (isAvailable) {
            return <Badge status="success" text={<span style={{ color: '#52c41a' }}>{label}</span>} />;
        }
        return <Badge status="error" text={<span style={{ color: '#ff4d4f' }}>{label}</span>} />;
    };

    const getHealthScore = (): number => {
        if (!dockerStatus) return 0;
        let score = 0;
        if (dockerStatus.docker_available) score += 50;
        if (dockerStatus.r_image_available) score += 40;
        if (rVersions.length > 0) score += 10;
        return score;
    };

    const healthScore = getHealthScore();
    const healthColor = healthScore >= 90 ? '#52c41a' : healthScore >= 50 ? '#faad14' : '#ff4d4f';

    if (compact) {
        return (
            <Card
                size="small"
                className="system-health-compact"
                extra={
                    <Button
                        type="text"
                        size="small"
                        icon={<SyncOutlined spin={loading} />}
                        onClick={checkSystemHealth}
                    />
                }
            >
                <Space size="middle">
                    <Tooltip title="System Health Score">
                        <Progress
                            type="circle"
                            percent={healthScore}
                            width={40}
                            strokeColor={healthColor}
                            format={() => ''}
                        />
                    </Tooltip>
                    {dockerStatus && (
                        <>
                            {dockerStatus.docker_available ? (
                                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                            ) : (
                                <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
                            )}
                            <span>Docker {dockerStatus.docker_available ? 'Ready' : 'Unavailable'}</span>
                        </>
                    )}
                </Space>
            </Card>
        );
    }

    return (
        <Card
            title={
                <Space>
                    <ExperimentOutlined />
                    System Health
                </Space>
            }
            className="system-health-panel"
            extra={
                <Space>
                    {lastCheck && (
                        <span style={{ fontSize: 12, color: '#888' }}>
                            Last check: {lastCheck.toLocaleTimeString()}
                        </span>
                    )}
                    <Button
                        size="small"
                        icon={<SyncOutlined spin={loading} />}
                        onClick={checkSystemHealth}
                    >
                        Refresh
                    </Button>
                </Space>
            }
        >
            {loading && !dockerStatus ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Spin size="large" />
                    <p style={{ marginTop: 16 }}>Checking system health...</p>
                </div>
            ) : (
                <>
                    {/* Overall Health Score */}
                    <Row gutter={16} style={{ marginBottom: 24 }}>
                        <Col span={24}>
                            <div style={{ textAlign: 'center' }}>
                                <Progress
                                    type="circle"
                                    percent={healthScore}
                                    strokeColor={healthColor}
                                    width={120}
                                />
                                <p style={{ marginTop: 16, fontSize: 16, fontWeight: 500 }}>
                                    System Health: {healthScore >= 90 ? 'Excellent' : healthScore >= 50 ? 'Good' : 'Critical'}
                                </p>
                            </div>
                        </Col>
                    </Row>

                    <Divider />

                    {/* Docker Status */}
                    <Row gutter={16} style={{ marginBottom: 24 }}>
                        <Col span={24}>
                            <h4>
                                <DockerOutlined style={{ marginRight: 8 }} />
                                Docker Environment
                            </h4>
                            {dockerStatus?.error_message && (
                                <Alert
                                    type="error"
                                    message="Docker Error"
                                    description={dockerStatus.error_message}
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                    action={
                                        <Button
                                            size="small"
                                            type="primary"
                                            href="https://www.docker.com/products/docker-desktop/"
                                            target="_blank"
                                        >
                                            Get Docker
                                        </Button>
                                    }
                                />
                            )}
                            <Descriptions bordered size="small" column={1}>
                                <Descriptions.Item label="Docker Daemon">
                                    {dockerStatus?.docker_available
                                        ? getStatusBadge(true, 'Running')
                                        : getStatusBadge(false, 'Not Available')}
                                </Descriptions.Item>
                                <Descriptions.Item label="R Image">
                                    {dockerStatus?.r_image_available ? (
                                        <>
                                            {getStatusBadge(true, 'Available')}
                                            {dockerStatus.r_image_name && (
                                                <Tag color="blue" style={{ marginLeft: 8 }}>
                                                    {dockerStatus.r_image_name}
                                                </Tag>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {getStatusBadge(false, 'Not Available')}
                                            <Button
                                                size="small"
                                                type="link"
                                                icon={<CloudDownloadOutlined />}
                                                onClick={async () => {
                                                    try {
                                                        await fetch('/api/v1/code-execution/pull-images', {
                                                            method: 'POST',
                                                        });
                                                        alert('Docker image pull started. This may take several minutes. Please check back later.');
                                                    } catch (error) {
                                                        alert('Failed to start image pull. Please try manually: docker pull rocker/tidyverse:latest');
                                                    }
                                                }}
                                            >
                                                Pull Image
                                            </Button>
                                        </>
                                    )}
                                </Descriptions.Item>
                                <Descriptions.Item label="SAS Image">
                                    {dockerStatus?.sas_image_available
                                        ? getStatusBadge(true, 'Available')
                                        : <Badge status="default" text={<span style={{ color: '#999' }}>Not Available (Optional)</span>} />}
                                </Descriptions.Item>
                            </Descriptions>
                        </Col>
                    </Row>

                    <Divider />

                    {/* R Versions */}
                    <Row gutter={16} style={{ marginBottom: 24 }}>
                        <Col span={24}>
                            <h4>
                                <CodeOutlined style={{ marginRight: 8 }} />
                                Available R Versions
                            </h4>
                            {rVersions.length > 0 ? (
                                <div>
                                    {rVersions.map((version) => (
                                        <Tag
                                            key={version.version}
                                            color={version.is_default ? 'blue' : 'default'}
                                            style={{ marginBottom: 8 }}
                                        >
                                            R {version.version}
                                            {version.is_default && ' (Default)'}
                                        </Tag>
                                    ))}
                                </div>
                            ) : (
                                <Alert
                                    type="warning"
                                    message="No R versions detected"
                                    description="Please ensure Docker images are pulled correctly."
                                    showIcon
                                />
                            )}
                        </Col>
                    </Row>

                    <Divider />

                    {/* Supported File Formats */}
                    <Row gutter={16} style={{ marginBottom: 24 }}>
                        <Col span={24}>
                            <h4>
                                <FileTextOutlined style={{ marginRight: 8 }} />
                                Supported Input File Formats
                            </h4>
                            <Descriptions bordered size="small" column={1}>
                                <Descriptions.Item label="R Scripts">
                                    <Tag color="green">.R</Tag>
                                    <Tag color="green">.r</Tag>
                                </Descriptions.Item>
                                <Descriptions.Item label="SDTM Datasets">
                                    <Tag color="blue">.csv</Tag>
                                    <Tag color="blue">.xpt</Tag>
                                    <Tag color="blue">.sas7bdat</Tag>
                                    <Tag color="blue">.txt</Tag>
                                </Descriptions.Item>
                                <Descriptions.Item label="Output Formats">
                                    <Tag color="purple">.csv</Tag>
                                    <Tag color="purple">.xlsx</Tag>
                                    <Tag color="purple">.png</Tag>
                                    <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>(plots)</span>
                                </Descriptions.Item>
                            </Descriptions>
                        </Col>
                    </Row>

                    {/* Troubleshooting Tips */}
                    {healthScore < 90 && (
                        <Alert
                            type="info"
                            message="Troubleshooting Tips"
                            description={
                                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                                    {!dockerStatus?.docker_available && (
                                        <li>
                                            <strong>Docker not running:</strong> Start Docker Desktop from your Start menu or system tray,
                                            then wait 30-60 seconds for it to initialize.
                                        </li>
                                    )}
                                    {dockerStatus?.docker_available && !dockerStatus?.r_image_available && (
                                        <li>
                                            <strong>R image not available:</strong> Click "Pull Image" above or run{' '}
                                            <code>docker pull rocker/tidyverse:latest</code> in your terminal.
                                        </li>
                                    )}
                                    {rVersions.length === 0 && (
                                        <li>
                                            <strong>No R versions detected:</strong> Ensure Docker images are pulled correctly.
                                            Refresh this panel after pulling images.
                                        </li>
                                    )}
                                </ul>
                            }
                            showIcon
                            icon={<InfoCircleOutlined />}
                        />
                    )}
                </>
            )}
        </Card>
    );
};

export default SystemHealthPanel;
