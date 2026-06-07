# JSONB Property Attributes with Zod Validation

Real estate properties have wildly different attributes depending on type — apartments have floor numbers and elevators, villas have plot size and pools, commercial has frontage and license type. Rather than a static schema with many nullable columns or complex polymorphic tables, we store type-specific data in a PostgreSQL JSONB `attributes` column.

Each `PropertyType` (apartment, villa, commercial, townhouse, land) has a strict Zod schema that validates the JSONB shape at runtime. TypeScript discriminated unions provide compile-time safety. PostgreSQL GIN indexes support JSONB queries.

This gives us flexibility to add new property types without schema migrations, while maintaining strict type safety at the application layer.

**Considered options**: Static schema (wasteful, confusing null columns), polymorphic tables (clean but complex queries), EAV (terrible performance), JSONB with Zod (flexible, type-safe, queryable).
