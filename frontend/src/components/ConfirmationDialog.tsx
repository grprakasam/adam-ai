/**
 * Confirmation Dialog Component
 * Reusable confirmation dialog for destructive actions
 */

import React from 'react';
import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

export interface ConfirmationDialogProps {
  title: string;
  message: string;
  okText?: string;
  cancelText?: string;
  okType?: 'primary' | 'danger';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * Show a confirmation dialog
 * Returns a promise that resolves when user confirms or rejects
 */
export const showConfirmation = ({
  title,
  message,
  okText = 'Confirm',
  cancelText = 'Cancel',
  okType = 'primary',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps): Promise<boolean> => {
  return new Promise((resolve) => {
    Modal.confirm({
      title,
      icon: <ExclamationCircleOutlined />,
      content: message,
      okText,
      cancelText,
      okType,
      onOk: async () => {
        try {
          await onConfirm();
          resolve(true);
        } catch (error) {
          console.error('Error during confirmation action:', error);
          resolve(false);
        }
      },
      onCancel: () => {
        if (onCancel) {
          onCancel();
        }
        resolve(false);
      },
    });
  });
};

/**
 * Show a destructive action confirmation
 * Pre-configured for destructive operations
 */
export const showDestructiveConfirmation = (
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
  okText: string = 'Delete'
): Promise<boolean> => {
  return showConfirmation({
    title,
    message,
    okText,
    okType: 'danger',
    onConfirm,
  });
};

/**
 * Show confirmation before navigation that might lose data
 */
export const showNavigationConfirmation = (
  onConfirm: () => void | Promise<void>,
  customMessage?: string
): Promise<boolean> => {
  return showConfirmation({
    title: 'Unsaved Changes',
    message: customMessage || 'You have unsaved changes. Are you sure you want to leave?',
    okText: 'Leave',
    cancelText: 'Stay',
    okType: 'danger',
    onConfirm,
  });
};

/**
 * Show confirmation for clearing/resetting data
 */
export const showClearConfirmation = (
  dataType: string,
  onConfirm: () => void | Promise<void>
): Promise<boolean> => {
  return showDestructiveConfirmation(
    `Clear ${dataType}?`,
    `Are you sure you want to clear all ${dataType}? This action cannot be undone.`,
    onConfirm,
    'Clear'
  );
};

/**
 * Show confirmation for file upload that might overwrite existing data
 */
export const showFileUploadConfirmation = (
  fileName: string,
  onConfirm: () => void | Promise<void>
): Promise<boolean> => {
  return showConfirmation({
    title: 'Upload New File?',
    message: `Uploading "${fileName}" will replace the current specification. Do you want to continue?`,
    okText: 'Upload',
    okType: 'primary',
    onConfirm,
  });
};

/**
 * Show confirmation for regenerating code
 */
export const showRegenerateConfirmation = (
  onConfirm: () => void | Promise<void>
): Promise<boolean> => {
  return showConfirmation({
    title: 'Regenerate Code?',
    message: 'This will regenerate all code and overwrite existing generated code. Do you want to continue?',
    okText: 'Regenerate',
    okType: 'primary',
    onConfirm,
  });
};

/**
 * Functional component wrapper for imperative usage
 */
interface ConfirmationDialogComponentProps extends ConfirmationDialogProps {
  visible: boolean;
  onClose: () => void;
}

export const ConfirmationDialogComponent: React.FC<ConfirmationDialogComponentProps> = ({
  visible,
  title,
  message,
  okText = 'Confirm',
  cancelText = 'Cancel',
  okType = 'primary',
  onConfirm,
  onCancel,
  onClose,
}) => {
  const handleOk = async () => {
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error during confirmation action:', error);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  return (
    <Modal
      open={visible}
      title={title}
      okText={okText}
      cancelText={cancelText}
      okType={okType}
      onOk={handleOk}
      onCancel={handleCancel}
      icon={<ExclamationCircleOutlined />}
    >
      <p>{message}</p>
    </Modal>
  );
};

export default {
  showConfirmation,
  showDestructiveConfirmation,
  showNavigationConfirmation,
  showClearConfirmation,
  showFileUploadConfirmation,
  showRegenerateConfirmation,
  ConfirmationDialogComponent,
};
