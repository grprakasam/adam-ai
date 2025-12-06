/**
 * Specification Selection Modal
 * 
 * Displayed when a study needs a specification file.
 * Allows users to:
 * - Select from existing specification files in the study
 * - Upload a new specification file
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    Modal,
    Select,
    Button,
    Space,
    Typography,
    Card,
    Tag,
    Alert,
    Spin,
    Upload,
    Tabs,
    Divider,
    message,
    Progress
} from 'antd';
import {
    FileExcelOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined,
    UploadOutlined,
    FolderOpenOutlined,
    CloudUploadOutlined,
    FileAddOutlined
} from '@ant-design/icons';
import type { UploadFile, RcFile } from 'antd/es/upload/interface';
import type { StudyDocument } from '../store/studyStore';
import { useStudyStore } from '../store/studyStore';
import { useProjectStore } from '../store/projectStore';
import { selectSpecificationDocument, clearStudySpecificData } from '../utils/studyDocumentSync';
import './SpecificationSelectionModal.css';

const { Text, Title, Paragraph } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

interface SpecificationSelectionModalProps {
    visible: boolean;
    studyId: string;
    specificationDocuments: StudyDocument[];
    onClose: () => void;
    onSelect?: (documentId: string, sheetName?: string) => void;
}

interface SheetInfo {
    name: string;
    variables_count?: number;
}

export const SpecificationSelectionModal: React.FC<SpecificationSelectionModalProps> = ({
    visible,
    studyId,
    specificationDocuments,
    onClose,
    onSelect
}) => {
    const [activeTab, setActiveTab] = useState<string>(specificationDocuments.length > 0 ? 'existing' : 'upload');
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
        specificationDocuments[0]?.id || null
    );
    const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
    const [availableSheets, setAvailableSheets] = useState<SheetInfo[]>([]);
    const [loadingSheets, setLoadingSheets] = useState(false);
    const [sheetsError, setSheetsError] = useState<string | null>(null);

    // Upload state
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadedFile, setUploadedFile] = useState<UploadFile | null>(null);
    const [uploadedDocument, setUploadedDocument] = useState<StudyDocument | null>(null);

    // Get uploadDocument function from studyStore
    const uploadDocument = useStudyStore((state) => state.uploadDocument);
    const loadStudyDocuments = useStudyStore((state) => state.loadStudyDocuments);
    const setSpecificationFile = useProjectStore((state) => state.setSpecificationFile);

    // Load sheets when a document is selected
    useEffect(() => {
        if (selectedDocumentId && activeTab === 'existing') {
            loadSheets(selectedDocumentId);
        }
    }, [selectedDocumentId, activeTab]);

    // Load sheets for uploaded document
    useEffect(() => {
        if (uploadedDocument && activeTab === 'upload') {
            loadSheetsForUploadedDocument(uploadedDocument);
        }
    }, [uploadedDocument, activeTab]);

    const loadSheets = async (documentId: string) => {
        setLoadingSheets(true);
        setSheetsError(null);
        setAvailableSheets([]);
        setSelectedSheet(null);

        try {
            const doc = specificationDocuments.find(d => d.id === documentId);
            if (!doc) {
                throw new Error('Document not found');
            }

            const response = await fetch(`/api/v1/specification/sheets?path=${encodeURIComponent(doc.storage_path)}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to load sheets: ${response.status}`);
            }

            const data = await response.json();
            const sheets: SheetInfo[] = data.sheets || [];

            setAvailableSheets(sheets);

            // Auto-select the first sheet that looks like a specification
            const specSheet = sheets.find(s =>
                s.name.toLowerCase().includes('spec') ||
                s.name.toLowerCase().includes('adam') ||
                s.name.toLowerCase().includes('adsl') ||
                s.name.toLowerCase().includes('adae')
            );
            setSelectedSheet(specSheet?.name || sheets[0]?.name || null);

        } catch (error: any) {
            console.error('Error loading sheets:', error);
            setSheetsError(error.message || 'Failed to load sheet information');
            setAvailableSheets([{ name: 'Sheet1' }]);
            setSelectedSheet('Sheet1');
        } finally {
            setLoadingSheets(false);
        }
    };

    const loadSheetsForUploadedDocument = async (doc: StudyDocument) => {
        setLoadingSheets(true);
        setSheetsError(null);
        setAvailableSheets([]);
        setSelectedSheet(null);

        try {
            const response = await fetch(`/api/v1/specification/sheets?path=${encodeURIComponent(doc.storage_path)}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to load sheets: ${response.status}`);
            }

            const data = await response.json();
            const sheets: SheetInfo[] = data.sheets || [];

            setAvailableSheets(sheets);

            const specSheet = sheets.find(s =>
                s.name.toLowerCase().includes('spec') ||
                s.name.toLowerCase().includes('adam') ||
                s.name.toLowerCase().includes('adsl') ||
                s.name.toLowerCase().includes('adae')
            );
            setSelectedSheet(specSheet?.name || sheets[0]?.name || null);

        } catch (error: any) {
            console.error('Error loading sheets for uploaded file:', error);
            setSheetsError(error.message || 'Failed to load sheet information');
            setAvailableSheets([{ name: 'Sheet1' }]);
            setSelectedSheet('Sheet1');
        } finally {
            setLoadingSheets(false);
        }
    };

    const handleUpload = async (file: RcFile): Promise<boolean> => {
        if (!studyId) {
            message.error('No study selected. Please select a study first.');
            return false;
        }

        // Validate file type
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        if (!isExcel) {
            message.error('Please upload an Excel file (.xlsx or .xls)');
            return false;
        }

        // Validate file size (max 50MB)
        const isLt50M = file.size / 1024 / 1024 < 50;
        if (!isLt50M) {
            message.error('File must be smaller than 50MB');
            return false;
        }

        setUploading(true);
        setUploadProgress(0);
        setUploadedFile({
            uid: file.uid,
            name: file.name,
            status: 'uploading',
            percent: 0,
        });

        try {
            // Simulate progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 200);

            // Upload the document
            const uploadedDoc = await uploadDocument(
                studyId,
                file,
                'SPECIFICATION',
                undefined,
                { source: 'specification_modal' },
                'Specification file uploaded via Specification Selection'
            );

            clearInterval(progressInterval);
            setUploadProgress(100);

            setUploadedFile({
                uid: file.uid,
                name: file.name,
                status: 'done',
                percent: 100,
            });

            setUploadedDocument(uploadedDoc);
            message.success(`${file.name} uploaded successfully!`);

            // Refresh study documents
            await loadStudyDocuments(studyId, true);

        } catch (error: any) {
            console.error('Upload error:', error);
            setUploadedFile({
                uid: file.uid,
                name: file.name,
                status: 'error',
                percent: 0,
            });
            message.error(`Upload failed: ${error.message || 'Unknown error'}`);
        } finally {
            setUploading(false);
        }

        return false; // Prevent default upload behavior
    };

    const handleConfirm = () => {
        // Clear old study-specific data
        clearStudySpecificData();

        if (activeTab === 'existing' && selectedDocumentId) {
            const doc = specificationDocuments.find(d => d.id === selectedDocumentId);
            if (doc) {
                // Set the specification file in projectStore
                setSpecificationFile({
                    name: doc.original_file_name,
                    path: doc.storage_path,
                    size: doc.size_bytes || 0,
                    uploadedAt: doc.uploaded_at,
                    isDefault: false,
                });

                if (onSelect) {
                    onSelect(selectedDocumentId, selectedSheet || undefined);
                }
            }
        } else if (activeTab === 'upload' && uploadedDocument) {
            // Set the uploaded document as the specification
            setSpecificationFile({
                name: uploadedDocument.original_file_name,
                path: uploadedDocument.storage_path,
                size: uploadedDocument.size_bytes || 0,
                uploadedAt: uploadedDocument.uploaded_at,
                isDefault: false,
            });

            if (onSelect) {
                onSelect(uploadedDocument.id, selectedSheet || undefined);
            }
        }

        onClose();
    };

    const selectedDocument = specificationDocuments.find(d => d.id === selectedDocumentId);
    const canConfirm = (activeTab === 'existing' && selectedDocumentId) ||
        (activeTab === 'upload' && uploadedDocument);

    const tabItems = [
        {
            key: 'existing',
            label: (
                <Space>
                    <FolderOpenOutlined />
                    <span>Study Documents</span>
                    {specificationDocuments.length > 0 && (
                        <Tag color="blue">{specificationDocuments.length}</Tag>
                    )}
                </Space>
            ),
            disabled: specificationDocuments.length === 0,
            children: (
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {specificationDocuments.length === 0 ? (
                        <Alert
                            type="info"
                            message="No specification files found in this study"
                            description="Upload a new specification file using the 'Upload New' tab."
                            showIcon
                        />
                    ) : (
                        <>
                            {/* File Selection */}
                            <div>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                    Select Specification File
                                </Text>
                                <Select
                                    style={{ width: '100%' }}
                                    value={selectedDocumentId}
                                    onChange={setSelectedDocumentId}
                                    placeholder="Select a specification file"
                                    size="large"
                                >
                                    {specificationDocuments.map(doc => (
                                        <Option key={doc.id} value={doc.id}>
                                            <Space>
                                                <FileExcelOutlined style={{ color: '#52c41a' }} />
                                                <span>{doc.original_file_name}</span>
                                                {doc.document_type === 'SPECIFICATION' && (
                                                    <Tag color="blue" style={{ marginLeft: 8 }}>SPEC</Tag>
                                                )}
                                            </Space>
                                        </Option>
                                    ))}
                                </Select>
                            </div>

                            {/* Sheet Selection */}
                            <div>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                    Select Sheet
                                </Text>
                                {loadingSheets ? (
                                    <div style={{ textAlign: 'center', padding: '20px' }}>
                                        <Spin size="small" />
                                        <Text type="secondary" style={{ marginLeft: 8 }}>Loading sheets...</Text>
                                    </div>
                                ) : sheetsError ? (
                                    <Alert
                                        type="warning"
                                        message={sheetsError}
                                        description="Using default sheet. You can change this later."
                                        style={{ marginBottom: 8 }}
                                    />
                                ) : null}

                                <Select
                                    style={{ width: '100%' }}
                                    value={selectedSheet}
                                    onChange={setSelectedSheet}
                                    placeholder="Select a sheet"
                                    disabled={loadingSheets}
                                    loading={loadingSheets}
                                    size="large"
                                >
                                    {availableSheets.map(sheet => (
                                        <Option key={sheet.name} value={sheet.name}>
                                            <Space>
                                                <span>{sheet.name}</span>
                                                {sheet.variables_count !== undefined && sheet.variables_count > 0 && (
                                                    <Tag color="green">{sheet.variables_count} rows</Tag>
                                                )}
                                            </Space>
                                        </Option>
                                    ))}
                                </Select>
                            </div>

                            {/* Selected File Info */}
                            {selectedDocument && (
                                <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
                                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                        <Space>
                                            <FileExcelOutlined style={{ color: '#52c41a', fontSize: 24 }} />
                                            <div>
                                                <Text strong>{selectedDocument.original_file_name}</Text>
                                                {selectedSheet && (
                                                    <Text type="secondary" style={{ marginLeft: 8 }}>
                                                        Sheet: {selectedSheet}
                                                    </Text>
                                                )}
                                            </div>
                                        </Space>
                                        {selectedDocument.size_bytes && (
                                            <Text type="secondary">
                                                Size: {(selectedDocument.size_bytes / 1024).toFixed(1)} KB
                                            </Text>
                                        )}
                                    </Space>
                                </Card>
                            )}
                        </>
                    )}
                </Space>
            ),
        },
        {
            key: 'upload',
            label: (
                <Space>
                    <CloudUploadOutlined />
                    <span>Upload New</span>
                </Space>
            ),
            children: (
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {/* Upload Area */}
                    <Dragger
                        accept=".xlsx,.xls"
                        beforeUpload={handleUpload}
                        fileList={uploadedFile ? [uploadedFile] : []}
                        disabled={uploading}
                        maxCount={1}
                        onRemove={() => {
                            setUploadedFile(null);
                            setUploadedDocument(null);
                            setAvailableSheets([]);
                            setSelectedSheet(null);
                        }}
                    >
                        <p className="ant-upload-drag-icon">
                            <FileAddOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                        </p>
                        <p className="ant-upload-text">
                            Click or drag Excel file to upload
                        </p>
                        <p className="ant-upload-hint">
                            Support for .xlsx and .xls files up to 50MB
                        </p>
                    </Dragger>

                    {/* Upload Progress */}
                    {uploading && (
                        <div style={{ textAlign: 'center' }}>
                            <Progress percent={uploadProgress} status="active" />
                            <Text type="secondary">Uploading specification file...</Text>
                        </div>
                    )}

                    {/* Sheet Selection for Uploaded File */}
                    {uploadedDocument && !uploading && (
                        <>
                            <Alert
                                type="success"
                                message="File uploaded successfully!"
                                description={`${uploadedDocument.original_file_name} is ready to use.`}
                                showIcon
                                icon={<CheckCircleOutlined />}
                            />

                            <div>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                    Select Sheet
                                </Text>
                                {loadingSheets ? (
                                    <div style={{ textAlign: 'center', padding: '20px' }}>
                                        <Spin size="small" />
                                        <Text type="secondary" style={{ marginLeft: 8 }}>Loading sheets...</Text>
                                    </div>
                                ) : (
                                    <Select
                                        style={{ width: '100%' }}
                                        value={selectedSheet}
                                        onChange={setSelectedSheet}
                                        placeholder="Select a sheet"
                                        disabled={loadingSheets}
                                        loading={loadingSheets}
                                        size="large"
                                    >
                                        {availableSheets.map(sheet => (
                                            <Option key={sheet.name} value={sheet.name}>
                                                <Space>
                                                    <span>{sheet.name}</span>
                                                    {sheet.variables_count !== undefined && sheet.variables_count > 0 && (
                                                        <Tag color="green">{sheet.variables_count} rows</Tag>
                                                    )}
                                                </Space>
                                            </Option>
                                        ))}
                                    </Select>
                                )}
                            </div>
                        </>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Modal
            title={
                <Space>
                    <FileExcelOutlined style={{ color: '#1890ff', fontSize: 20 }} />
                    <span style={{ fontSize: 18 }}>Select Specification File</span>
                </Space>
            }
            open={visible}
            onCancel={onClose}
            footer={[
                <Button key="cancel" onClick={onClose} size="large">
                    Cancel
                </Button>,
                <Button
                    key="confirm"
                    type="primary"
                    onClick={handleConfirm}
                    disabled={!canConfirm}
                    icon={<CheckCircleOutlined />}
                    size="large"
                >
                    Use Selected Specification
                </Button>
            ]}
            width={650}
            centered
            className="specification-selection-modal"
        >
            <Alert
                type="info"
                message="Choose Your Specification File"
                description="Select an existing specification file from your study documents, or upload a new one. The specification file is used to categorize variables and generate traceability."
                showIcon
                icon={<InfoCircleOutlined />}
                style={{ marginBottom: 20 }}
            />

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
                size="large"
            />
        </Modal>
    );
};

export default SpecificationSelectionModal;
