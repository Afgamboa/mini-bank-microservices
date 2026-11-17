import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageQuery {
  page: number;
  limit: number;
}

/** Respuesta paginada reutilizable para cualquier lista: `Page<AccountEntryView>`, `Page<Transaction>`... */
export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

/** Query string común (?page=1&limit=20). `@Type` convierte el string de la URL a número. */
export class PaginationQueryDto implements PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = DEFAULT_PAGE_SIZE;
}

export function toSkipTake({ page, limit }: PageQuery): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}

export function toPage<T>(items: T[], total: number, { page, limit }: PageQuery): Page<T> {
  return { items, page, limit, total };
}

/** Transforma los items conservando la metadata de paginación (ej. fila de BD -> vista de API). */
export function mapPage<T, U>(source: Page<T>, mapper: (item: T) => U): Page<U> {
  return { ...source, items: source.items.map(mapper) };
}
