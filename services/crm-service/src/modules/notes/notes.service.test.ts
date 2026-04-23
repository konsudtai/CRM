import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotesService } from './notes.service';
import { Note } from '../../entities/note.entity';
import { Attachment } from '../../entities/attachment.entity';
import { Activity } from '../../entities/activity.entity';
import { Account } from '../../entities/account.entity';
import { S3_CLIENT } from '../../providers/s3.provider';

describe('NotesService', () => {
  let service: NotesService;

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const accountId = '22222222-2222-2222-2222-222222222222';
  const userId = '33333333-3333-3333-3333-333333333333';

  const mockNoteRepo = {
    create: jest.fn((data: any) => data),
    save: jest.fn((data: any) =>
      Promise.resolve({ id: 'note-1', ...data, createdAt: new Date() }),
    ),
  };

  const mockAttachmentRepo = {
    create: jest.fn((data: any) => data),
    save: jest.fn((data: any) =>
      Promise.resolve({ id: 'att-1', ...data }),
    ),
  };

  const mockActivityRepo = {
    create: jest.fn((data: any) => data),
    save: jest.fn((data: any) => Promise.resolve({ id: 'act-1', ...data })),
  };

  const mockAccountRepo = {
    findOne: jest.fn(),
  };

  const mockS3Client = {
    send: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: getRepositoryToken(Note), useValue: mockNoteRepo },
        { provide: getRepositoryToken(Attachment), useValue: mockAttachmentRepo },
        { provide: getRepositoryToken(Activity), useValue: mockActivityRepo },
        { provide: getRepositoryToken(Account), useValue: mockAccountRepo },
        { provide: S3_CLIENT, useValue: mockS3Client },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
    jest.clearAllMocks();
  });

  it('should create a note without attachments', async () => {
    mockAccountRepo.findOne.mockResolvedValue({ id: accountId, tenantId });

    const result = await service.createNote(tenantId, accountId, userId, {
      content: 'Test note',
    });

    expect(result).toMatchObject({
      tenantId,
      entityType: 'account',
      entityId: accountId,
      content: 'Test note',
      authorId: userId,
    });
    expect(mockActivityRepo.save).toHaveBeenCalled();
  });

  it('should create a note with attachments and upload to S3', async () => {
    mockAccountRepo.findOne.mockResolvedValue({ id: accountId, tenantId });

    const result = await service.createNote(tenantId, accountId, userId, {
      content: 'Note with file',
      attachments: [
        {
          fileName: 'doc.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
          fileContent: Buffer.from('test').toString('base64'),
        },
      ],
    });

    expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    expect(mockAttachmentRepo.save).toHaveBeenCalled();
    expect(result.attachments).toHaveLength(1);
  });

  it('should throw NotFoundException if account does not exist', async () => {
    mockAccountRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createNote(tenantId, accountId, userId, { content: 'test' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject files exceeding 10MB', async () => {
    mockAccountRepo.findOne.mockResolvedValue({ id: accountId, tenantId });

    await expect(
      service.createNote(tenantId, accountId, userId, {
        content: 'big file',
        attachments: [
          {
            fileName: 'huge.bin',
            mimeType: 'application/octet-stream',
            fileSize: 11 * 1024 * 1024,
            fileContent: 'dGVzdA==',
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should create an activity record when note is created', async () => {
    mockAccountRepo.findOne.mockResolvedValue({ id: accountId, tenantId });

    await service.createNote(tenantId, accountId, userId, {
      content: 'Activity test',
    });

    expect(mockActivityRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        entityType: 'note',
        entityId: accountId,
        userId,
      }),
    );
    expect(mockActivityRepo.save).toHaveBeenCalled();
  });
});
