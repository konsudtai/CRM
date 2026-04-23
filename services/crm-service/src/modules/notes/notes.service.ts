import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { Note } from '../../entities/note.entity';
import { Attachment } from '../../entities/attachment.entity';
import { Activity } from '../../entities/activity.entity';
import { Account } from '../../entities/account.entity';
import { S3_CLIENT } from '../../providers/s3.provider';
import { CreateNoteDto, AttachmentDto } from './dto/create-note.dto';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const S3_BUCKET = process.env.S3_BUCKET || 'crm-attachments';

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note)
    private readonly noteRepo: Repository<Note>,
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @Inject(S3_CLIENT)
    private readonly s3: S3Client,
  ) {}

  async createNote(
    tenantId: string,
    accountId: string,
    userId: string,
    dto: CreateNoteDto,
  ): Promise<Note> {
    // Verify account exists
    const account = await this.accountRepo.findOne({
      where: { id: accountId, tenantId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Create note
    const note = this.noteRepo.create({
      tenantId,
      entityType: 'account',
      entityId: accountId,
      content: dto.content,
      authorId: userId,
    });
    const savedNote = await this.noteRepo.save(note);

    // Handle attachments
    if (dto.attachments?.length) {
      const attachments = await Promise.all(
        dto.attachments.map((att) =>
          this.uploadAndSaveAttachment(tenantId, savedNote.id, att),
        ),
      );
      savedNote.attachments = attachments;
    }

    // Create activity record
    await this.activityRepo.save(
      this.activityRepo.create({
        tenantId,
        entityType: 'note',
        entityId: accountId,
        summary: `Note added: ${dto.content.substring(0, 100)}`,
        userId,
        timestamp: new Date(),
        metadata: { noteId: savedNote.id },
      }),
    );

    return savedNote;
  }

  private async uploadAndSaveAttachment(
    tenantId: string,
    noteId: string,
    dto: AttachmentDto,
  ): Promise<Attachment> {
    if (dto.fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File ${dto.fileName} exceeds 10MB limit`,
      );
    }

    const fileId = uuidv4();
    const s3Key = `${tenantId}/attachments/${fileId}/${dto.fileName}`;
    const buffer = Buffer.from(dto.fileContent, 'base64');

    await this.s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: dto.mimeType,
      }),
    );

    const fileUrl = `s3://${S3_BUCKET}/${s3Key}`;

    const attachment = this.attachmentRepo.create({
      tenantId,
      noteId,
      fileName: dto.fileName,
      fileUrl,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType,
    });

    return this.attachmentRepo.save(attachment);
  }
}
