import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { CheckCircleOutlined, CommentOutlined, FilePdfOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useProjectStore } from '../store/projectStore';
import { CodeReviewStatus, type VariableInfo } from '../types';
import './CodeReviewTab.css';

type VariableReviewState = 'pending' | 'approved' | 'changes_requested';

interface ReviewRow {
  key: string;
  name: string;
  label?: string;
  category?: string;
  derivation?: string;
  pseudoCode?: string;
  pseudoSummary?: string;
  codeSnippet?: string;
  userNotes?: string;
  reviewState: VariableReviewState;
  commentCount: number;
}

const statusTag = (status: string) => {
  switch (status) {
    case 'approved':
      return <Tag color="green">Approved</Tag>;
    case 'changes_requested':
      return <Tag color="orange">Changes Requested</Tag>;
    case 'in_review':
      return <Tag color="blue">In Review</Tag>;
    case 'not_started':
    default:
      return <Tag>Not Started</Tag>;
  }
};

const variableStateTag = (state: VariableReviewState) => {
  switch (state) {
    case 'approved':
      return <Tag color="green">Approved</Tag>;
    case 'changes_requested':
      return <Tag color="orange">Changes Requested</Tag>;
    default:
      return <Tag>Pending</Tag>;
  }
};

const truncate = (text?: string, max = 120) => {
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
};

const CodeReviewTab: React.FC = () => {
  const {
    projectConfig,
    programmingLanguage,
    categorizedVariables,
    pairProgramming,
    codeReviewSession,
    codeReviewStatus,
    codeReviewComments,
    isLoadingReview,
    reviewError,
    loadCodeReviewSession,
    updateReviewStatus,
    createComment,
    exportReviewPDF,
    setPairProgrammingAcceptance,
  } = useProjectStore();

  const [commentModal, setCommentModal] = useState<{ open: boolean; variable?: string; text: string }>({
    open: false,
    text: '',
  });

  // Load or create the review session when study/dataset are available.
  useEffect(() => {
    if (!projectConfig.studyId || !projectConfig.adamDataset) return;

    // Avoid unnecessary reload if session already matches current study/dataset/language.
    if (
      codeReviewSession &&
      codeReviewSession.study_id === projectConfig.studyId &&
      codeReviewSession.dataset === projectConfig.adamDataset &&
      codeReviewSession.language === programmingLanguage
    ) {
      return;
    }

    loadCodeReviewSession(projectConfig.studyId, projectConfig.adamDataset, programmingLanguage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectConfig.studyId, projectConfig.adamDataset, programmingLanguage]);

  const deriveState = (snippet?: { accepted?: 'accept' | 'modify' | null; codeSnippet?: string }): VariableReviewState => {
    if (!snippet) return 'pending';
    if (snippet.accepted === 'modify') return 'changes_requested';
    if (snippet.accepted === 'accept') return 'approved';
    return snippet.codeSnippet ? 'pending' : 'pending';
  };

  const rows: ReviewRow[] = useMemo(() => {
    const summarize = (text?: string) => {
      if (!text) return undefined;
      const trimmed = text.trim();
      if (trimmed.length <= 140) return trimmed;
      return `${trimmed.slice(0, 140)}…`;
    };

    const data: Map<string, ReviewRow> = new Map();
    const commentsByVar = codeReviewComments.reduce<Record<string, number>>((acc, comment) => {
      if (comment.variable_name) {
        acc[comment.variable_name] = (acc[comment.variable_name] || 0) + 1;
      }
      return acc;
    }, {});

    const addRow = (variable: string, meta?: Partial<VariableInfo>) => {
      const snippet = pairProgramming.snippets[variable];
      const pseudoContent = snippet?.pseudoCode || meta?.derivation || snippet?.rationale;
      data.set(variable, {
        key: variable,
        name: variable,
        label: meta?.label,
        category: meta?.category,
        derivation: meta?.derivation,
        pseudoCode: pseudoContent,
        pseudoSummary: snippet?.pseudoSummary || summarize(pseudoContent),
        codeSnippet: snippet?.codeSnippet,
        userNotes: snippet?.userNotes,
        reviewState: deriveState(snippet),
        commentCount: commentsByVar[variable] || 0,
      });
    };

    // Primary source: categorized variables (provides labels/derivation).
    categorizedVariables?.categories?.forEach((category) => {
      category.variables?.forEach((variable) => {
        addRow(variable.name, { ...variable, category: category.name });
      });
    });

    // Include any snippets not present in the categorized list.
    Object.keys(pairProgramming.snippets).forEach((variable) => {
      if (!data.has(variable)) {
        addRow(variable);
      }
    });

    return Array.from(data.values());
  }, [categorizedVariables, pairProgramming.snippets, codeReviewComments]);

  const stats = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.reviewState === 'approved') acc.approved += 1;
        else if (row.reviewState === 'changes_requested') acc.changes += 1;
        else acc.pending += 1;
        return acc;
      },
      { total: 0, approved: 0, changes: 0, pending: 0 }
    );
  }, [rows]);

  const handleApprove = (variable: string) => {
    setPairProgrammingAcceptance(variable, 'accept');
    if (codeReviewStatus === CodeReviewStatus.NOT_STARTED) {
      updateReviewStatus(CodeReviewStatus.IN_REVIEW);
    }
    message.success(`Approved ${variable}`);
  };

  const handleRequestChanges = (variable: string) => {
    setPairProgrammingAcceptance(variable, 'modify');
    updateReviewStatus(CodeReviewStatus.CHANGES_REQUESTED);
    message.warning(`Requested changes for ${variable}`);
  };

  const handleOpenComment = (variable: string) => {
    setCommentModal({ open: true, variable, text: '' });
  };

  const handleSubmitComment = async () => {
    if (!commentModal.variable) return;
    const text = commentModal.text.trim();
    if (!text) {
      message.warning('Add a short comment before submitting.');
      return;
    }
    await createComment(text, undefined, commentModal.variable);
    setCommentModal({ open: false, text: '', variable: undefined });
    message.success('Comment added');
  };

  const handleRefresh = () => {
    if (!projectConfig.studyId || !projectConfig.adamDataset) return;
    loadCodeReviewSession(projectConfig.studyId, projectConfig.adamDataset, programmingLanguage, codeReviewSession?.run_id);
  };

  const handleApproveSession = () => {
    if (rows.length === 0) {
      message.warning('No variables to review yet.');
      return;
    }
    updateReviewStatus(CodeReviewStatus.APPROVED);
    message.success('Review status set to Approved (warning will remain on Consolidated until code is regenerated).');
  };

  const columns: ColumnsType<ReviewRow> = [
    {
      title: 'Variable',
      dataIndex: 'name',
      key: 'name',
      render: (_value, row) => (
        <div className="variable-cell">
          <div className="variable-name">{row.name}</div>
          {row.label && <div className="variable-label">{row.label}</div>}
          {row.category && <Tag color="blue">{row.category}</Tag>}
        </div>
      ),
    },
    {
      title: 'Derivation Logic',
      dataIndex: 'derivation',
      key: 'derivation',
      width: 220,
      render: (value?: string) => {
        if (!value) return <span className="muted">No derivation provided</span>;
        return (
          <Tooltip title={value}>
            <div className="truncate">{truncate(value)}</div>
          </Tooltip>
        );
      },
    },
    {
      title: 'Pseudo-Code',
      dataIndex: 'pseudoCode',
      key: 'pseudoCode',
      width: 240,
      render: (_value, row) => {
        if (!row.pseudoCode) return <span className="muted">Not generated</span>;
        return (
          <div className="pseudo-preview">
            {row.pseudoSummary && <div className="muted">{row.pseudoSummary}</div>}
            <pre className="pseudo-snippet">{truncate(row.pseudoCode, 180)}</pre>
          </div>
        );
      },
    },
    {
      title: 'Generated Code',
      dataIndex: 'codeSnippet',
      key: 'codeSnippet',
      width: 240,
      render: (value?: string) => {
        if (!value) return <span className="muted">No code yet</span>;
        return <pre className="code-snippet">{truncate(value, 180)}</pre>;
      },
    },
    {
      title: 'User Notes',
      dataIndex: 'userNotes',
      key: 'userNotes',
      width: 180,
      render: (value?: string) => (value ? <div className="truncate">{truncate(value, 140)}</div> : <span className="muted">None</span>),
    },
    {
      title: 'Status',
      dataIndex: 'reviewState',
      key: 'reviewState',
      width: 150,
      render: (state: VariableReviewState, row) => (
        <Space size="small">
          {variableStateTag(state)}
          {row.commentCount > 0 && <Tag color="purple">{row.commentCount} comment{row.commentCount > 1 ? 's' : ''}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_value, row) => (
        <Space size="small">
          <Button size="small" type="primary" ghost icon={<CheckCircleOutlined />} onClick={() => handleApprove(row.name)}>
            Approve
          </Button>
          <Button size="small" danger icon={<WarningOutlined />} onClick={() => handleRequestChanges(row.name)}>
            Request Changes
          </Button>
          <Button size="small" icon={<CommentOutlined />} onClick={() => handleOpenComment(row.name)}>
            Comment
          </Button>
        </Space>
      ),
    },
  ];

  const reviewStatus = codeReviewStatus || CodeReviewStatus.NOT_STARTED;
  const showWarning = reviewStatus !== CodeReviewStatus.APPROVED;

  if (!projectConfig.studyId || !projectConfig.adamDataset) {
    return (
      <div className="code-review-tab empty">
        <Empty description="Select a study and dataset to start code review." />
      </div>
    );
  }

  return (
    <div className="code-review-tab">
      <div className="review-header">
        <div className="review-info">
          <Typography.Title level={4} style={{ margin: 0 }}>
            Code Review (Variable-Level)
          </Typography.Title>
          <div className="muted">
            Study: {projectConfig.studyId} | Dataset: {projectConfig.adamDataset} | Language: {programmingLanguage}
          </div>
          {statusTag(reviewStatus)}
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} disabled={isLoadingReview}>
            Refresh
          </Button>
          <Button icon={<FilePdfOutlined />} onClick={exportReviewPDF} disabled={!rows.length}>
            Export PDF
          </Button>
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleApproveSession} disabled={!rows.length}>
            Mark Review Approved
          </Button>
        </Space>
      </div>

      {showWarning && (
        <Alert
          type="warning"
          showIcon
          style={{ margin: '16px 16px 0 16px' }}
          message="Review not approved yet"
          description="Consolidated code can be generated but will be treated as draft until you approve the review."
        />
      )}

      {reviewError && (
        <Alert
          type="error"
          showIcon
          style={{ margin: '16px 16px 0 16px' }}
          message="Review error"
          description={reviewError}
        />
      )}

      <div className="review-summary">
        <Space size="large">
          <span>Total: {stats.total}</span>
          <span>Approved: {stats.approved}</span>
          <span>Changes requested: {stats.changes}</span>
          <span>Pending: {stats.pending}</span>
        </Space>
        <span className="muted">Scope: variable-level review only</span>
      </div>

      <div className="review-table">
        {isLoadingReview ? (
          <div className="loading-state">
            <Spin />
          </div>
        ) : rows.length === 0 ? (
          <Empty description="No variables available yet. Generate code snippets in Pair Programming first." />
        ) : (
          <Table
            columns={columns}
            dataSource={rows}
            pagination={{ pageSize: 8 }}
            rowKey="key"
            size="small"
          />
        )}
      </div>

      <Modal
        title={`Add comment for ${commentModal.variable || ''}`}
        open={commentModal.open}
        okText="Add Comment"
        onOk={handleSubmitComment}
        onCancel={() => setCommentModal({ open: false, text: '', variable: undefined })}
      >
        <Input.TextArea
          rows={4}
          value={commentModal.text}
          onChange={(e) => setCommentModal((prev) => ({ ...prev, text: e.target.value }))}
          placeholder="Add your review note or requested change"
        />
      </Modal>
    </div>
  );
};

export default CodeReviewTab;
