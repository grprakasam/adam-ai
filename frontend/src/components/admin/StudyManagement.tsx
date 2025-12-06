/**
 * StudyManagement Component
 * Admin panel for managing studies - list, delete, bulk operations
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    Table,
    Button,
    Space,
    Input,
    Modal,
    message,
    Tag,
    Tooltip,
    Popconfirm,
    Typography,
    Card,
    Tabs,
    Badge,
    Alert,
} from 'antd';
import {
    DeleteOutlined,
    SearchOutlined,
    ReloadOutlined,
    ExclamationCircleOutlined,
    RestOutlined,
    UndoOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Text } = Typography;
const { TabPane } = Tabs;

interface Study {
    id: string;
    name: string;
    phase?: string;
    therapeutic_area?: string;
    sponsor?: string;
    created_at: string;
    updated_at?: string;
    deleted_at?: string;
    is_deleted: boolean;
    document_count?: number;
    owner_id?: string;
}

interface DeleteConfirmModalProps {
    visible: boolean;
    study: Study | null;
    onConfirm: (studyName: string) => void;
    onCancel: () => void;
    loading: boolean;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
    visible,
    study,
    onConfirm,
    onCancel,
    loading,
}) => {
    const [confirmText, setConfirmText] = useState('');
    const isMatch = confirmText.toLowerCase() === study?.name?.toLowerCase();

    useEffect(() => {
        if (!visible) setConfirmText('');
    }, [visible]);

    return (
        <Modal
            title={
                <Space>
                    <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                    <span>Permanently Delete Study</span>
                </Space>
            }
            open={visible}
            onCancel={onCancel}
            footer={[
                <Button key="cancel" onClick={onCancel}>
                    Cancel
                </Button>,
                <Button
                    key="delete"
                    type="primary"
                    danger
                    loading={loading}
                    disabled={!isMatch}
                    onClick={() => onConfirm(confirmText)}
                >
                    Delete Permanently
                </Button>,
            ]}
        >
            <Alert
                type="error"
                message="This action cannot be undone!"
                description="All study data, documents, and associated records will be permanently deleted."
                style={{ marginBottom: 16 }}
                showIcon
                icon={<WarningOutlined />}
            />

            {study && (
                <div style={{ marginBottom: 16 }}>
                    <Text strong>Study Details:</Text>
                    <div style={{ marginTop: 8, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                        <div><Text type="secondary">ID:</Text> {study.id}</div>
                        <div><Text type="secondary">Name:</Text> {study.name}</div>
                        <div><Text type="secondary">Phase:</Text> {study.phase || 'N/A'}</div>
                        <div><Text type="secondary">Documents:</Text> {study.document_count || 0}</div>
                    </div>
                </div>
            )}

            <div>
                <Text>To confirm, type the study name: <Text strong>{study?.name}</Text></Text>
                <Input
                    style={{ marginTop: 8 }}
                    placeholder="Type study name to confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    status={confirmText && !isMatch ? 'error' : undefined}
                />
                {confirmText && !isMatch && (
                    <Text type="danger" style={{ fontSize: 12 }}>
                        Name doesn't match
                    </Text>
                )}
            </div>
        </Modal>
    );
};

export const StudyManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'all' | 'trash'>('all');
    const [studies, setStudies] = useState<Study[]>([]);
    const [trashStudies, setTrashStudies] = useState<Study[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [studyToDelete, setStudyToDelete] = useState<Study | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [totalStudies, setTotalStudies] = useState(0);
    const [totalTrash, setTotalTrash] = useState(0);

    const getAuthHeaders = () => ({
        Authorization: `Bearer ${localStorage.getItem('adam_access_token') || ''}`,
    });

    const fetchStudies = useCallback(async () => {
        setLoading(true);
        try {
            const baseUrl = import.meta.env.VITE_API_URL || '';
            const response = await axios.get(`${baseUrl}/api/v1/admin/studies`, {
                params: { search: searchText || undefined, include_deleted: false },
                headers: getAuthHeaders(),
            });
            setStudies(response.data.studies || []);
            setTotalStudies(response.data.total || 0);
        } catch (error: any) {
            message.error(error.response?.data?.detail || 'Failed to fetch studies');
        } finally {
            setLoading(false);
        }
    }, [searchText]);

    const fetchTrashStudies = useCallback(async () => {
        setLoading(true);
        try {
            const baseUrl = import.meta.env.VITE_API_URL || '';
            const response = await axios.get(`${baseUrl}/api/v1/admin/studies/trash`, {
                headers: getAuthHeaders(),
            });
            setTrashStudies(response.data.studies || []);
            setTotalTrash(response.data.total || 0);
        } catch (error: any) {
            console.error('Failed to fetch trash:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStudies();
        fetchTrashStudies();
    }, [fetchStudies, fetchTrashStudies]);

    const handleSoftDelete = async (studyId: string) => {
        try {
            const baseUrl = import.meta.env.VITE_API_URL || '';
            await axios.delete(`${baseUrl}/api/v1/studies/${studyId}`, {
                headers: getAuthHeaders(),
            });
            message.success('Study moved to trash');
            fetchStudies();
            fetchTrashStudies();
        } catch (error: any) {
            message.error(error.response?.data?.detail || 'Failed to delete study');
        }
    };

    const handleHardDelete = async (_studyName: string) => {
        if (!studyToDelete) return;

        setDeleteLoading(true);
        try {
            const baseUrl = import.meta.env.VITE_API_URL || '';
            await axios.delete(`${baseUrl}/api/v1/admin/studies/${studyToDelete.id}/hard`, {
                headers: getAuthHeaders(),
            });
            message.success('Study permanently deleted');
            setDeleteModalVisible(false);
            setStudyToDelete(null);
            fetchStudies();
            fetchTrashStudies();
        } catch (error: any) {
            message.error(error.response?.data?.detail || 'Failed to delete study');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleRestore = async (studyId: string) => {
        try {
            const baseUrl = import.meta.env.VITE_API_URL || '';
            await axios.post(`${baseUrl}/api/v1/admin/studies/${studyId}/restore`, {}, {
                headers: getAuthHeaders(),
            });
            message.success('Study restored successfully');
            fetchStudies();
            fetchTrashStudies();
        } catch (error: any) {
            message.error(error.response?.data?.detail || 'Failed to restore study');
        }
    };

    const handleBulkDelete = async (hardDelete: boolean = false) => {
        if (selectedRowKeys.length === 0) {
            message.warning('No studies selected');
            return;
        }

        Modal.confirm({
            title: hardDelete ? 'Permanently delete selected studies?' : 'Move selected studies to trash?',
            icon: <ExclamationCircleOutlined />,
            content: `${selectedRowKeys.length} study(ies) will be ${hardDelete ? 'permanently deleted' : 'moved to trash'}.`,
            okType: 'danger',
            okText: hardDelete ? 'Delete Permanently' : 'Move to Trash',
            async onOk() {
                try {
                    const baseUrl = import.meta.env.VITE_API_URL || '';
                    await axios.post(`${baseUrl}/api/v1/admin/studies/bulk-delete`, {
                        study_ids: selectedRowKeys,
                        hard_delete: hardDelete,
                    }, {
                        headers: getAuthHeaders(),
                    });
                    message.success(`${selectedRowKeys.length} studies deleted`);
                    setSelectedRowKeys([]);
                    fetchStudies();
                    fetchTrashStudies();
                } catch (error: any) {
                    message.error(error.response?.data?.detail || 'Bulk delete failed');
                }
            },
        });
    };

    const columns = [
        {
            title: 'Study ID',
            dataIndex: 'id',
            key: 'id',
            width: 200,
            render: (id: string) => (
                <Text copyable={{ text: id }} style={{ fontFamily: 'monospace' }}>
                    {id.length > 20 ? `${id.substring(0, 20)}...` : id}
                </Text>
            ),
        },
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
        },
        {
            title: 'Phase',
            dataIndex: 'phase',
            key: 'phase',
            width: 100,
            render: (phase: string) => phase ? <Tag color="blue">{phase}</Tag> : '-',
        },
        {
            title: 'Documents',
            dataIndex: 'document_count',
            key: 'document_count',
            width: 100,
            align: 'center' as const,
            render: (count: number) => <Badge count={count || 0} showZero style={{ backgroundColor: '#52c41a' }} />,
        },
        {
            title: 'Created',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 150,
            render: (date: string) => date ? new Date(date).toLocaleDateString() : '-',
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 200,
            render: (_: any, record: Study) => (
                <Space>
                    <Tooltip title="Move to Trash">
                        <Popconfirm
                            title="Move this study to trash?"
                            onConfirm={() => handleSoftDelete(record.id)}
                            okText="Yes"
                            cancelText="No"
                        >
                            <Button size="small" icon={<RestOutlined />} />
                        </Popconfirm>
                    </Tooltip>
                    <Tooltip title="Delete Permanently">
                        <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => {
                                setStudyToDelete(record);
                                setDeleteModalVisible(true);
                            }}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const trashColumns = [
        ...columns.slice(0, -1),
        {
            title: 'Deleted At',
            dataIndex: 'deleted_at',
            key: 'deleted_at',
            width: 150,
            render: (date: string) => date ? new Date(date).toLocaleDateString() : '-',
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 200,
            render: (_: any, record: Study) => (
                <Space>
                    <Tooltip title="Restore">
                        <Button
                            size="small"
                            type="primary"
                            icon={<UndoOutlined />}
                            onClick={() => handleRestore(record.id)}
                        >
                            Restore
                        </Button>
                    </Tooltip>
                    <Tooltip title="Delete Permanently">
                        <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => {
                                setStudyToDelete(record);
                                setDeleteModalVisible(true);
                            }}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const rowSelection = {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    };

    return (
        <div>
            <Card>
                <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as 'all' | 'trash')}>
                    <TabPane
                        tab={
                            <span>
                                All Studies
                                <Badge count={totalStudies} style={{ marginLeft: 8, backgroundColor: '#1890ff' }} />
                            </span>
                        }
                        key="all"
                    >
                        <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
                            <Space>
                                <Input
                                    placeholder="Search studies..."
                                    prefix={<SearchOutlined />}
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    onPressEnter={() => fetchStudies()}
                                    style={{ width: 300 }}
                                />
                                <Button icon={<ReloadOutlined />} onClick={() => fetchStudies()}>
                                    Refresh
                                </Button>
                            </Space>
                            <Space>
                                {selectedRowKeys.length > 0 && (
                                    <>
                                        <Text type="secondary">{selectedRowKeys.length} selected</Text>
                                        <Button onClick={() => handleBulkDelete(false)}>
                                            Move to Trash
                                        </Button>
                                        <Button danger onClick={() => handleBulkDelete(true)}>
                                            Delete Permanently
                                        </Button>
                                    </>
                                )}
                            </Space>
                        </Space>

                        <Table
                            rowSelection={rowSelection}
                            columns={columns}
                            dataSource={studies}
                            rowKey="id"
                            loading={loading}
                            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Total ${total} studies` }}
                        />
                    </TabPane>

                    <TabPane
                        tab={
                            <span>
                                <RestOutlined />
                                Trash
                                <Badge count={totalTrash} style={{ marginLeft: 8, backgroundColor: '#ff4d4f' }} />
                            </span>
                        }
                        key="trash"
                    >
                        <Alert
                            message="Items in trash can be restored or permanently deleted"
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />

                        <Table
                            columns={trashColumns}
                            dataSource={trashStudies}
                            rowKey="id"
                            loading={loading}
                            pagination={{ pageSize: 10 }}
                        />
                    </TabPane>
                </Tabs>
            </Card>

            <DeleteConfirmModal
                visible={deleteModalVisible}
                study={studyToDelete}
                onConfirm={handleHardDelete}
                onCancel={() => {
                    setDeleteModalVisible(false);
                    setStudyToDelete(null);
                }}
                loading={deleteLoading}
            />
        </div>
    );
};

export default StudyManagement;
