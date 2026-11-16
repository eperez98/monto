import { useApp } from '../../store/app';
import { useQuery } from '../../hooks/useDb';
import { Button, Modal } from '../../components/ui';
import { getMailPrefs } from '../../services/mail';
import { MailReview } from './MailReview';
import { tr } from '../../lib/i18n';

/** After the startup sync: shows what was found in the bank emails so the user picks what to add. */
export function MailReviewHost() {
  const review = useApp((s) => s.mailReview);
  const setReview = useApp((s) => s.setMailReview);
  const route = useApp((s) => s.route);
  const accountId = useQuery((e) => getMailPrefs(e).accountId);
  // In Settings → Bank email the same results are shown inline.
  const open = !!review && route !== 'settings' && review.candidates.some((c) => !c.duplicate);
  return (
    <Modal open={open} onClose={() => setReview(null)} title={tr('Movimientos en tu correo')} subtitle={tr('Elige qué agregar y cambia el nombre si quieres. Los duplicados no se modifican.')} icon="bell" width={760}
      footer={<Button variant="ghost" onClick={() => setReview(null)}>{tr('Ahora no')}</Button>}>
      {review && <MailReview key={review.read + ':' + review.candidates.length} result={review} accountId={accountId} onDone={(left) => setReview(left.candidates.some((c) => !c.duplicate) ? left : null)} />}
    </Modal>
  );
}
