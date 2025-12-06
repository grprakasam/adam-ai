import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { CheckCircleOutlined, FilePdfOutlined, ReloadOutlined, CodeOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import { CodeReviewStatus, type VariableInfo, type CodeSnippetRequest } from '../types';
import { PageHeader } from './PageHeader';
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
    llmProvider,
    selectedModel,
    loadCodeReviewSession,
    updateReviewStatus,
    createComment,
    exportReviewPDF,
    setPairProgrammingSnippet,
    setGeneratingSnippet,
    setPairProgrammingNotes,
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

  // Simple filters/search for card-based layout
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'changes' | 'approved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch =
        row.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (row.label && row.label.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter === 'approved') return row.reviewState === 'approved';
      if (statusFilter === 'changes') return row.reviewState === 'changes_requested';
      if (statusFilter === 'pending') return row.reviewState === 'pending';
      return true;
    });
  }, [rows, searchQuery, statusFilter]);

  // Ensure we always have a selected variable when there is data.
  const selectedRow = useMemo(() => {
    if (!filteredRows.length) return null;
    const current =
      (selectedVariable && filteredRows.find((row) => row.name === selectedVariable)) || filteredRows[0];
    return current;
  }, [filteredRows, selectedVariable]);

  // Legacy handlers kept for potential future approval workflows
  // Currently unused, so commented out to keep linter clean.
  /*
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
  */

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

  const reviewStatus = codeReviewStatus || CodeReviewStatus.NOT_STARTED;

  const findVariableMeta = (variableName: string): VariableInfo | undefined => {
    const categories = categorizedVariables?.categories;
    if (!categories) return undefined;
    for (const category of categories) {
      const match = category.variables?.find((v) => v.name === variableName);
      if (match) return match as VariableInfo;
    }
    return undefined;
  };

  const handleRegenerateCode = async (row: ReviewRow) => {
    if (!projectConfig.studyId || !projectConfig.adamDataset) {
      message.error('Please configure study ID and dataset before regenerating code.');
      return;
    }

    const variableName = row.name;
    const existingSnippet = pairProgramming.snippets[variableName];
    const userNote = (existingSnippet?.userNotes || '').trim();
    const variableMeta = findVariableMeta(variableName);
    const derivationText = variableMeta?.derivation || row.derivation || '';

    let cleanupRequired = false;

    try {
      setGeneratingSnippet(variableName, true);
      cleanupRequired = true;

      const payload: CodeSnippetRequest = {
        study_id: projectConfig.studyId,
        dataset: projectConfig.adamDataset,
        variable: variableName,
        derivation: derivationText || 'No derivation logic specified',
        spec_row: {
          Variable: variableName,
          Label: row.label || variableMeta?.label || '',
          Type: (variableMeta as any)?.type || '',
          Length: (variableMeta as any)?.length || '',
          Format: (variableMeta as any)?.format || '',
          'Source/Derivation': derivationText || '',
        },
        standards: {
          sdtm_version: projectConfig.sdtmVersion || '3.4',
          adam_ig_version: projectConfig.adamIgVersion || '1.3',
          meddra_version: projectConfig.medraVersion || '26.0',
        },
        language: programmingLanguage,
        context: {
          available_sdtm_domains: ['DM', 'EX', 'AE', 'LB', 'DS'],
          required_variables: [variableName],
          category: row.category || variableMeta?.category || 'General',
        },
      };

      if (llmProvider) {
        payload.llm_provider = llmProvider;
      }
      if (selectedModel) {
        payload.model = selectedModel;
      }
      if (userNote) {
        payload.user_note = userNote;
      }

      const response = await adamApi.generateCodeSnippet(payload);

      const nextUserNotes = existingSnippet?.userNotes ?? userNote ?? '';
      const nextAcceptance = existingSnippet?.accepted === 'modify' ? 'modify' : 'accept';

      setPairProgrammingSnippet(variableName, {
        variable: variableName,
        codeSnippet: response.code_snippet,
        rationale: response.coding_rationale,
        pseudoCode: response.pseudo_code ?? existingSnippet?.pseudoCode,
        pseudoSummary: response.pseudo_summary ?? existingSnippet?.pseudoSummary,
        userNotes: nextUserNotes,
        accepted: nextAcceptance,
        generatedAt: new Date(),
        language: programmingLanguage,
        metadata: response.metadata,
        error: undefined,
      });

      message.success(`Regenerated code for ${variableName} using your review notes.`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to regenerate code';
      message.error(errorMsg);

      if (!existingSnippet?.codeSnippet) {
        setPairProgrammingSnippet(variableName, {
          variable: variableName,
          codeSnippet: '',
          rationale: '',
          userNotes: userNote || '',
          accepted: null,
          generatedAt: new Date(),
          language: programmingLanguage,
          error: errorMsg,
          metadata: existingSnippet?.metadata,
          pseudoCode: existingSnippet?.pseudoCode,
          pseudoSummary: existingSnippet?.pseudoSummary,
        } as any);
      }
    } finally {
      if (cleanupRequired) {
        setGeneratingSnippet(variableName, false);
      }
    }
  };

  const handleApproveVariable = async (row: ReviewRow) => {
    const variableName = row.name;
    setPairProgrammingAcceptance(variableName, 'accept');

    if (codeReviewStatus === CodeReviewStatus.NOT_STARTED) {
      updateReviewStatus(CodeReviewStatus.IN_REVIEW);
    }

    const notes = pairProgramming.snippets[variableName]?.userNotes;

    try {
      if (codeReviewSession?.id) {
        await adamApi.setVariableApprovalStatus(
          codeReviewSession.id,
          variableName,
          'APPROVED',
          notes
        );
      }
      message.success(`Marked ${variableName} as approved.`);
    } catch (error) {
      console.error('Failed to update variable approval status:', error);
      message.error('Saved locally, but failed to sync approval status to the server.');
    }
  };

  const handleMarkForChanges = async (row: ReviewRow) => {
    const variableName = row.name;
    setPairProgrammingAcceptance(variableName, 'modify');
    updateReviewStatus(CodeReviewStatus.CHANGES_REQUESTED);

    const notes = pairProgramming.snippets[variableName]?.userNotes;

    try {
      if (codeReviewSession?.id) {
        await adamApi.setVariableApprovalStatus(
          codeReviewSession.id,
          variableName,
          'CHANGES_REQUESTED',
          notes
        );
      }
      message.success(`Marked ${variableName} for further changes.`);
    } catch (error) {
      console.error('Failed to update variable change status:', error);
      message.error('Saved locally, but failed to sync change status to the server.');
    }
  };

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
        <div className="review-header-left">
          <div className="review-info">
            <Typography.Title level={4} style={{ margin: 0 }}>
              Code Review (Variable-Level)
            </Typography.Title>
            <div className="muted">
              Study: {projectConfig.studyId} | Dataset: {projectConfig.adamDataset} | Language: {programmingLanguage}
            </div>
            {statusTag(reviewStatus)}
          </div>
        </div>

        {/* Center section: quick status filters, mirroring Pair Programming header-center-section */}
        <div className="header-center-section review-header-center">
          <div className="filter-tabs">
            <button
              className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <span className="filter-tab-label">All</span>
              <span className="filter-tab-count">{stats.total}</span>
            </button>
            <button
              className={`filter-tab ${statusFilter === 'changes' ? 'active' : ''}`}
              onClick={() => setStatusFilter('changes')}
            >
              <span className="filter-tab-label">Needs changes</span>
              <span className="filter-tab-count">{stats.changes}</span>
            </button>
            <button
              className={`filter-tab ${statusFilter === 'approved' ? 'active' : ''}`}
              onClick={() => setStatusFilter('approved')}
            >
              <span className="filter-tab-label">Approved</span>
              <span className="filter-tab-count">{stats.approved}</span>
            </button>
            <button
              className={`filter-tab ${statusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              <span className="filter-tab-label">Pending</span>
              <span className="filter-tab-count">{stats.pending}</span>
            </button>
          </div>
        </div>

        <div className="review-header-right">
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} disabled={isLoadingReview}>
              Refresh
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={exportReviewPDF} disabled={!rows.length}>
              Export PDF
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleApproveSession}
              disabled={!rows.length}
            >
              Mark Review Approved
            </Button>
          </Space>
        </div>
      </div>

      <div className="review-main-layout">
        {/* Sidebar: filters and variable navigator */}
        <div className="review-sidebar">
          <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
            Review navigator
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
            Filter and select a variable to review its logic in detail.
          </Typography.Paragraph>

          <div className="sidebar-section">
            <Typography.Text strong>Search variables</Typography.Text>
            <Input.Search
              allowClear
              placeholder="Name or label..."
              onSearch={setSearchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
            />
          </div>

          <div className="sidebar-section">
            <Typography.Text strong>Variables</Typography.Text>
            <div className="variable-list">
              {isLoadingReview ? (
                <div className="loading-state">
                  <Spin />
                </div>
              ) : !filteredRows.length ? (
                <Empty
                  description="No variables to review yet. Generate and mark variables for modification in Pair Programming."
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                filteredRows.map((row) => (
                  <Card
                    key={row.key}
                    size="small"
                    className={`variable-list-item${selectedRow && selectedRow.name === row.name ? ' variable-list-item-selected' : ''
                      }`}
                    onClick={() => setSelectedVariable(row.name)}
                    hoverable
                  >
                    <div className="variable-list-item-main">
                      <div>
                        <div className="variable-name">{row.name}</div>
                        {row.label && <div className="variable-label">{row.label}</div>}
                      </div>
                      <div className="variable-list-item-status">
                        {variableStateTag(row.reviewState)}
                        {row.commentCount > 0 && (
                          <Tag color="purple">
                            {row.commentCount} comment{row.commentCount > 1 ? 's' : ''}
                          </Tag>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          <div className="sidebar-section">
            <Typography.Text strong>Review scope</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 4 }}>
              Use Pair Programming to mark variables as “modify”. This view is optimized for those
              variables, but you can still see all if needed.
            </Typography.Paragraph>
          </div>
        </div>

        {/* Main content: single-variable workspace */}
        <div className="review-content">
          {isLoadingReview && !selectedRow ? (
            <div className="loading-state">
              <Spin />
            </div>
          ) : !selectedRow ? (
            <Empty description="Select a variable from the left to start code review." />
          ) : (
            <Card className="review-workspace">
              <div className="review-workspace-header">
                <div>
                  <div className="variable-name">{selectedRow.name}</div>
                  {selectedRow.label && <div className="variable-label">{selectedRow.label}</div>}
                  {selectedRow.category && <Tag color="blue">{selectedRow.category}</Tag>}
                </div>
                <div className="review-workspace-status">
                  {variableStateTag(selectedRow.reviewState)}
                  {selectedRow.commentCount > 0 && (
                    <Tag color="purple">
                      {selectedRow.commentCount} comment{selectedRow.commentCount > 1 ? 's' : ''}
                    </Tag>
                  )}
                </div>
              </div>

              <div className="review-workspace-body">
                <div className="review-workspace-column review-workspace-column-context">
                  <div className="review-card-section">
                    <Typography.Text type="secondary" strong>
                      Derivation logic (current understanding)
                    </Typography.Text>
                    <div className="review-card-content">
                      {selectedRow.derivation ? (
                        <Tooltip title={selectedRow.derivation}>
                          <div className="truncate">{truncate(selectedRow.derivation, 260)}</div>
                        </Tooltip>
                      ) : (
                        <span className="muted">No derivation provided yet.</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="review-workspace-column review-workspace-column-code">
                  <div className="review-card-section">
                    <Typography.Text type="secondary" strong>
                      Generated code
                    </Typography.Text>
                    <div className="review-card-content">
                      {selectedRow.codeSnippet ? (
                        <pre className="code-snippet code-snippet-large">
                          <code>{selectedRow.codeSnippet}</code>
                        </pre>
                      ) : (
                        <span className="muted">
                          No code has been generated for this variable yet.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="review-card-section">
                    <Typography.Text type="secondary" strong>
                      Your notes for this variable
                    </Typography.Text>
                    <Input.TextArea
                      rows={4}
                      value={pairProgramming.snippets[selectedRow.name]?.userNotes ?? selectedRow.userNotes ?? ''}
                      placeholder="Describe ADaM-specific expectations or changes you need"
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setPairProgrammingNotes(selectedRow.name, newValue);
                      }}
                      onBlur={(e) => {
                        const newValue = e.target.value;
                        if (newValue !== selectedRow.userNotes) {
                          // Keep acceptance in sync with review state when notes change
                          setPairProgrammingAcceptance(
                            selectedRow.name,
                            selectedRow.reviewState === 'approved'
                              ? 'accept'
                              : selectedRow.reviewState === 'changes_requested'
                                ? 'modify'
                                : null
                          );
                        }
                      }}
                    />
                    <div className="review-notes-actions">
                      <Space size="small">
                        <Button
                          type="default"
                          size="small"
                          icon={<ReloadOutlined />}
                          loading={pairProgramming.isGenerating?.[selectedRow.name]}
                          onClick={() => handleRegenerateCode(selectedRow)}
                        >
                          Regenerate AI Code
                        </Button>
                        <Button
                          type="primary"
                          size="small"
                          icon={<CheckCircleOutlined />}
                          onClick={() => handleApproveVariable(selectedRow)}
                        >
                          Approve &amp; mark complete
                        </Button>
                        <Button
                          danger
                          size="small"
                          onClick={() => handleMarkForChanges(selectedRow)}
                        >
                          Mark for more changes
                        </Button>
                      </Space>
                      <Typography.Text type="secondary" className="review-card-hint">
                        Use notes and Regenerate to refine the code, then approve or flag for another refinement cycle.
                      </Typography.Text>
                    </div>
                  </div>
                </div>
              </div>

              <div className="review-workspace-footer">
                <Typography.Text type="secondary" className="review-card-hint">
                  Iterate on the logic here until you are satisfied, then proceed to Consolidated Code.
                </Typography.Text>
              </div>

              {reviewError && (
                <div className="review-error-banner">
                  <Alert
                    type="warning"
                    showIcon
                    banner
                    message="We could not fully sync this review with the server."
                    description="Your latest changes may not be saved. Please try again in a moment or contact your administrator if this continues."
                  />
                </div>
              )}
            </Card>
          )}
        </div>
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
