import { memberColor, type Member } from '../domain/types';

/** 担当者の頭文字アイコン */
export function Avatar({ member }: { member: Member }) {
  return (
    <span className={`avatar label-${memberColor(member.id)}`} aria-hidden="true">
      {[...member.name.trim()][0] ?? '?'}
    </span>
  );
}
