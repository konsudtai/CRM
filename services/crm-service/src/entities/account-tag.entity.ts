import {
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
import { Account } from './account.entity';
import { Tag } from './tag.entity';

@Entity('account_tags')
export class AccountTag {
  @PrimaryColumn({ type: 'uuid', name: 'account_id' })
  accountId!: string;

  @PrimaryColumn({ type: 'uuid', name: 'tag_id' })
  tagId!: string;

  @ManyToOne(() => Account, (account) => account.accountTags)
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @ManyToOne(() => Tag, (tag) => tag.accountTags)
  @JoinColumn({ name: 'tag_id' })
  tag!: Tag;
}
