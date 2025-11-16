import React, { useState } from 'react';
import {
  Modal,
  Upload,
  Form,
  Input,
  message,
  Progress,
  Space,
  Typography,
} from 'antd';
import {
  InboxOutlined,
  FileExcelOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { UploadFile, RcFile } from 'antd/es/upload/interface';
import { adamApi } from '../services/api';

const { Dragger } = Upload;
const { Text } = Typography;
const { TextArea } = Input;

interface DatasetUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId?: string;
}

export const DatasetUploadModal: React.FC<DatasetUploadModalProps> = ({
  visible,
  onClose,
  onSuccess,
  projectId,
}) => {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Allowed file extensions
  const allowedExtensions = ['.xpt', '.sas7bdat', '.csv', '.txt'];

  // Validate file type
  const beforeUpload = (file: RcFile): boolean => {
    const fileName = file.name.toLowerCase();
    const isValidType = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValidType) {
      message.error(
        `${file.name} is not a valid file type. Only ${allowedExtensions.join(', ')} files are allowed.`
      );
      return false;
    }

    // Check file size (max 100MB)
    const isLt100M = file.size / 1024 / 1024 < 100;
    if (!isLt100M) {
      message.error('File must be smaller than 100MB!');
      return false;
    }

    return false; // Prevent auto upload
  };

  // Handle file list changes
  const handleChange = (info: any) => {
    let newFileList = [...info.fileList];

    // Filter out invalid files
    newFileList = newFileList.filter((file) => {
      if (file.status === 'error') {
        return false;
      }
      return true;
    });

    setFileList(newFileList);
  };

  // Remove file from list
  const handleRemove = (file: UploadFile) => {
    const index = fileList.indexOf(file);
    const newFileList = fileList.slice();
    newFileList.splice(index, 1);
    setFileList(newFileList);
  };

  // Upload dataset
  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.error('Please select at least one file to upload');
      return;
    }

    try {
      await form.validateFields();
      const values = form.getFieldsValue();

      setUploading(true);
      setUploadProgress(0);

      // Convert fileList to File objects
      const files = fileList.map((file) => file.originFileObj as File);

      // Simulate progress (API doesn't provide progress callback)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await adamApi.uploadTestDataset(
        files,
        values.name,
        values.description,
        projectId
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      message.success(
        `Dataset "${values.name}" uploaded successfully with ${files.length} file(s)`
      );

      // Reset form and close modal
      setTimeout(() => {
        form.resetFields();
        setFileList([]);
        setUploadProgress(0);
        setUploading(false);
        onSuccess();
        onClose();
      }, 1000);
    } catch (error: any) {
      setUploading(false);
      setUploadProgress(0);
      
      if (error.response?.data?.detail) {
        message.error(error.response.data.detail);
      } else {
        message.error('Failed to upload dataset. Please try again.');
      }
    }
  };

  // Handle modal cancel
  const handleCancel = () => {
    if (uploading) {
      message.warning('Upload in progress. Please wait...');
      return;
    }
    form.resetFields();
    setFileList([]);
    setUploadProgress(0);
    onClose();
  };

  // Get file icon based on extension
  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.xpt') || fileName.endsWith('.sas7bdat')) {
      return <FileExcelOutlined style={{ color: '#1890ff' }} />;
    }
    return <FileExcelOutlined style={{ color: '#52c41a' }} />;
  };

  return (
    <Modal
      title={
        <Space>
          <InboxOutlined />
          <span>Upload Test Dataset</span>
        </Space>
      }
      open={visible}
      onOk={handleUpload}
      onCancel={handleCancel}
      okText="Upload"
      cancelText="Cancel"
      width={600}
      confirmLoading={uploading}
      maskClosable={!uploading}
      className="dataset-upload-modal"
      aria-labelledby="dataset-upload-title"
      aria-describedby="dataset-upload-description"
    >
      <div id="dataset-upload-description" style={{ marginBottom: 16, color: '#666' }}>
        Upload SDTM datasets for validation and testing. Files are stored securely and can be reused across sessions.
        All uploads are logged for audit trail compliance.
      </div>
      
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="Dataset Name"
          rules={[
            { required: true, message: 'Dataset name is required for identification and traceability' },
            {
              pattern: /^[a-zA-Z0-9_-]+$/,
              message: 'Only letters, numbers, hyphens, and underscores allowed (no spaces or special characters)',
            },
            {
              min: 3,
              message: 'Dataset name must be at least 3 characters for clarity',
            },
            {
              max: 50,
              message: 'Dataset name must not exceed 50 characters',
            },
          ]}
          tooltip="Use a descriptive name like PHASE3_STUDY123 or PILOT_BASELINE_DATA"
          extra="This name will be used to identify the dataset in the selector. Use meaningful names for easy reference."
        >
          <Input
            placeholder="e.g., PHASE3_STUDY123"
            disabled={uploading}
            aria-label="Dataset name input"
            aria-required="true"
            aria-describedby="dataset-name-help"
          />
        </Form.Item>

        <Form.Item 
          name="description" 
          label="Description (Optional but Recommended)"
          tooltip="Provide context about the dataset contents, study phase, or data source"
          extra="A clear description helps team members understand the dataset purpose and provenance."
        >
          <TextArea
            rows={3}
            placeholder="e.g., Phase 3 SDTM datasets for Study ABC-123, includes DM, VS, AE domains from database lock 2024-11-15"
            disabled={uploading}
            aria-label="Dataset description input"
            maxLength={500}
            showCount
          />
        </Form.Item>

        <Form.Item 
          label="Dataset Files"
          required
          tooltip="Upload SDTM dataset files. Supported formats ensure compatibility with R and SAS analysis tools."
          extra={
            <div style={{ marginTop: 8 }}>
              <div><strong>Supported formats:</strong> XPT (SAS Transport), SAS7BDAT (SAS), CSV, TXT</div>
              <div><strong>File size limit:</strong> 100MB per file</div>
              <div><strong>Security:</strong> Files are stored in isolated directories with integrity checksums</div>
            </div>
          }
        >
          <Dragger
            multiple
            fileList={fileList}
            beforeUpload={beforeUpload}
            onChange={handleChange}
            onRemove={handleRemove}
            disabled={uploading}
            showUploadList={{
              showRemoveIcon: !uploading,
              removeIcon: <DeleteOutlined aria-label="Remove file" />,
            }}
            aria-label="File upload drag and drop area"
          >
            <p className="ant-upload-drag-icon" aria-hidden="true">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              Click or drag SDTM dataset files to this area
            </p>
            <p className="ant-upload-hint">
              <strong>Supported formats:</strong> {allowedExtensions.join(', ')}
            </p>
            <p className="ant-upload-hint" style={{ fontSize: '12px', color: '#999' }}>
              Maximum file size: 100MB per file • Multiple files supported
            </p>
            <p className="ant-upload-hint" style={{ fontSize: '11px', color: '#666', marginTop: 8 }}>
              <strong>Keyboard users:</strong> Press Enter or Space to open file picker
            </p>
          </Dragger>
        </Form.Item>

        {fileList.length > 0 && (
          <div style={{ marginTop: 16 }} role="region" aria-label="Selected files list">
            <Text strong>Selected Files ({fileList.length}):</Text>
            <div style={{ fontSize: '12px', color: '#666', marginTop: 4, marginBottom: 8 }}>
              Review files before upload. Remove any incorrect files using the delete icon.
            </div>
            <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
              {fileList.map((file, index) => (
                <div
                  key={file.uid}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: '#f5f5f5',
                    borderRadius: '4px',
                    border: '1px solid #d9d9d9',
                  }}
                  role="listitem"
                  aria-label={`File ${index + 1}: ${file.name}, Size: ${((file.size || 0) / 1024).toFixed(2)} KB`}
                >
                  <Space>
                    {getFileIcon(file.name)}
                    <div>
                      <Text style={{ display: 'block' }}>{file.name}</Text>
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        Size: {((file.size || 0) / 1024).toFixed(2)} KB • 
                        Format: {file.name.split('.').pop()?.toUpperCase()}
                      </Text>
                    </div>
                  </Space>
                  {uploading ? (
                    <CheckCircleOutlined 
                      style={{ color: '#52c41a' }} 
                      aria-label="File uploaded successfully"
                    />
                  ) : null}
                </div>
              ))}
            </Space>
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#e6f7ff', borderRadius: '4px', fontSize: '12px' }}>
              <strong>Total:</strong> {fileList.length} file{fileList.length !== 1 ? 's' : ''} • 
              {(fileList.reduce((sum, f) => sum + (f.size || 0), 0) / (1024 * 1024)).toFixed(2)} MB
            </div>
          </div>
        )}

        {uploading && (
          <div style={{ marginTop: 16 }} role="status" aria-live="polite" aria-label="Upload progress">
            <Text>Uploading files... Please wait and do not close this window.</Text>
            <Progress 
              percent={uploadProgress} 
              status="active" 
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              aria-label={`Upload progress: ${uploadProgress}%`}
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
              Files are being uploaded and integrity checksums are being calculated for audit trail compliance.
            </div>
          </div>
        )}
      </Form>
    </Modal>
  );
};
