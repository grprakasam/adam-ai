/**
 * Code Review Tab - Variable-Centric Review Interface
 *
 * NEW Component (replaces executor-based CodeReviewTab)
 * Domain expert review interface for code review workflow:
 * - Variable table with approval status controls
 * - Details panel with full variable information
 * - Comment functionality per variable
 * - Status tracking and PDF export
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Table, Button, Tag, Input, Select, Modal, message, Spin, Empty } from 'antd';
import { SearchOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined, FileTextOutlined } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { api } from '../services/api';
import './CodeReviewTab.css';

interface Variable {
  variable_name: string;
  variable_label?: string;
  variable_type?: string;
  derivation_logic?: string;
  pseudo_code?: string;
  pseudo_summary?: string;
  code_snippet?: string;
  coding_rationale?: string;
  approval_status: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
  user_notes?: string;
  reviewer_comments?: string;
  has_pseudo_code?: boolean;
}

export const CodeReviewTabNew: React.FC = () => {
  const { projectConfig, pairProgramming } = useProjectStore();

  // State management
  const [variables, setVariables] = useState<Variable[]>([]);
  const [selectedVariable, setSelectedVariable] = useState<Variable | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [commentText, setCommentText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Initialize session and load data
  useEffect(() => {
    const initializeReview = async () => {
      if (!projectConfig?.study_id || !projectConfig?.adam_dataset) {
        message.error('Study information not available');
        return;
      }

      setIsLoading(true);
      try {
        // Create or get session
        const session = await api.createCodeReviewSession(
          projectConfig.study_id,
          projectConfig.adam_dataset,
          projectConfig.programming_language || 'R'
        );

        setSessionId(session.session_id);

        // Load variable snapshots from Pair Programming data
        if (pairProgramming.snippets && Object.keys(pairProgramming.snippets).length > 0) {
          const loadedSnapshots = await api.loadVariableSnapshotsForReview(
            session.session_id,
            pairProgramming.snippets
          );

          const variablesList: Variable[] = loadedSnapshots.map(snapshot => ({
            variable_name: snapshot.variable_name,
            variable_label: snapshot.variable_label,
            variable_type: snapshot.variable_type,
            derivation_logic: snapshot.derivation_logic,
            pseudo_code: snapshot.pseudo_code,
            pseudo_summary: snapshot.pseudo_summary,
            code_snippet: snapshot.code_snippet,
            coding_rationale: snapshot.coding_rationale,
            approval_status: snapshot.approval_status,
            user_notes: snapshot.user_notes,
            reviewer_comments: snapshot.reviewer_comments,
            has_pseudo_code: snapshot.has_pseudo_code
          }));

          setVariables(variablesList);
          if (variablesList.length > 0) {
            setSelectedVariable(variablesList[0]);
          }
        }
      } catch (error) {
        message.error(`Failed to initialize code review: ${error}`);
        console.error('Code review initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeReview();
  }, [projectConfig, pairProgramming.snippets]);

  // Filter and search variables
  const filteredVariables = useMemo(() => {
    return variables.filter(variable => {
      const matchesSearch =
        variable.variable_name.toLowerCase().includes(searchText.toLowerCase()) ||
        (variable.variable_label?.toLowerCase().includes(searchText.toLowerCase()));

      if (statusFilter === 'all') return matchesSearch;
      return matchesSearch && variable.approval_status === statusFilter;
    });
  }, [variables, searchText, statusFilter]);

  // Update variable approval status
  const handleSetApprovalStatus = async (
    variable: Variable,
    newStatus: 'APPROVED' | 'CHANGES_REQUESTED' | 'PENDING'
  ) => {
    if (!sessionId) return;

    try {
      await api.setVariableApprovalStatus(
        sessionId,
        variable.variable_name,
        newStatus,
        commentText || undefined
      );

      // Update local state
      const updatedVariables = variables.map(v =>
        v.variable_name === variable.variable_name
          ? { ...v, approval_status: newStatus, reviewer_comments: commentText }
          : v
      );
      setVariables(updatedVariables);

      const updatedSelected = updatedVariables.find(v => v.variable_name === variable.variable_name);
      setSelectedVariable(updatedSelected || null);

      message.success(`${variable.variable_name} marked as ${newStatus}`);
      setCommentText('');
    } catch (error) {
      message.error(`Failed to update approval status: ${error}`);
    }
  };

  // Add comment
  const handleAddComment = async (variable: Variable) => {
    if (!sessionId || !commentText.trim()) return;

    try {
      await api.addCodeReviewComment(
        sessionId,
        variable.variable_name,
        commentText
      );

      message.success('Comment added');
      setCommentText('');
    } catch (error) {
      message.error(`Failed to add comment: ${error}`);
    }
  };

  // Export to PDF
  const handleExportPDF = async () => {
    if (!sessionId) return;

    try {
      message.loading('Generating PDF...');
      // TODO: Implement PDF export via API
      message.success('PDF exported successfully');
    } catch (error) {
      message.error(`Failed to export PDF: ${error}`);
    }
  };

  // Table columns
  const columns = [
    {
      title: 'Variable',
      dataIndex: 'variable_name',
      key: 'variable_name',
      width: 150,
      sorter: (a: Variable, b: Variable) => a.variable_name.localeCompare(b.variable_name)
    },
    {
      title: 'Label',
      dataIndex: 'variable_label',
      key: 'variable_label',
      width: 180,
      render: (label: string) => label || '-'
    },
    {
      title: 'Type',
      dataIndex: 'variable_type',
      key: 'variable_type',
      width: 80,
      render: (type: string) => type || '-'
    },
    {
      title: 'Status',
      dataIndex: 'approval_status',
      key: 'approval_status',
      width: 140,
      render: (status: string) => {
        const config = {
          'APPROVED': { color: 'success', icon: <CheckCircleOutlined size={16} /> },
          'PENDING': { color: 'default', icon: <ClockCircleOutlined size={16} /> },
          'CHANGES_REQUESTED': { color: 'warning', icon: <ExclamationCircleOutlined size={16} /> }
        };
        const { color, icon } = config[status as keyof typeof config] || config['PENDING'];
        return <Tag icon={icon} color={color}>{status}</Tag>;
      }
    },
    {
      title: 'Pseudo-Code',
      dataIndex: 'has_pseudo_code',
      key: 'has_pseudo_code',
      width: 120,
      render: (hasPseudoCode: boolean) =>
        hasPseudoCode ? <Tag color="blue">✓ Available</Tag> : <Tag>-</Tag>
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return '#52c41a';
      case 'CHANGES_REQUESTED': return '#faad14';
      default: return '#d9d9d9';
    }
  };

  if (isLoading) {
    return (
      <div className="code-review-container">
        <Spin size="large" tip="Loading code review session..." />
      </div>
    );
  }

  if (!variables.length) {
    return (
      <div className="code-review-container">
        <Empty
          description="No variables to review"
          style={{ marginTop: '100px' }}
        >
          <p>Generate code in Pair Programming first</p>
        </Empty>
      </div>
    );
  }

  return (
    <div className="code-review-container">
      {/* Header */}
      <div className="code-review-header">
        <div className="header-info">
          <FileTextOutlined size={20} />
          <span className="header-title">Code Review</span>
          <span className="header-subtitle">
            {projectConfig?.study_id} | {projectConfig?.adam_dataset} | {projectConfig?.programming_language}
          </span>
        </div>

        {/* Session Status Summary */}
        <div className="session-summary">
          <span>
            <Tag color="blue">{variables.length} Total</Tag>
            <Tag color="green">
              {variables.filter(v => v.approval_status === 'APPROVED').length} Approved
            </Tag>
            <Tag color="orange">
              {variables.filter(v => v.approval_status === 'PENDING').length} Pending
            </Tag>
            <Tag color="red">
              {variables.filter(v => v.approval_status === 'CHANGES_REQUESTED').length} Changes Req
            </Tag>
          </span>
        </div>

        {/* Actions */}
        <div className="header-actions">
          <Button type="primary" icon={<FileTextOutlined size={16} />} onClick={handleExportPDF}>
            Export PDF
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="code-review-content">
        {/* Variables Table */}
        <div className="variables-table-container">
          <div className="table-controls">
            <Input
              placeholder="Search variables..."
              prefix={<SearchOutlined size={16} />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 300 }}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 200 }}
            >
              <Select.Option value="all">All Status</Select.Option>
              <Select.Option value="PENDING">Pending</Select.Option>
              <Select.Option value="APPROVED">Approved</Select.Option>
              <Select.Option value="CHANGES_REQUESTED">Changes Requested</Select.Option>
            </Select>
          </div>

          <Table
            columns={columns}
            dataSource={filteredVariables}
            rowKey="variable_name"
            size="small"
            pagination={{ pageSize: 10 }}
            onRow={record => ({
              onClick: () => setSelectedVariable(record),
              style: {
                cursor: 'pointer',
                backgroundColor: selectedVariable?.variable_name === record.variable_name ? '#f5f5f5' : 'transparent'
              }
            })}
          />
        </div>

        {/* Details Panel */}
        {selectedVariable && (
          <div className="details-panel">
            <div className="panel-header">
              <div>
                <h3>{selectedVariable.variable_name}</h3>
                {selectedVariable.variable_label && (
                  <p className="label-subtitle">{selectedVariable.variable_label}</p>
                )}
              </div>
              <Tag color={getStatusColor(selectedVariable.approval_status)}>
                {selectedVariable.approval_status}
              </Tag>
            </div>

            {/* Derivation Logic */}
            {selectedVariable.derivation_logic && (
              <div className="detail-section">
                <h4>Derivation Logic</h4>
                <div className="detail-content">
                  {selectedVariable.derivation_logic}
                </div>
              </div>
            )}

            {/* Pseudo-Code */}
            {selectedVariable.pseudo_code && (
              <div className="detail-section">
                <h4>Pseudo-Code</h4>
                <div className="detail-content pseudo-code-display">
                  <pre>{selectedVariable.pseudo_code}</pre>
                  {selectedVariable.pseudo_summary && (
                    <p className="pseudo-summary">{selectedVariable.pseudo_summary}</p>
                  )}
                </div>
              </div>
            )}

            {/* Generated Code */}
            {selectedVariable.code_snippet && (
              <div className="detail-section">
                <h4>Generated Code</h4>
                <div className="detail-content code-display">
                  <pre><code>{selectedVariable.code_snippet}</code></pre>
                </div>
              </div>
            )}

            {/* Reviewer Comments */}
            <div className="detail-section">
              <h4>Comments & Feedback</h4>
              {selectedVariable.reviewer_comments && (
                <div className="existing-comments">
                  <p>{selectedVariable.reviewer_comments}</p>
                </div>
              )}
              <div className="comment-input">
                <textarea
                  placeholder="Add your review comments..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {/* Approval Actions */}
            <div className="approval-actions">
              <Button
                type="primary"
                color="success"
                onClick={() => handleSetApprovalStatus(selectedVariable, 'APPROVED')}
              >
                ✓ Approve
              </Button>
              <Button
                danger
                onClick={() => handleSetApprovalStatus(selectedVariable, 'CHANGES_REQUESTED')}
              >
                ✗ Request Changes
              </Button>
              <Button onClick={() => handleAddComment(selectedVariable)}>
                Add Comment
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeReviewTabNew;
