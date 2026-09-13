import { AcceptInviteCard } from "./AcceptInviteCard";

export default async function AceitarConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-md py-10">
      <AcceptInviteCard token={token} />
    </div>
  );
}
