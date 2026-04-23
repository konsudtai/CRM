import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

const DEFAULT_PREFIX = 'QT';

/**
 * Generates sequential quotation numbers per tenant using the
 * `quotation_sequences` table with `SELECT ... FOR UPDATE` to
 * prevent gaps under concurrency.
 *
 * Format: {prefix}-{year}-{zero_padded_4_digit_sequence}
 * Example: QT-2025-0001
 */
@Injectable()
export class QuotationNumberingService {
  constructor(private readonly dataSource: DataSource) {}

  async getNextNumber(tenantId: string, prefix?: string): Promise<string> {
    const pfx = prefix ?? DEFAULT_PREFIX;
    const year = new Date().getFullYear();

    return this.dataSource.transaction(async (manager) => {
      // Lock the row for this tenant+prefix+year
      const rows = await manager.query(
        `SELECT id, current_value FROM quotation_sequences
         WHERE tenant_id = $1 AND prefix = $2 AND year = $3
         FOR UPDATE`,
        [tenantId, pfx, year],
      );

      let nextValue: number;

      if (rows.length === 0) {
        // First quotation for this tenant+prefix+year — insert starting at 1
        nextValue = 1;
        await manager.query(
          `INSERT INTO quotation_sequences (id, tenant_id, prefix, year, current_value)
           VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
          [tenantId, pfx, year, nextValue],
        );
      } else {
        nextValue = rows[0].current_value + 1;
        await manager.query(
          `UPDATE quotation_sequences SET current_value = $1 WHERE id = $2`,
          [nextValue, rows[0].id],
        );
      }

      const paddedSeq = String(nextValue).padStart(4, '0');
      return `${pfx}-${year}-${paddedSeq}`;
    });
  }
}
