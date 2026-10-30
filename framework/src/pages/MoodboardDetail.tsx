import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowUpRight, ImagePlus, Trash2 } from 'lucide-react';
import { db } from '@/db/db';
import { deleteMoodboard, promoteMoodboard, updateMoodboard } from '@/db/repo';
import type { Moodboard } from '@/db/types';
import { useLiveQuery } from '@/lib/hooks';
import { AddToCollection } from '@/components/collect';
import { BoardExtras, Gallery, useBoardAssets } from '@/components/board';
import { BrowseButton } from '@/components/uploader';
import { ConfirmButton, Section, errorText, toast } from '@/components/ui';
import { NotFound } from './NotFound';

export function MoodboardDetail() {
  const { id = '' } = useParams();
  const board = useLiveQuery(() => db.moodboards.get(id).then((r) => r ?? null), [id]);
  if (board === undefined) return null;
  if (!board) return <NotFound />;
  return <BoardView key={board.id} board={board} />;
}

function BoardView({ board }: { board: Moodboard }) {
  const nav = useNavigate();
  const assets = useBoardAssets(board.id);
  const [name, setName] = useState(board.name);
  const [desc, setDesc] = useState(board.description);
  useEffect(() => {
    setName(board.name);
    setDesc(board.description);
  }, [board.name, board.description]);

  if (board.artDirectionId) {
    return (
      <div className="py-10">
        <p className="text-[14px]">
          This board belongs to an art direction.{' '}
          <Link className="link" to={`/art-directions/${board.artDirectionId}`}>
            Open it
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="label mb-3">
        <Link to="/moodboards" className="hover:text-ink">
          Moodboards
        </Link>{' '}
        / Personal
      </div>
      <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <input
            className="w-full border-0 bg-transparent p-0 font-serif text-[48px] leading-[1] outline-none md:text-[64px]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== board.name && updateMoodboard(board.id, { name: name.trim() })}
            aria-label="Board name"
          />
          <input
            className="mt-2 w-full max-w-2xl border-0 bg-transparent p-0 text-[15px] text-muted outline-none placeholder:text-faint"
            value={desc}
            placeholder="What is this board collecting?"
            onChange={(e) => setDesc(e.target.value)}
            onBlur={() => desc !== board.description && updateMoodboard(board.id, { description: desc })}
            aria-label="Description"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddToCollection entityType="moodboard" entityId={board.id} />
          <button
            className="btn"
            title="Turn this board into a formal art direction"
            onClick={async () => {
              try {
                const id = await promoteMoodboard(board.id);
                toast('Promoted to an art direction');
                nav(`/art-directions/${id}`);
              } catch (e) {
                toast(errorText(e), 'error');
              }
            }}
          >
            <ArrowUpRight size={14} /> Promote to art direction
          </button>
          <ConfirmButton
            label="Delete board? Images stay"
            onConfirm={async () => {
              await deleteMoodboard(board.id);
              toast('Board deleted — images are still in the library');
              nav('/moodboards');
            }}
          >
            <Trash2 size={14} />
          </ConfirmButton>
        </div>
      </header>
      <Section
        title="Board"
        count={assets?.length}
        action={
          <div className="flex flex-wrap gap-2">
            <BrowseButton options={{ moodboardId: board.id }}>
              <ImagePlus size={14} /> Add images
            </BrowseButton>
            <BoardExtras moodboardId={board.id} />
          </div>
        }
      >
        <Gallery assets={assets ?? []} moodboardId={board.id} />
      </Section>
    </div>
  );
}
