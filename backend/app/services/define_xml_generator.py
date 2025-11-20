"""
Define-XML v2.1 Generator
Generates ODM-XML format Define-XML for regulatory submissions

Complies with:
- CDISC Define-XML v2.1
- ODM v1.3.2
- FDA eSub requirements
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from lxml import etree
from lxml.builder import E
from loguru import logger


class DefineXMLGenerator:
    """
    Generate Define-XML v2.1 compliant metadata

    Define-XML is required for regulatory submissions and provides:
    - Dataset metadata
    - Variable definitions
    - Controlled terminology
    - Computational methods
    - Analysis results metadata
    """

    # XML Namespaces
    NAMESPACES = {
        None: "http://www.cdisc.org/ns/odm/v1.3",
        "xlink": "http://www.w3.org/1999/xlink",
        "def": "http://www.cdisc.org/ns/def/v2.1",
        "arm": "http://www.cdisc.org/ns/arm/v1.0"
    }

    def __init__(
        self,
        study_id: str,
        study_name: str,
        protocol: str,
        sponsor: str = "",
        description: str = ""
    ):
        self.study_id = study_id
        self.study_name = study_name
        self.protocol = protocol
        self.sponsor = sponsor
        self.description = description

    def generate(
        self,
        datasets: List[Dict[str, Any]],
        adam_ig_version: str = "2.1"
    ) -> str:
        """
        Generate complete Define-XML document

        Args:
            datasets: List of dataset metadata
                Each dataset should have:
                - name: Dataset name (ADSL, ADAE, etc.)
                - label: Dataset label
                - structure: Dataset structure description
                - class: Dataset class (ADAM)
                - variables: List of variable definitions
            adam_ig_version: ADAM IG version

        Returns:
            XML string
        """
        logger.info(f"Generating Define-XML for study {self.study_id}")

        # Create root ODM element
        root = self._create_odm_root()

        # Add Study element
        study = self._create_study_element()
        root.append(study)

        # Add GlobalVariables
        global_vars = self._create_global_variables()
        study.append(global_vars)

        # Add MetaDataVersion
        metadata_version = self._create_metadata_version(adam_ig_version)
        study.append(metadata_version)

        # Add datasets and variables
        for dataset in datasets:
            # Create ItemGroupDef (dataset)
            item_group = self._create_item_group(dataset)
            metadata_version.append(item_group)

            # Create ItemDef for each variable
            for variable in dataset.get("variables", []):
                item_def = self._create_item_def(variable, dataset["name"])
                metadata_version.append(item_def)

                # Add CodeList if variable has controlled terminology
                if variable.get("codelist"):
                    code_list = self._create_code_list(variable)
                    metadata_version.append(code_list)

        # Add MethodDef elements (computational methods)
        for dataset in datasets:
            for variable in dataset.get("variables", []):
                if variable.get("method"):
                    method_def = self._create_method_def(variable)
                    if method_def is not None and not self._method_exists(metadata_version, variable.get("method_id")):
                        metadata_version.append(method_def)

        # Convert to string
        xml_str = etree.tostring(
            root,
            pretty_print=True,
            xml_declaration=True,
            encoding="UTF-8",
            doctype='<!DOCTYPE ODM SYSTEM "define2-1-0.dtd">'
        ).decode()

        logger.info("Define-XML generation complete")
        return xml_str

    def _create_odm_root(self) -> etree.Element:
        """Create ODM root element"""
        nsmap = {k: v for k, v in self.NAMESPACES.items() if k is not None}
        nsmap[None] = self.NAMESPACES[None]

        return etree.Element(
            "ODM",
            {
                "ODMVersion": "1.3.2",
                "FileOID": f"Define-XML_{self.study_id}_{datetime.now().strftime('%Y%m%d')}",
                "FileType": "Snapshot",
                "CreationDateTime": datetime.now().isoformat(),
                f"{{{self.NAMESPACES['def']}}}Context": "Submission"
            },
            nsmap=nsmap
        )

    def _create_study_element(self) -> etree.Element:
        """Create Study element"""
        return etree.Element("Study", OID=f"Study.{self.study_id}")

    def _create_global_variables(self) -> etree.Element:
        """Create GlobalVariables element"""
        global_vars = etree.Element("GlobalVariables")

        # StudyName
        study_name_elem = etree.SubElement(global_vars, "StudyName")
        study_name_elem.text = self.study_name

        # StudyDescription
        if self.description:
            study_desc = etree.SubElement(global_vars, "StudyDescription")
            study_desc.text = self.description

        # ProtocolName
        protocol_name = etree.SubElement(global_vars, "ProtocolName")
        protocol_name.text = self.protocol

        return global_vars

    def _create_metadata_version(self, adam_ig_version: str) -> etree.Element:
        """Create MetaDataVersion element"""
        return etree.Element(
            "MetaDataVersion",
            {
                "OID": f"MDV.{self.study_id}.001",
                "Name": "ADAM Metadata",
                "Description": "Analysis Dataset Metadata",
                f"{{{self.NAMESPACES['def']}}}DefineVersion": "2.1.0",
                f"{{{self.NAMESPACES['def']}}}StandardName": "ADaM-IG",
                f"{{{self.NAMESPACES['def']}}}StandardVersion": adam_ig_version
            }
        )

    def _create_item_group(self, dataset: Dict[str, Any]) -> etree.Element:
        """Create ItemGroupDef for a dataset"""
        dataset_name = dataset["name"]
        is_adsl = dataset_name == "ADSL"

        item_group = etree.Element(
            "ItemGroupDef",
            {
                "OID": f"IG.{dataset_name}",
                "Name": dataset_name,
                "Repeating": "No" if is_adsl else "Yes",
                "IsReferenceData": "No",
                "SASDatasetName": dataset_name,
                f"{{{self.NAMESPACES['def']}}}Class": "ADAM",
                f"{{{self.NAMESPACES['def']}}}Structure": dataset.get("structure", "One record per subject" if is_adsl else "One record per subject per analysis"),
                f"{{{self.NAMESPACES['def']}}}Purpose": dataset.get("purpose", "Analysis"),
                f"{{{self.NAMESPACES['def']}}}ArchiveLocationID": f"LOC.{dataset_name}"
            }
        )

        # Description
        desc = etree.SubElement(item_group, "Description")
        translated_text = etree.SubElement(desc, "TranslatedText")
        translated_text.set("{http://www.w3.org/XML/1998/namespace}lang", "en")
        translated_text.text = dataset.get("label", dataset_name)

        # Add ItemRef for each variable
        for idx, variable in enumerate(dataset.get("variables", []), 1):
            item_ref = etree.SubElement(
                item_group,
                "ItemRef",
                {
                    "ItemOID": f"IT.{dataset_name}.{variable['name']}",
                    "OrderNumber": str(idx),
                    "Mandatory": "Yes" if variable.get("required") else "No"
                }
            )

            # Add method reference if exists
            if variable.get("method_id"):
                item_ref.set("MethodOID", variable["method_id"])

        # Add leaf reference (dataset location)
        leaf = etree.SubElement(
            item_group,
            f"{{{self.NAMESPACES['def']}}}leaf",
            {
                "ID": f"LOC.{dataset_name}",
                f"{{{self.NAMESPACES['xlink']}}}href": f"./{dataset_name.lower()}.xpt"
            }
        )

        return item_group

    def _create_item_def(self, variable: Dict[str, Any], dataset_name: str) -> etree.Element:
        """Create ItemDef for a variable"""
        var_name = variable["name"]

        # Determine data type
        var_type = variable.get("type", "text").lower()
        odm_datatype = {
            "char": "text",
            "num": "float",
            "date": "date",
            "datetime": "datetime"
        }.get(var_type, "text")

        # Create ItemDef
        item_def_attrs = {
            "OID": f"IT.{dataset_name}.{var_name}",
            "Name": var_name,
            "DataType": odm_datatype,
            "SASFieldName": var_name
        }

        # Add length
        if variable.get("length"):
            item_def_attrs["Length"] = str(variable["length"])

        # Add display format
        if variable.get("format"):
            item_def_attrs["DisplayFormat"] = variable["format"]

        item_def = etree.Element("ItemDef", item_def_attrs)

        # Description (label)
        desc = etree.SubElement(item_def, "Description")
        translated_text = etree.SubElement(desc, "TranslatedText")
        translated_text.set("{http://www.w3.org/XML/1998/namespace}lang", "en")
        translated_text.text = variable.get("label", var_name)

        # Add CodeListRef if variable has controlled terminology
        if variable.get("codelist"):
            code_list_ref = etree.SubElement(
                item_def,
                "CodeListRef",
                CodeListOID=f"CL.{variable['codelist']}"
            )

        # Add origin
        origin_type = variable.get("origin", "Derived")
        origin = etree.SubElement(
            item_def,
            f"{{{self.NAMESPACES['def']}}}Origin",
            Type=origin_type
        )

        # Add source if predecessor variable
        if variable.get("source"):
            source_desc = etree.SubElement(origin, "Description")
            source_text = etree.SubElement(source_desc, "TranslatedText")
            source_text.set("{http://www.w3.org/XML/1998/namespace}lang", "en")
            source_text.text = f"Source: {variable['source']}"

        return item_def

    def _create_code_list(self, variable: Dict[str, Any]) -> etree.Element:
        """Create CodeList element"""
        codelist_name = variable.get("codelist", "")

        code_list = etree.Element(
            "CodeList",
            {
                "OID": f"CL.{codelist_name}",
                "Name": codelist_name,
                "DataType": "text"
            }
        )

        # Add CodeListItem elements
        for code_item in variable.get("codelist_items", []):
            code_list_item = etree.SubElement(
                code_list,
                "CodeListItem",
                CodedValue=code_item["code"]
            )

            # Decode
            decode = etree.SubElement(code_list_item, "Decode")
            translated_text = etree.SubElement(decode, "TranslatedText")
            translated_text.set("{http://www.w3.org/XML/1998/namespace}lang", "en")
            translated_text.text = code_item.get("decode", code_item["code"])

        return code_list

    def _create_method_def(self, variable: Dict[str, Any]) -> Optional[etree.Element]:
        """Create MethodDef for computational method"""
        if not variable.get("method"):
            return None

        method_id = variable.get("method_id", f"MT.{variable['name']}")

        method_def = etree.Element(
            "MethodDef",
            {
                "OID": method_id,
                "Name": f"Method for {variable['name']}",
                "Type": "Computation"
            }
        )

        # Description (computational algorithm)
        desc = etree.SubElement(method_def, "Description")
        translated_text = etree.SubElement(desc, "TranslatedText")
        translated_text.set("{http://www.w3.org/XML/1998/namespace}lang", "en")
        translated_text.text = variable["method"]

        # Add formal expression if code is available
        if variable.get("code"):
            formal_expr = etree.SubElement(
                method_def,
                "FormalExpression",
                Context="R" if variable.get("language") == "R" else "SAS"
            )
            formal_expr.text = variable["code"]

        return method_def

    def _method_exists(self, metadata_version: etree.Element, method_id: str) -> bool:
        """Check if method already exists"""
        existing_methods = metadata_version.findall("MethodDef")
        return any(m.get("OID") == method_id for m in existing_methods)

    def validate(self, xml_content: str) -> Dict[str, Any]:
        """
        Validate Define-XML against XSD schema

        Args:
            xml_content: XML content to validate

        Returns:
            Validation result
        """
        logger.info("Validating Define-XML")

        try:
            # Parse XML
            doc = etree.fromstring(xml_content.encode())

            # TODO: Load and validate against Define-XML 2.1 XSD schema
            # schema_path = "schemas/define-xml-2.1.xsd"
            # schema_doc = etree.parse(schema_path)
            # schema = etree.XMLSchema(schema_doc)
            # is_valid = schema.validate(doc)

            # For now, just check if it's well-formed XML
            is_valid = doc is not None

            return {
                "valid": is_valid,
                "errors": [],
                "warnings": [],
                "message": "XML is well-formed" if is_valid else "XML validation failed"
            }

        except etree.XMLSyntaxError as e:
            logger.error(f"XML syntax error: {e}")
            return {
                "valid": False,
                "errors": [str(e)],
                "warnings": [],
                "message": "XML syntax error"
            }


class DefineXMLService:
    """Service for managing Define-XML generation and storage"""

    def __init__(self):
        self.generated_defines = {}  # In-memory storage (will be replaced with database)

    async def generate_define_xml(
        self,
        study_id: str,
        study_name: str,
        protocol: str,
        datasets: List[Dict[str, Any]],
        adam_ig_version: str = "2.1"
    ) -> Dict[str, Any]:
        """
        Generate and store Define-XML

        Returns:
            Dictionary with define_id, xml_content, and validation results
        """
        generator = DefineXMLGenerator(
            study_id=study_id,
            study_name=study_name,
            protocol=protocol
        )

        # Generate XML
        xml_content = generator.generate(datasets, adam_ig_version)

        # Validate
        validation_result = generator.validate(xml_content)

        # Store
        define_id = f"DEFINE_{study_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        self.generated_defines[define_id] = {
            "define_id": define_id,
            "study_id": study_id,
            "xml_content": xml_content,
            "validation": validation_result,
            "generated_at": datetime.now().isoformat(),
            "adam_ig_version": adam_ig_version
        }

        logger.info(f"Define-XML generated: {define_id}")

        return self.generated_defines[define_id]

    async def get_define_xml(self, define_id: str) -> Optional[Dict[str, Any]]:
        """Get Define-XML by ID"""
        return self.generated_defines.get(define_id)


# Global service instance
_define_xml_service = None


def get_define_xml_service() -> DefineXMLService:
    """Get or create Define-XML service singleton"""
    global _define_xml_service
    if _define_xml_service is None:
        _define_xml_service = DefineXMLService()
    return _define_xml_service
