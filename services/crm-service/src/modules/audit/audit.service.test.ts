import { AuditService } from './audit.service';
import { AuditLog } from '../../entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let mockRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(() => {
    mockRepository = {
      create: jest.fn((dto) => ({ ...dto, id: 'audit-1', createdAt: new Date() })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      find: jest.fn(() => Promise.resolve([])),
    };
    service = new AuditService(mockRepository as any);
  });

  describe('log', () => {
    it('should create an audit log entry for a create action', async () => {
      const params = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        entityType: 'account',
        entityId: 'entity-1',
        action: 'create' as const,
        newValues: { companyName: 'Acme' },
      };

      await service.log(params);

      expect(mockRepository.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        entityType: 'account',
        entityId: 'entity-1',
        action: 'create',
        oldValues: null,
        newValues: { companyName: 'Acme' },
        ipAddress: null,
      });
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should create an audit log entry for a delete action', async () => {
      const params = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        entityType: 'contact',
        entityId: 'entity-2',
        action: 'delete' as const,
        oldValues: { firstName: 'John' },
      };

      await service.log(params);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          oldValues: { firstName: 'John' },
          newValues: null,
        }),
      );
    });

    it('should store ipAddress when provided', async () => {
      await service.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        entityType: 'account',
        entityId: 'entity-1',
        action: 'update',
        ipAddress: '192.168.1.1',
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: '192.168.1.1' }),
      );
    });
  });

  describe('findByEntity', () => {
    it('should query by tenantId, entityType, and entityId', async () => {
      const mockLogs: Partial<AuditLog>[] = [
        { id: 'a1', action: 'create', createdAt: new Date() },
      ];
      mockRepository.find.mockResolvedValue(mockLogs);

      const result = await service.findByEntity('t1', 'account', 'e1');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { tenantId: 't1', entityType: 'account', entityId: 'e1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockLogs);
    });
  });
});
