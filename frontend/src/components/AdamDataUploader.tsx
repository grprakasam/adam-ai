
import React, { useCallback, useRef } from 'react';
import { Card, Button, Table, Space, Tag, Typography, message } from 'antd';
import { UploadOutlined, DeleteOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';

const { Text } = Typography;

export interface UploadedSdtmFile {
    id: string;
    name: string;
    size: number;
    format: string;
    domain: string;
    status: 'uploading' | 'success' | 'error';
    file: File;
}

interface AdamDataUploaderProps {
    uploadedFiles: UploadedSdtmFile[];
    setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedSdtmFile[]>>;
    onUploadStart: () => void;
    onUploadEnd: () => void;
}

export const AdamDataUploader: React.FC<AdamDataUploaderProps> = ({
    uploadedFiles,
    setUploadedFiles,
    onUploadStart,
    onUploadEnd
}) => {
    const { projectConfig } = useProjectStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Helper function to extract domain from filename
    const extractDomainFromFilename = (filename: string): string => {
        const cleanName = filename.toLowerCase().replace(/\.(csv|xpt|sas7bdat|rds|xlsx?)$/i, '');
        const parts = cleanName.split(/[_\-\.]/);
        const lastPart = parts[parts.length - 1].toUpperCase();

        const sdtmDomains = ['DM', 'AE', 'CM', 'EX', 'LB', 'MH', 'VS', 'EG', 'DS', 'SV', 'SC', 'QS', 'FA', 'RP', 'TU', 'TR', 'RS', 'SU', 'PE', 'DA', 'MB', 'MS', 'MI', 'PC', 'PP', 'IS', 'TI', 'TA', 'TV', 'TS', 'TE', 'SE'];

        if (sdtmDomains.includes(lastPart)) {
            return lastPart;
        }
        for (const part of parts) {
            const upperPart = part.toUpperCase();
            if (sdtmDomains.includes(upperPart)) {
                return upperPart;
            }
        }
        return lastPart || 'UNKNOWN';
    };

    const getFileFormat = (filename: string): string => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const formatMap: Record<string, string> = {
            'csv': 'CSV',
            'xpt': 'XPT (SAS Transport)',
            'sas7bdat': 'SAS7BDAT',
            'rds': 'RDS (R Data)',
            'xlsx': 'Excel',
            'xls': 'Excel',
        };
        return formatMap[ext] || ext.toUpperCase();
    };

    const handleBrowseFiles = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        if (!projectConfig.studyId) {
            message.warning('Please select a study first');
            return;
        }

        onUploadStart();

        const newFiles: UploadedSdtmFile[] = Array.from(files).map((file) => ({
            id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            size: file.size,
            format: getFileFormat(file.name),
            domain: extractDomainFromFilename(file.name),
            status: 'success' as const,
            file: file,
        }));

        setUploadedFiles(prev => [...prev, ...newFiles]);
        message.success(`Loaded ${files.length} SDTM dataset(s): ${newFiles.map(f => f.domain).join(', ')}`);

        try {
            await adamApi.uploadSdtmFiles(projectConfig.studyId, Array.from(files));
        } catch (err: any) {
            console.log('Backend upload not available, using local files for code generation');
        } finally {
            onUploadEnd();
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [projectConfig.studyId, onUploadStart, onUploadEnd, setUploadedFiles]);

    const handleRemoveFile = useCallback((fileId: string) => {
        setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    }, [setUploadedFiles]);

    const handleClearAll = useCallback(() => {
        setUploadedFiles([]);
    }, [setUploadedFiles]);

    return (
        <div className="adam-uploader">
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                multiple
                accept=".csv,.xpt,.sas7bdat,.rds,.xlsx,.xls"
                onChange={handleFileSelect}
            />

            <Card
                size="small"
                style={{ marginBottom: '16px' }}
                title={
                    <Space>
                        <UploadOutlined style={{ color: '#667eea' }} />
                        <span>Upload SDTM Datasets</span>
                    </Space>
                }
                extra={
                    uploadedFiles.length > 0 && (
                        <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={handleClearAll}
                        >
                            Clear All
                        </Button>
                    )
                }
            >
                <div
                    style={{
                        border: '2px dashed #d9d9d9',
                        borderRadius: '8px',
                        padding: '24px',
                        textAlign: 'center',
                        marginBottom: uploadedFiles.length > 0 ? '16px' : 0,
                        background: '#fafafa',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                    }}
                    onClick={handleBrowseFiles}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const files = e.dataTransfer.files;
                        if (files.length > 0 && fileInputRef.current) {
                            const dataTransfer = new DataTransfer();
                            Array.from(files).forEach(file => dataTransfer.items.add(file));
                            fileInputRef.current.files = dataTransfer.files;
                            fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }}
                >
                    <UploadOutlined style={{ fontSize: '32px', color: '#667eea', marginBottom: '12px' }} />
                    <div style={{ marginBottom: '8px' }}>
                        <Text strong style={{ color: '#333' }}>Click to browse or drag SDTM files here</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                        Supports: CSV, XPT (SAS Transport), SAS7BDAT, RDS (R Data), Excel
                    </Text>
                </div>

                {uploadedFiles.length > 0 && (
                    <Table
                        dataSource={uploadedFiles}
                        rowKey="id"
                        size="small"
                        pagination={false}
                        columns={[
                            {
                                title: 'Domain',
                                dataIndex: 'domain',
                                key: 'domain',
                                width: 80,
                                render: (domain: string) => (
                                    <Tag color="blue" style={{ fontWeight: 600 }}>{domain}</Tag>
                                ),
                            },
                            {
                                title: 'File Name',
                                dataIndex: 'name',
                                key: 'name',
                                ellipsis: true,
                                render: (name: string) => (
                                    <Space>
                                        <FileExcelOutlined style={{ color: '#52c41a' }} />
                                        <span>{name}</span>
                                    </Space>
                                ),
                            },
                            {
                                title: 'Size',
                                dataIndex: 'size',
                                key: 'size',
                                width: 100,
                                render: (size: number) => {
                                    if (size < 1024) return `${size} B`;
                                    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
                                    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
                                },
                            },
                            {
                                title: 'Action',
                                key: 'action',
                                width: 60,
                                render: (_, record) => (
                                    <Button
                                        type="text"
                                        size="small"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => handleRemoveFile(record.id)}
                                    />
                                ),
                            },
                        ]}
                    />
                )}
            </Card>
        </div>
    );
};
