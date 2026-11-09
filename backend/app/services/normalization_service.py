import re
from urllib.parse import urlparse
from typing import Optional


class NormalizationService:
    @staticmethod
    def normalize_company_name(name: str) -> str:
        """Strip extra whitespaces and standardize company name."""
        if not name:
            return ""
        return " ".join(name.strip().split())

    @staticmethod
    def normalize_domain(website_or_domain: Optional[str]) -> Optional[str]:
        """
        Extract clean, normalized apex hostname.
        Examples:
          'https://www.Example.com/path?utm=123' -> 'example.com'
          'WWW.NORTHSTARSECURITY.EXAMPLE' -> 'northstarsecurity.example'
          'cloudbridge.example/' -> 'cloudbridge.example'
        """
        if not website_or_domain:
            return None

        val = website_or_domain.strip().lower()
        if not val:
            return None

        # Prepend scheme if missing so urlparse extracts netloc reliably
        if not re.match(r"^https?://", val):
            val = f"http://{val}"

        parsed = urlparse(val)
        host = parsed.netloc or parsed.path

        # Strip standard port if present
        host = host.split(":")[0]

        # Strip www. prefix
        if host.startswith("www."):
            host = host[4:]

        # Strip trailing slashes or path fragments
        host = host.split("/")[0].strip()

        # Validate basic domain pattern
        if "." in host and len(host) > 3:
            return host
        return host if host else None

    @staticmethod
    def normalize_website(website_or_domain: Optional[str]) -> Optional[str]:
        """Return canonical https:// URL."""
        domain = NormalizationService.normalize_domain(website_or_domain)
        if not domain:
            return None
        return f"https://{domain}"
