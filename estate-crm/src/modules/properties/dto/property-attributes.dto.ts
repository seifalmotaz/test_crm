import { z } from 'zod';
import { AppError } from '@/common/errors/app-error';
import { ErrorCodes } from '@/common/errors/error-codes';
import { PropertyType } from '@/modules/properties/enums/property-type.enum';

/**
 * Shared base for property attribute schemas.
 */
const BaseAttributesSchema = z.object({
  amenities: z.array(z.string()).optional(),
  furnishing: z.string().optional(),
  parkingSpots: z.number().int().nonnegative().optional(),
  floorNumber: z.number().int().nonnegative().optional(),
  totalFloors: z.number().int().nonnegative().optional(),
  view: z.string().optional(),
});

export const ApartmentAttributesSchema = BaseAttributesSchema.extend({
  unitNumber: z.string().optional(),
  floorNumber: z.number().int().nonnegative(),
  totalFloors: z.number().int().nonnegative(),
  balconyArea: z.number().nonnegative().optional(),
  hasElevator: z.boolean().optional(),
  hasGenerator: z.boolean().optional(),
});

export const VillaAttributesSchema = BaseAttributesSchema.extend({
  plotSize: z.number().nonnegative().optional(),
  builtUpArea: z.number().nonnegative().optional(),
  hasPool: z.boolean().optional(),
  hasGarden: z.boolean().optional(),
  hasMaidsRoom: z.boolean().optional(),
  floors: z.number().int().nonnegative().optional(),
});

export const CommercialAttributesSchema = BaseAttributesSchema.extend({
  commercialType: z.enum(['office', 'retail', 'warehouse', 'showroom']).optional(),
  leaseTerm: z.number().int().nonnegative().optional(),
  hasReception: z.boolean().optional(),
  grade: z.enum(['A', 'B', 'C']).optional(),
});

export const LandAttributesSchema = z.object({
  plotSize: z.number().nonnegative().optional(),
  dimensions: z.string().optional(),
  zoning: z.string().optional(),
  utilitiesAvailable: z.boolean().optional(),
  roadAccess: z.boolean().optional(),
  cornerPlot: z.boolean().optional(),
});

export const TownhouseAttributesSchema = BaseAttributesSchema.extend({
  builtUpArea: z.number().nonnegative().optional(),
  hasPool: z.boolean().optional(),
  hasGarden: z.boolean().optional(),
  hasMaidsRoom: z.boolean().optional(),
  floors: z.number().int().nonnegative().optional(),
  endUnit: z.boolean().optional(),
});

/**
 * Discriminated union of property attribute schemas keyed by type.
 */
export const PropertyAttributesSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(PropertyType.APARTMENT), attributes: ApartmentAttributesSchema }),
  z.object({ type: z.literal(PropertyType.VILLA), attributes: VillaAttributesSchema }),
  z.object({ type: z.literal(PropertyType.COMMERCIAL), attributes: CommercialAttributesSchema }),
  z.object({ type: z.literal(PropertyType.LAND), attributes: LandAttributesSchema }),
  z.object({ type: z.literal(PropertyType.TOWNHOUSE), attributes: TownhouseAttributesSchema }),
]);

/**
 * Inferred type from the discriminated union.
 */
export type PropertyAttributes = z.infer<typeof PropertyAttributesSchema>;

/**
 * Validates property attributes against the type-specific schema.
 * Throws an AppError with VALIDATION_ERROR code and Zod error format on failure.
 *
 * @param type - The property type
 * @param attributes - The raw attributes object to validate
 * @returns The validated attributes
 */
export function validatePropertyAttributes(type: PropertyType, attributes: Record<string, unknown>): Record<string, unknown> {
  const result = PropertyAttributesSchema.safeParse({ type, attributes });

  if (!result.success) {
    const formattedErrors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      400,
      `Property attributes validation failed: ${JSON.stringify(formattedErrors)}`,
    );
  }

  return result.data.attributes as Record<string, unknown>;
}