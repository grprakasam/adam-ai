"""
Graph Builder - Builds React Flow compatible graph from traceability variables
"""

from typing import List, Dict
import networkx as nx
from loguru import logger
from .models import TraceabilityVariable


class GraphBuilder:
    """Build React Flow graph from traceability variables"""

    async def build_react_flow_graph(
        self,
        variables: List[TraceabilityVariable]
    ) -> Dict:
        """
        Build React Flow compatible graph

        Returns:
        {
          "nodes": [...],
          "edges": [...],
          "viewport": {"x": 0, "y": 0, "zoom": 1}
        }
        """

        # Build directed graph
        G = nx.DiGraph()

        # Add nodes and edges
        sdtm_domains = set()
        transformations = []
        adam_variables = []

        for var in variables:
            # ADAM variable node
            adam_node_id = var.variable_name
            adam_variables.append(adam_node_id)
            G.add_node(
                adam_node_id,
                type='adamVariable',
                data={
                    'name': var.variable_name,
                    'label': var.label,
                    'category': var.category,
                    'confidence': var.confidence,
                }
            )

            # Source SDTM nodes
            for source in var.sources:
                sdtm_node_id = source.domain
                sdtm_domains.add(sdtm_node_id)
                if not G.has_node(sdtm_node_id):
                    G.add_node(
                        sdtm_node_id,
                        type='sdtmDomain',
                        data={
                            'domain': source.domain,
                            'variables': []
                        }
                    )

                # Add variable to domain's variable list
                if source.variable:
                    domain_data = G.nodes[sdtm_node_id]['data']
                    if source.variable not in domain_data['variables']:
                        domain_data['variables'].append(source.variable)

                # Transformation node (algorithm)
                transform_id = f"transform-{var.variable_name}"
                if transform_id not in transformations:
                    transformations.append(transform_id)
                    G.add_node(
                        transform_id,
                        type='transformation',
                        data={
                            'operation': self._summarize_operation(var.algorithm),
                            'fullAlgorithm': var.algorithm,
                            'ruleRef': var.rule_refs[0] if var.rule_refs else None
                        }
                    )

                # Edges: SDTM → Transform → ADAM
                if not G.has_edge(sdtm_node_id, transform_id):
                    G.add_edge(sdtm_node_id, transform_id)
                if not G.has_edge(transform_id, adam_node_id):
                    G.add_edge(transform_id, adam_node_id)

        # Calculate layout (hierarchical: SDTM left, transforms middle, ADAM right)
        pos = self._calculate_hierarchical_layout(
            G, sdtm_domains, transformations, adam_variables
        )

        # Convert to React Flow format
        nodes = []
        edges = []

        for node_id in G.nodes:
            node_data = G.nodes[node_id]
            nodes.append({
                'id': node_id,
                'type': node_data['type'],
                'position': pos[node_id],
                'data': node_data['data']
            })

        edge_id = 0
        for source, target in G.edges:
            edges.append({
                'id': f'e{edge_id}',
                'source': source,
                'target': target,
                'type': 'smoothstep',  # Curved edges
                'animated': False,
            })
            edge_id += 1

        logger.info(f"Built graph: {len(nodes)} nodes, {len(edges)} edges")

        return {
            'nodes': nodes,
            'edges': edges,
            'viewport': {'x': 0, 'y': 0, 'zoom': 1}
        }

    def _calculate_hierarchical_layout(
        self,
        G: nx.DiGraph,
        sdtm_domains: set,
        transformations: List[str],
        adam_variables: List[str]
    ) -> Dict[str, Dict[str, float]]:
        """Calculate hierarchical layout positions"""
        pos = {}

        # Column widths
        SDTM_X = 0
        TRANSFORM_X = 300
        ADAM_X = 600

        # Vertical spacing
        Y_SPACING = 80

        # SDTM domains (left column)
        for i, domain in enumerate(sorted(sdtm_domains)):
            pos[domain] = {'x': SDTM_X, 'y': i * Y_SPACING}

        # Transformations (middle column)
        for i, transform in enumerate(transformations):
            pos[transform] = {'x': TRANSFORM_X, 'y': i * Y_SPACING}

        # ADAM variables (right column)
        for i, var in enumerate(adam_variables):
            pos[var] = {'x': ADAM_X, 'y': i * Y_SPACING}

        return pos

    def _summarize_operation(self, algorithm: str) -> str:
        """Summarize algorithm into short operation label"""
        algorithm_lower = algorithm.lower()

        if 'merge' in algorithm_lower or 'join' in algorithm_lower:
            return 'Merge'
        elif 'concatenate' in algorithm_lower or 'paste' in algorithm_lower:
            return 'Concatenate'
        elif 'if' in algorithm_lower or 'case when' in algorithm_lower:
            return 'Conditional'
        elif 'format' in algorithm_lower or 'convert' in algorithm_lower:
            return 'Format'
        elif 'calculate' in algorithm_lower or '=' in algorithm_lower:
            return 'Calculate'
        else:
            return 'Transform'
