
import React from 'react';
import { Card, Table, Tag, Button, Empty, Typography, Space } from 'antd';
import { DownloadOutlined, DatabaseOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface AdamGenerationResultsProps {
    result: any | null;
}

export const AdamGenerationResults: React.FC<AdamGenerationResultsProps> = ({ result }) => {

    if (!result) {
        return (
            <Empty
                description="No results available yet. Run the execution to generate ADAM datasets."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
        );
    }

    const { run_id, execution_duration, output, preview, file_paths } = result;

    const handleDownload = (format: string) => {
        // Logic for download would typically use file_paths or an API endpoint
        // For now we just mock or use the API logic if passed
        console.log(`Downloading ${format} for run ${run_id}`);
    };

    return (
        <div className="adam-results">
            <Space direction="vertical" style={{ width: '100%' }} size="large">

                {/* Run Summary */}
                <Card size="small" title="Execution Summary">
                    <Space size="large">
                        <Text>Run ID: <Text code>{run_id}</Text></Text>
                        <Text>Duration: <Text strong>{execution_duration?.toFixed(2)}s</Text></Text>
                        <Tag color="success" icon={<CheckCircleOutlined />}>Success</Tag>
                    </Space>
                </Card>

                {/* Generated Objects */}
                {output?.data_frames && (
                    <Card size="small" title="Generated Dataframes">
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            {output.data_frames.map((df: any) => (
                                <Card key={df.name} type="inner" size="small" style={{ width: 200 }}>
                                    <DatabaseOutlined style={{ fontSize: 24, color: '#1890ff', marginBottom: 8 }} />
                                    <div style={{ fontWeight: 'bold' }}>{df.name}</div>
                                    <div>{df.rows} rows, {df.columns} cols</div>
                                </Card>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Preview */}
                {preview?.rows && (
                    <Card
                        size="small"
                        title={`Preview: ${preview.name || 'Output'}`}
                        extra={
                            <Space>
                                <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload('csv')}>CSV</Button>
                                <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload('xpt')}>XPT</Button>
                            </Space>
                        }
                    >
                        <Table
                            dataSource={preview.rows.map((r: any, i: number) => ({ ...r, key: i }))}
                            columns={preview.columns.map((col: string) => ({
                                title: col,
                                dataIndex: col,
                                key: col,
                                ellipsis: true,
                                width: 150,
                                render: (text: any) => <span style={{ fontSize: 12 }}>{String(text)}</span>
                            }))}
                            scroll={{ x: 'max-content' }}
                            size="small"
                            pagination={{ pageSize: 10 }}
                        />
                    </Card>
                )}
            </Space>
        </div>
    );
};
