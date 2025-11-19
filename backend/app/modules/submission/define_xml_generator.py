"""
Define-XML 2.1 generator for ADAM datasets
Generates CDISC-compliant Define.xml with sponsor placeholders
"""

import xml.etree.ElementTree as ET
from xml.dom import minidom
from typing import List, Optional
from pathlib import Path
from datetime import datetime
import hashlib

from .models import StudyInfo, DatasetInfo, DefineXMLResponse, ArtifactRef


class DefineXMLGenerator:
    """
    Generates Define-XML 2.1 for ADAM datasets
    Following CDISC ODM-XML standard
    """
    
    def __init__(self):
        self.ns = {
            "odm": "http://www.cdisc.org/ns/odm/v1.3",
            "def": "http://www.cdisc.org/ns/def/v2.1",
            "xlink": "http://www.w3.org/1999/xlink"
        }
    
    def _create_odm_root(self, study_info: StudyInfo) -> ET.Element:
        """Create ODM root element with namespaces"""
        root = ET.Element("ODM")
        root.set("xmlns", self.ns["odm"])
        root.set("xmlns:def", self.ns["def"])
        root.set("xmlns:xlink", self.ns["xlink"])
        root.set("ODMVersion", "1.3.2")
        root.set("FileOID", f"Define-XML.{study_info.study_id}")
        root.set("FileType", "Snapshot")
        root.set("CreationDateTime", datetime.utcnow().isoformat())
        
        return root
    
    def _add_study(
        self,
        root: ET.Element,
        study_info: StudyInfo,
        datasets: List[DatasetInfo]
    ) -> None:
        """Add Study element with metadata definitions"""
        study = ET.SubElement(root, "Study")
        study.set("OID", f"Study.{study_info.study_id}")
        
        # Global Variables
        gv = ET.SubElement(study, "GlobalVariables")
        
        study_name = ET.SubElement(gv, "StudyName")
        study_name.text = study_info.study_name
        
        study_desc = ET.SubElement(gv, "StudyDescription")
        study_desc.text = study_info.description or f"{study_info.study_name} - ADAM Analysis Datasets"
        
        protocol_name = ET.SubElement(gv, "ProtocolName")
        protocol_name.text = study_info.protocol_number
        
        # MetaDataVersion
        mdv = ET.SubElement(study, "MetaDataVersion")
        mdv.set("OID", "MDV.1")
        mdv.set("Name", f"Study {study_info.study_id} - ADAM Datasets")
        mdv.set("def:DefineVersion", "2.1")
        mdv.set("def:StandardName", "ADaM-IG")
        mdv.set("def:StandardVersion", study_info.adam_ig_version)
        
        # Add dataset definitions
        for dataset in datasets:
            self._add_item_group_def(mdv, dataset)
    
    def _add_item_group_def(
        self,
        mdv: ET.Element,
        dataset: DatasetInfo
    ) -> None:
        """Add ItemGroupDef for a dataset"""
        igd = ET.SubElement(mdv, "ItemGroupDef")
        igd.set("OID", f"IG.{dataset.name}")
        igd.set("Name", dataset.name)
        igd.set("Repeating", "Yes")
        igd.set("def:Structure", dataset.structure)
        igd.set("def:Class", dataset.class_type)
        igd.set("def:Label", dataset.label)
        
        # Add key variables
        if dataset.key_variables:
            key_seq = 1
            for key_var in dataset.key_variables:
                key = ET.SubElement(igd, "def:leaf")
                key.set("ID", f"LF.{dataset.name}.{key_var}")
                key.set("xlink:href", f"#{key_var}")
                key_title = ET.SubElement(key, "def:title")
                key_title.text = key_var
                key_seq += 1
        
        # Add variable references
        for idx, var_info in enumerate(dataset.variables, 1):
            item_ref = ET.SubElement(igd, "ItemRef")
            item_ref.set("ItemOID", f"IT.{var_info['name']}")
            item_ref.set("OrderNumber", str(idx))
            item_ref.set("Mandatory", "Yes" if var_info.get("required", False) else "No")
    
    def generate(
        self,
        study_info: StudyInfo,
        datasets: List[DatasetInfo],
        output_dir: Optional[Path] = None,
        stylesheet_link: Optional[str] = None
    ) -> DefineXMLResponse:
        """
        Generate Define-XML 2.1 file
        
        Args:
            study_info: Study metadata
            datasets: List of dataset information
            output_dir: Output directory (default: Content/Submissions/{study_id}/definexml/)
            stylesheet_link: Optional XSL stylesheet reference
        
        Returns:
            DefineXMLResponse with artifact reference
        """
        # Create output directory
        if output_dir is None:
            output_dir = Path(__file__).parents[4] / "Content" / "Submissions" / study_info.study_id / "definexml"
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate XML
        root = self._create_odm_root(study_info)
        self._add_study(root, study_info, datasets)
        
        # Convert to pretty-printed string
        xml_str = self._prettify_xml(root)
        
        # Add stylesheet processing instruction if provided
        if stylesheet_link:
            xml_str = f'<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="{stylesheet_link}"?>\n' + xml_str
        
        # Write to file
        output_file = output_dir / f"define_{study_info.study_id}_adam.xml"
        output_file.write_text(xml_str, encoding="utf-8")
        
        # Calculate checksum
        checksum = hashlib.sha256(xml_str.encode()).hexdigest()
        
        # Create artifact reference
        artifact = ArtifactRef(
            name=output_file.name,
            path=str(output_file),
            created_at=datetime.utcnow().isoformat(),
            checksum=checksum,
            size_bytes=output_file.stat().st_size
        )
        
        warnings = []
        if not stylesheet_link:
            warnings.append("No stylesheet provided - XML will render without formatting")
        
        return DefineXMLResponse(artifact=artifact, warnings=warnings)
    
    def _prettify_xml(self, elem: ET.Element) -> str:
        """Return pretty-printed XML string"""
        rough_string = ET.tostring(elem, encoding="utf-8")
        reparsed = minidom.parseString(rough_string)
        return reparsed.toprettyxml(indent="  ", encoding="UTF-8").decode("utf-8")
