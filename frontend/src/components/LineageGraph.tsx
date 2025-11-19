// @ts-nocheck
import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Tag, Typography, Badge, Tooltip } from 'antd';
import {
  DatabaseOutlined,
  ThunderboltOutlined,
  BookOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface LineageGraphProps {
  graphData?: {
    nodes: any[];
    edges: any[];
    viewport?: { x: number; y: number; zoom: number };
  } | null;
  onVariableSelect?: (variable: string) => void;
}

// Custom Node Components
const SDTMDomainNode = ({ data }: any) => {
  return (
    <div
      style={{
        padding: '12px 16px',
        border: '2px solid #1890ff',
        borderRadius: 8,
        background: '#e6f7ff',
        minWidth: 120,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <DatabaseOutlined style={{ color: '#1890ff', marginRight: 6 }} />
        <Text strong style={{ color: '#1890ff' }}>{data.domain}</Text>
      </div>
      {data.variables && data.variables.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {data.variables.slice(0, 3).map((v: string) => (
            <Tag key={v} color="blue" style={{ fontSize: 10, margin: '2px' }}>
              {v}
            </Tag>
          ))}
          {data.variables.length > 3 && (
            <Tag color="blue" style={{ fontSize: 10, margin: '2px' }}>
              +{data.variables.length - 3}
            </Tag>
          )}
        </div>
      )}
    </div>
  );
};

const TransformationNode = ({ data }: any) => {
  return (
    <Tooltip title={data.fullAlgorithm} placement="top">
      <div
        style={{
          padding: '10px 14px',
          border: '2px solid #faad14',
          borderRadius: 8,
          background: '#fffbe6',
          minWidth: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ThunderboltOutlined style={{ color: '#faad14', marginRight: 6 }} />
          <Text style={{ fontSize: 12, color: '#595959' }}>{data.operation}</Text>
        </div>
        {data.ruleRef && (
          <Tag
            color="gold"
            icon={<BookOutlined />}
            style={{ fontSize: 10, marginTop: 6 }}
          >
            Rule
          </Tag>
        )}
      </div>
    </Tooltip>
  );
};

const ADAMVariableNode = ({ data }: any) => {
  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return '#52c41a';
    if (confidence > 0.5) return '#faad14';
    return '#ff4d4f';
  };

  return (
    <div
      style={{
        padding: '12px 16px',
        border: '2px solid #52c41a',
        borderLeft: `6px solid ${getConfidenceColor(data.confidence)}`,
        borderRadius: 8,
        background: '#f6ffed',
        minWidth: 140,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text strong style={{ color: '#389e0d' }}>{data.name}</Text>
        <Badge
          count={`${Math.round(data.confidence * 100)}%`}
          style={{
            backgroundColor: getConfidenceColor(data.confidence),
            fontSize: 10,
          }}
        />
      </div>
      <Text
        type="secondary"
        style={{ fontSize: 11, display: 'block', marginTop: 4 }}
        ellipsis={{ tooltip: data.label }}
      >
        {data.label}
      </Text>
      <div style={{ marginTop: 6 }}>
        <Tag color="green" style={{ fontSize: 10 }}>
          {data.category}
        </Tag>
      </div>
    </div>
  );
};

const nodeTypes = {
  sdtmDomain: SDTMDomainNode,
  transformation: TransformationNode,
  adamVariable: ADAMVariableNode,
};

export const LineageGraph: React.FC<LineageGraphProps> = ({
  graphData,
  onVariableSelect,
}) => {
  const initialNodes: Node[] = useMemo(() => {
    if (!graphData?.nodes) return [];

    return graphData.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position || { x: 0, y: 0 },
      data: node.data,
    }));
  }, [graphData]);

  const initialEdges: Edge[] = useMemo(() => {
    if (!graphData?.edges) return [];

    return graphData.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type || 'smoothstep',
      animated: edge.animated || false,
      style: { stroke: '#b1b1b7', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: '#b1b1b7',
      },
    }));
  }, [graphData]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.type === 'adamVariable' && onVariableSelect) {
        onVariableSelect(node.data.name);
      }
    },
    [onVariableSelect]
  );

  const getMiniMapNodeColor = (node: Node) => {
    if (node.type === 'sdtmDomain') return '#1890ff';
    if (node.type === 'transformation') return '#faad14';
    if (node.type === 'adamVariable') {
      const confidence = node.data.confidence || 0;
      if (confidence > 0.8) return '#52c41a';
      if (confidence > 0.5) return '#faad14';
      return '#ff4d4f';
    }
    return '#8c8c8c';
  };

  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#8c8c8c' }}>
          <InfoCircleOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <div>No graph data available</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: 600, width: '100%', border: '1px solid #f0f0f0', borderRadius: 8 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls />
        <MiniMap
          nodeColor={getMiniMapNodeColor}
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
        <Background color="#f5f5f5" gap={16} />
      </ReactFlow>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'white',
          padding: '12px 16px',
          border: '1px solid #d9d9d9',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <Text strong style={{ display: 'block', marginBottom: 8 }}>Legend</Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, background: '#1890ff', borderRadius: 4 }} />
            <Text style={{ fontSize: 12 }}>SDTM Domain</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, background: '#faad14', borderRadius: 4 }} />
            <Text style={{ fontSize: 12 }}>Transformation</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, background: '#52c41a', borderRadius: 4 }} />
            <Text style={{ fontSize: 12 }}>ADAM Variable</Text>
          </div>
        </div>
      </div>
    </div>
  );
};
