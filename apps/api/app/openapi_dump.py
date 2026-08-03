"""Emit the OpenAPI schema to stdout. `nx run shared:codegen` pipes this into
openapi-typescript, which is how the pydantic models in models.py become the
TypeScript types the dashboard imports."""

import json

from .main import app

if __name__ == "__main__":
    print(json.dumps(app.openapi(), indent=2))
