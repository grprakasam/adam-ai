
import React, { useEffect } from 'react';
import { Card, Progress, Steps, List, Typography, Alert, Empty } from 'antd';
import {
    CheckCircleOutlined,
    LoadingOutlined,
    CloseCircleOutlined,
    ConsoleSqlOutlined
} from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';

const { Text, Paragraph } = Typography;

export const AdamExecutionMonitor: React.FC = () => {
    const { adamExecution, setAdamExecution } = useProjectStore();
    const { runId, status, progress, logs, error } = adamExecution;

    // Poll status if running
    useEffect(() => {
        let pollInterval: NodeJS.Timeout;

        if (status === 'running' && runId) {
            pollInterval = setInterval(async () => {
                try {
                    const runStatus = await adamApi.getAdamGenerationStatus(runId);

                    setAdamExecution({
                        status: runStatus.status as any,
                        progress: runStatus.progress_percent,
                        logs: [...(adamExecution.logs || []), ...(runStatus.current_step ? [`[${new Date().toLocaleTimeString()}] ${runStatus.current_step}`] : [])]
                    });

                    if (runStatus.status === 'succeeded' || runStatus.status === 'failed') {
                        // Fetch result if succeeded
                        if (runStatus.status === 'succeeded') {
                            try {
                                const result = await adamApi.getAdamGenerationResult(runId);
                                setAdamExecution({ result });
                            } catch (e) {
                                console.error("Failed to fetch result", e);
                            }
                        }
                        if (runStatus.status === 'failed') {
                            setAdamExecution({ error: runStatus.error_message || 'Execution Failed' });
                        }
                        clearInterval(pollInterval);
                    }
                } catch (e) {
                    console.error("Poll failed", e);
                }
            }, 5000); // Poll every 5 seconds
        }

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [status, runId, setAdamExecution]);

    if (status === 'idle') {
        return (
            <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Ready to execute. Click 'Run Execution' to start."
            />
        );
    }

    return (
        <div className="execution-monitor">
            <Card title="Execution Status" size="small" style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 24, padding: '0 16px' }}>
                    <Progress
                        percent={progress}
                        status={status === 'failed' ? 'exception' : status === 'succeeded' ? 'success' : 'active'}
                        strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                    />
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                        <Text strong>{status === 'running' ? 'Running...' : status.toUpperCase()}</Text>
                    </div>
                </div>

                {error && (
                    <Alert
                        message="Execution Error"
                        description={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}

                <div className="execution-logs" style={{
                    background: '#1e1e1e',
                    borderRadius: '8px',
                    padding: '12px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    fontFamily: 'Consolas, Monaco, monospace'
                }}>
                    <List
                        size="small"
                        dataSource={logs}
                        renderItem={log => (
                            <List.Item style={{ padding: '4px 0', border: 'none' }}>
                                <Text style={{ color: '#d4d4d4', fontSize: '12px' }}>{log}</Text>
                            </List.Item>
                        )}
                    />
                </div>
            </Card>
        </div>
    );
};
