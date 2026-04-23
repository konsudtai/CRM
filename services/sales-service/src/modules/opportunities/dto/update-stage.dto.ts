import { IsUUID } from 'class-validator';

export class UpdateStageDto {
  @IsUUID()
  stageId!: string;
}
