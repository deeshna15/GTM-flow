import io
import os
import csv
from typing import List, Dict, Any, Generator, Tuple
import pandas as pd
from app.utils.logger import logger

GTMFlow_STANDARD_FIELDS = [
    "company_name",
    "domain",
    "website",
    "industry",
    "country",
    "employee_count",
    "description",
]

COMMON_FIELD_ALIASES: Dict[str, List[str]] = {
    "company_name": ["company_name", "company", "account_name", "account", "organization", "name"],
    "domain": ["domain", "website", "company_domain", "web", "url"],
    "website": ["website", "url", "site", "web_url"],
    "industry": ["industry", "sector", "vertical", "category", "business_type"],
    "country": ["country", "nation", "geography", "market", "region"],
    "employee_count": ["employee_count", "employees", "headcount", "size", "staff", "num_employees"],
    "description": ["description", "about", "overview", "notes", "summary"],
}


class CSVParser:
    @staticmethod
    def detect_encoding(file_path: str) -> str:
        """Attempt reading initial bytes with common encodings."""
        for enc in ["utf-8-sig", "utf-8", "latin1", "cp1252"]:
            try:
                with open(file_path, "r", encoding=enc) as f:
                    f.read(4096)
                return enc
            except UnicodeDecodeError:
                continue
        return "utf-8"

    @staticmethod
    def get_preview_and_columns(file_path: str, max_preview: int = 20) -> Tuple[List[str], List[Dict[str, Any]], int]:
        """
        Extract headers, preview rows, and total row count.
        Works seamlessly with CSV and Excel.
        """
        ext = os.path.splitext(file_path)[1].lower()

        if ext in [".xlsx", ".xls"]:
            df = pd.read_excel(file_path)
            columns = [str(c).strip() for c in df.columns]
            preview = df.head(max_preview).fillna("").to_dict(orient="records")
            total_rows = len(df)
            return columns, preview, total_rows

        encoding = CSVParser.detect_encoding(file_path)
        with open(file_path, "r", encoding=encoding, errors="replace") as f:
            reader = csv.reader(f)
            header_row = next(reader, None)
            if not header_row:
                return [], [], 0
            columns = [c.strip() for c in header_row if c.strip()]

        # Read using pandas for fast row count and preview conversion
        df = pd.read_csv(file_path, encoding=encoding, dtype=str).fillna("")
        columns = [str(c).strip() for c in df.columns]
        preview = df.head(max_preview).to_dict(orient="records")
        total_rows = len(df)

        return columns, preview, total_rows

    @staticmethod
    def suggest_mappings(columns: List[str]) -> Dict[str, str]:
        """
        Automatically match detected CSV column headers to GTMFlow account fields.
        Returns mapping: { csv_column: gtmflow_field }
        """
        mapping: Dict[str, str] = {}
        matched_gtm_fields = set()

        for col in columns:
            col_normalized = col.strip().lower().replace(" ", "_").replace("-", "_")
            for gtm_field, aliases in COMMON_FIELD_ALIASES.items():
                if gtm_field not in matched_gtm_fields and col_normalized in aliases:
                    mapping[col] = gtm_field
                    matched_gtm_fields.add(gtm_field)
                    break

        return mapping

    @staticmethod
    def iterate_chunks(
        file_path: str,
        chunk_size: int = 100,
    ) -> Generator[List[Dict[str, Any]], None, None]:
        """
        Yield chunked records from CSV or Excel to prevent unbounded memory consumption.
        """
        ext = os.path.splitext(file_path)[1].lower()
        if ext in [".xlsx", ".xls"]:
            df = pd.read_excel(file_path)
            records = df.fillna("").to_dict(orient="records")
            for i in range(0, len(records), chunk_size):
                yield records[i : i + chunk_size]
            return

        encoding = CSVParser.detect_encoding(file_path)
        for chunk_df in pd.read_csv(
            file_path,
            encoding=encoding,
            chunksize=chunk_size,
            dtype=str,
            keep_default_na=False,
        ):
            yield chunk_df.to_dict(orient="records")
