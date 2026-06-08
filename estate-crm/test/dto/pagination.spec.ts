import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginationDto } from '@/common/dto/pagination.dto';

describe('Pagination DTO', () => {
  async function validatePagination(input: Record<string, unknown>) {
    const dto = plainToInstance(PaginationDto, input);
    return validate(dto);
  }

  describe('defaults', () => {
    it('should return default values for empty input', async () => {
      const errors = await validatePagination({});
      expect(errors.length).toBe(0);

      const dto = plainToInstance(PaginationDto, {});
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
      expect(dto.sortBy).toBe('createdAt');
      expect(dto.sortOrder).toBe('desc');
      expect(dto.search).toBeUndefined();
    });
  });

  describe('coercion', () => {
    it('should coerce string numbers to integers', async () => {
      const dto = plainToInstance(PaginationDto, { page: '3', limit: '50' });
      expect(dto.page).toBe(3);
      expect(dto.limit).toBe(50);
      expect(typeof dto.page).toBe('number');
    });
  });

  describe('custom values', () => {
    it('should accept custom sort parameters', async () => {
      const errors = await validatePagination({
        sortBy: 'name',
        sortOrder: 'asc',
      });
      expect(errors.length).toBe(0);

      const dto = plainToInstance(PaginationDto, {
        sortBy: 'name',
        sortOrder: 'asc',
      });
      expect(dto.sortBy).toBe('name');
      expect(dto.sortOrder).toBe('asc');
    });

    it('should accept optional search parameter', async () => {
      const errors = await validatePagination({ search: 'test query' });
      expect(errors.length).toBe(0);

      const dto = plainToInstance(PaginationDto, { search: 'test query' });
      expect(dto.search).toBe('test query');
    });
  });

  describe('validation', () => {
    it('should reject page = 0', async () => {
      const errors = await validatePagination({ page: 0 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject negative page', async () => {
      const errors = await validatePagination({ page: -1 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject limit > 100', async () => {
      const errors = await validatePagination({ limit: 200 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject limit = 0', async () => {
      const errors = await validatePagination({ limit: 0 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid sortOrder', async () => {
      const errors = await validatePagination({ sortOrder: 'random' });
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
