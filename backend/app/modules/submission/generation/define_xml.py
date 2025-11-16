"""
Define.xml 2.1 Generator

Generates CDISC Define-XML 2.1 compliant metadata files for ADaM datasets.
Includes dataset descriptions, variable metadata, and codelist references.
"""

from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from loguru import logger


class DefineXMLGenerator:
    """
    Generates Define-XML 2.1 files for ADaM datasets.
    Compliant with CDISC Define-XML 2.1 standard.
    """

    def __init__(self, base_path: Path = None):
        if base_path is None:
            base_path = Path("Content/Submissions")
        self.base_path = base_path

    async def generate(
        self,
        study_id: str,
        datasets: List[str],
        options: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate Define.xml file.
        
        Args:
            study_id: Study identifier
            datasets: List of dataset names to include
            options: Generation options (template, stylesheet, etc.)
            
        Returns:
            Path to generated Define.xml file
        """
        logger.info(f"Generating Define.xml for {study_id}: {datasets}")

        # Set default options
        opts = options or {}
        include_variable_docs = opts.get("include_variable_docs", True)
        include_codelist_refs = opts.get("include_codelist_refs", True)
        add_stylesheet = opts.get("add_stylesheet", True)
        template = opts.get("template", "fda_standard")

        # Create output directory
        output_dir = self.base_path / study_id / "definexml"
        output_dir.mkdir(parents=True, exist_ok=True)

        # Generate XML structure
        xml_content = self._generate_xml_structure(
            study_id=study_id,
            datasets=datasets,
            include_variable_docs=include_variable_docs,
            include_codelist_refs=include_codelist_refs,
            add_stylesheet=add_stylesheet
        )

        # Write to file
        output_file = output_dir / "define.xml"
        output_file.write_text(xml_content, encoding="utf-8")

        logger.info(f"Define.xml generated: {output_file}")
        return str(output_file)

    def _generate_xml_structure(
        self,
        study_id: str,
        datasets: List[str],
        include_variable_docs: bool,
        include_codelist_refs: bool,
        add_stylesheet: bool
    ) -> str:
        """Generate Define-XML 2.1 structure"""
        
        # XML header
        xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
        
        if add_stylesheet:
            xml += '<?xml-stylesheet type="text/xsl" href="define2-1.xsl"?>\n'
        
        # Root element with namespaces
        xml += '''<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3"
    xmlns:def="http://www.cdisc.org/ns/def/v2.1"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    ODMVersion="1.3.2"
    FileType="Snapshot"
    FileOID="define.xml"
    CreationDateTime="''' + datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S") + '''">\n'''

        # Study metadata
        xml += f'''  <Study OID="{study_id}">
    <GlobalVariables>
      <StudyName>{study_id}</StudyName>
      <StudyDescription>ADaM Analysis Datasets</StudyDescription>
      <ProtocolName>{study_id}</ProtocolName>
    </GlobalVariables>
    
    <MetaDataVersion OID="MDV.{study_id}.1" Name="{study_id} Analysis Data" def:DefineVersion="2.1">
      <def:Standard OID="STD.1" Name="ADaM-IG" Version="1.3" Type="IG"/>
      
'''

        # Dataset definitions
        for dataset in datasets:
            xml += self._generate_dataset_def(dataset, include_variable_docs)

        # Codelist definitions (if requested)
        if include_codelist_refs:
            xml += self._generate_codelists()

        # Close tags
        xml += '''    </MetaDataVersion>
  </Study>
</ODM>
'''

        return xml

    def _generate_dataset_def(self, dataset: str, include_variables: bool) -> str:
        """Generate dataset definition"""
        
        xml = f'''      <ItemGroupDef OID="IG.{dataset}" Name="{dataset}" Repeating="Yes" 
                    def:Class="ADAM" def:Structure="One record per subject" 
                    def:Label="{self._get_dataset_label(dataset)}"
                    def:DomainKeys="">
        <Description>
          <TranslatedText xml:lang="en">{self._get_dataset_description(dataset)}</TranslatedText>
        </Description>
'''

        if include_variables:
            # TODO: Load actual variable metadata from specification
            # For now, include common variables
            common_vars = self._get_common_variables(dataset)
            for var in common_vars:
                xml += f'''        <ItemRef ItemOID="IT.{dataset}.{var['name']}" OrderNumber="{var['order']}" Mandatory="Yes"/>\n'''

        xml += '      </ItemGroupDef>\n\n'
        return xml

    def _get_dataset_label(self, dataset: str) -> str:
        """Get dataset label"""
        labels = {
            "ADSL": "Subject Level Analysis Dataset",
            "ADAE": "Adverse Events Analysis Dataset",
            "ADLB": "Laboratory Analysis Dataset",
            "ADVS": "Vital Signs Analysis Dataset",
            "ADTTE": "Time-to-Event Analysis Dataset"
        }
        return labels.get(dataset.upper(), f"{dataset} Analysis Dataset")

    def _get_dataset_description(self, dataset: str) -> str:
        """Get dataset description"""
        descriptions = {
            "ADSL": "One record per subject. Contains demographic and baseline characteristics.",
            "ADAE": "One record per adverse event per subject. Contains all AE data.",
            "ADLB": "One record per laboratory parameter per subject per visit.",
            "ADVS": "One record per vital sign parameter per subject per visit.",
            "ADTTE": "One record per time-to-event parameter per subject."
        }
        return descriptions.get(dataset.upper(), f"{dataset} analysis dataset")

    def _get_common_variables(self, dataset: str) -> List[Dict[str, Any]]:
        """Get common variables for dataset"""
        # Simplified - would load from specification in real implementation
        if dataset.upper() == "ADSL":
            return [
                {"name": "STUDYID", "order": 1},
                {"name": "USUBJID", "order": 2},
                {"name": "SUBJID", "order": 3},
                {"name": "AGE", "order": 4},
                {"name": "SEX", "order": 5},
                {"name": "RACE", "order": 6},
            ]
        return []

    def _generate_codelists(self) -> str:
        """Generate codelist definitions"""
        xml = '''      <!-- Codelists -->
      <CodeList OID="CL.SEX" Name="Sex" DataType="text">
        <CodeListItem CodedValue="M">
          <Decode><TranslatedText xml:lang="en">Male</TranslatedText></Decode>
        </CodeListItem>
        <CodeListItem CodedValue="F">
          <Decode><TranslatedText xml:lang="en">Female</TranslatedText></Decode>
        </CodeListItem>
      </CodeList>
      
'''
        return xml
