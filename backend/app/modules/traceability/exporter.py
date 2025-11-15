"""
Traceability Exporter - Export to multiple formats (Excel, PDF, Word, JSON)
"""

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils.dataframe import dataframe_to_rows
from pathlib import Path
from typing import Dict
from loguru import logger
from .models import TraceabilityMatrix
from io import BytesIO


class TraceabilityExporter:
    """Export traceability matrix to multiple formats"""

    async def export_to_excel(
        self,
        matrix: TraceabilityMatrix,
        options: Dict
    ) -> bytes:
        """
        Export to Excel with multiple sheets

        Sheets:
        1. Summary - Overview statistics
        2. Matrix - Full traceability matrix
        3. Graph - Embedded lineage graph image (placeholder)
        4. Rules - ADAM IG rule references
        """

        wb = Workbook()

        # Sheet 1: Summary
        ws_summary = wb.active
        ws_summary.title = "Summary"

        summary_data = [
            ['SDTM-ADaM Traceability Matrix', ''],
            ['', ''],
            ['Study ID', matrix.study_id],
            ['Dataset', matrix.dataset],
            ['SDTM Version', matrix.sdtm_version],
            ['ADaM IG Version', matrix.adam_ig_version],
            ['Generated At', matrix.generated_at.strftime('%Y-%m-%d %H:%M:%S')],
            ['', ''],
            ['Statistics', ''],
            ['Total Variables', matrix.total_variables],
            ['Traced Variables', matrix.traced_variables],
            ['Average Confidence', f'{matrix.average_confidence:.2%}'],
            ['High Confidence (>80%)', matrix.high_confidence_count],
            ['Medium Confidence (50-80%)', matrix.medium_confidence_count],
            ['Low Confidence (<50%)', matrix.low_confidence_count],
        ]

        for row in summary_data:
            ws_summary.append(row)

        # Style header
        ws_summary['A1'].font = Font(size=16, bold=True)
        ws_summary.merge_cells('A1:B1')

        # Sheet 2: Matrix
        ws_matrix = wb.create_sheet("Traceability Matrix")

        # Convert variables to DataFrame
        matrix_data = []
        for var in matrix.variables:
            matrix_data.append({
                'Variable': var.variable_name,
                'Label': var.label,
                'Category': var.category,
                'Type': var.data_type,
                'Length': var.length if var.length else '',
                'Format': var.format if var.format else '',
                'Source Domains': ', '.join([s.domain for s in var.sources]),
                'Source Variables': ', '.join([s.variable for s in var.sources if s.variable]),
                'Algorithm': var.algorithm,
                'ADAM IG Rules': ', '.join(var.rule_refs),
                'Confidence': f'{var.confidence:.0%}',
            })

        df = pd.DataFrame(matrix_data)

        # Write DataFrame to sheet
        for r in dataframe_to_rows(df, index=False, header=True):
            ws_matrix.append(r)

        # Style header row
        header_fill = PatternFill(start_color='366092', end_color='366092', fill_type='solid')
        header_font = Font(color='FFFFFF', bold=True)

        for cell in ws_matrix[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center', vertical='center')

        # Auto-adjust column widths
        for column in ws_matrix.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(cell.value)
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws_matrix.column_dimensions[column_letter].width = adjusted_width

        # Sheet 3: Rules
        if options.get('include_rules', True):
            ws_rules = wb.create_sheet("ADAM IG Rules")
            # Extract unique rules
            all_rules = set()
            for var in matrix.variables:
                all_rules.update(var.rule_refs)

            ws_rules.append(['ADAM IG Rule Reference', 'Variables'])
            for rule in sorted(all_rules):
                variables = [v.variable_name for v in matrix.variables if rule in v.rule_refs]
                ws_rules.append([rule, ', '.join(variables)])

        # Save to bytes
        output = BytesIO()
        wb.save(output)
        output.seek(0)

        logger.info(f"Exported traceability matrix to Excel: {matrix.total_variables} variables")

        return output.getvalue()

    async def export_to_json(
        self,
        matrix: TraceabilityMatrix
    ) -> bytes:
        """Export to JSON (complete lineage object)"""
        import json

        json_str = matrix.model_dump_json(indent=2)
        logger.info(f"Exported traceability matrix to JSON")

        return json_str.encode('utf-8')

    async def export_to_pdf(
        self,
        matrix: TraceabilityMatrix,
        options: Dict
    ) -> bytes:
        """
        Export to PDF using HTML template
        (WeasyPrint would be used in production for better formatting)
        """
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; }}
                h1 {{ color: #366092; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }}
                th {{ background-color: #366092; color: white; padding: 8px; text-align: left; }}
                td {{ border: 1px solid #ddd; padding: 6px; }}
                tr:nth-child(even) {{ background-color: #f2f2f2; }}
                .summary {{ margin-bottom: 30px; }}
            </style>
        </head>
        <body>
            <h1>SDTM-ADaM Traceability Matrix</h1>

            <div class="summary">
                <p><strong>Study ID:</strong> {matrix.study_id}</p>
                <p><strong>Dataset:</strong> {matrix.dataset}</p>
                <p><strong>Generated:</strong> {matrix.generated_at.strftime('%Y-%m-%d %H:%M:%S')}</p>
                <p><strong>Total Variables:</strong> {matrix.total_variables}</p>
                <p><strong>Average Confidence:</strong> {matrix.average_confidence:.2%}</p>
            </div>

            <h2>Traceability Matrix</h2>
            <table>
                <thead>
                    <tr>
                        <th>Variable</th>
                        <th>Label</th>
                        <th>Source</th>
                        <th>Algorithm</th>
                        <th>Confidence</th>
                    </tr>
                </thead>
                <tbody>
        """

        for var in matrix.variables:
            sources = ', '.join([f"{s.domain}.{s.variable}" for s in var.sources if s.variable])
            algorithm_short = var.algorithm[:100] + '...' if len(var.algorithm) > 100 else var.algorithm
            html_content += f"""
                    <tr>
                        <td>{var.variable_name}</td>
                        <td>{var.label}</td>
                        <td>{sources}</td>
                        <td>{algorithm_short}</td>
                        <td>{var.confidence:.0%}</td>
                    </tr>
            """

        html_content += """
                </tbody>
            </table>
        </body>
        </html>
        """

        logger.info(f"Exported traceability matrix to PDF (HTML format)")
        return html_content.encode('utf-8')

    async def export_to_word(
        self,
        matrix: TraceabilityMatrix
    ) -> bytes:
        """
        Export to Word (placeholder - would use python-docx in production)
        For now, export as formatted text
        """
        content = f"""SDTM-ADaM Traceability Matrix

Study ID: {matrix.study_id}
Dataset: {matrix.dataset}
Generated: {matrix.generated_at.strftime('%Y-%m-%d %H:%M:%S')}

Statistics:
- Total Variables: {matrix.total_variables}
- Average Confidence: {matrix.average_confidence:.2%}
- High Confidence (>80%): {matrix.high_confidence_count}
- Medium Confidence (50-80%): {matrix.medium_confidence_count}
- Low Confidence (<50%): {matrix.low_confidence_count}

Traceability Matrix:
"""

        for var in matrix.variables:
            sources = ', '.join([f"{s.domain}.{s.variable}" for s in var.sources if s.variable])
            content += f"""
Variable: {var.variable_name}
Label: {var.label}
Category: {var.category}
Sources: {sources}
Algorithm: {var.algorithm}
Confidence: {var.confidence:.0%}
---
"""

        logger.info(f"Exported traceability matrix to Word (text format)")
        return content.encode('utf-8')
